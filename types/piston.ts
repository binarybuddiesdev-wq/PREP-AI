import { spawnSync } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPistonScriptArgs } from './piston.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the project (one level up from types/)
const ROOT_DIR = path.resolve(__dirname, '..');

const actionInput = process.argv[2];

if (!actionInput) {
  console.error('Please specify an action: start, stop, setup, or status');
  process.exit(1);
}

const argsObj: IPistonScriptArgs = {
  action: actionInput,
};

const runCommand = (cmd: string, args: string[]): void => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
};

if (argsObj.action === 'start') {
  const entrypointPath = path.resolve(ROOT_DIR, 'piston-entrypoint.sh');
  // Normalize path backslashes to forward slashes for container mount compatibility on Windows
  const normalizedPath = entrypointPath.replace(/\\/g, '/');

  runCommand('podman', [
    'run',
    '-d',
    '--name',
    'piston_api',
    '-p',
    '127.0.0.1:2000:2000',
    '--privileged',
    '-v',
    'piston_data:/piston',
    '-v',
    `"${normalizedPath}:/piston_api/src/docker-entrypoint.sh:ro"`,
    'ghcr.io/engineer-man/piston'
  ]);
} else if (argsObj.action === 'stop') {
  runCommand('podman', ['rm', '-f', 'piston_api']);
} else if (argsObj.action === 'setup') {
  const cliDir = path.resolve(ROOT_DIR, 'piston-cli');
  console.log('Installing CLI dependencies...');
  runCommand('pnpm', ['--dir', cliDir, 'install']);

  console.log('Installing JavaScript runtime...');
  runCommand('node', [path.resolve(cliDir, 'index.js'), 'ppman', 'install', 'node']);

  console.log('Installing TypeScript runtime...');
  runCommand('node', [path.resolve(cliDir, 'index.js'), 'ppman', 'install', 'typescript']);

  console.log('Installing Python runtime...');
  runCommand('node', [path.resolve(cliDir, 'index.js'), 'ppman', 'install', 'python']);
} else if (argsObj.action === 'status') {
  runCommand('podman', ['ps', '-a', '--filter', 'name=piston_api']);
} else {
  console.error(`Unknown action: ${argsObj.action}`);
  process.exit(1);
}
