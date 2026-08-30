import { spawnSync } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPistonScriptArgs } from './piston.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the project (one level up from types/)
const ROOT_DIR = path.resolve(__dirname, '..');

const CONTAINER_NAME = 'piston_api';

const actionInput = process.argv[2];

if (!actionInput) {
  console.error('Please specify an action: start, stop, remove, setup, or status');
  process.exit(1);
}

const argsObj: IPistonScriptArgs = {
  action: actionInput,
};

// Runs a command, streaming its output; exits the process on failure.
const runCommand = (cmd: string, args: string[]): void => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
};

// Runs a command quietly and returns its trimmed stdout + exit status.
// Used for state probes where a non-zero exit is expected, not fatal.
const probe = (cmd: string, args: string[]): { status: number; stdout: string } => {
  const res = spawnSync(cmd, args, { encoding: 'utf-8', shell: true });
  return { status: res.status ?? 1, stdout: (res.stdout ?? '').trim() };
};

const containerExists = (): boolean =>
  probe('podman', ['container', 'exists', CONTAINER_NAME]).status === 0;

const containerRunning = (): boolean =>
  probe('podman', ['container', 'inspect', '-f', '"{{.State.Running}}"', CONTAINER_NAME]).stdout ===
  'true';

if (argsObj.action === 'start') {
  // Reuse the existing container if it's already there so it stays visible in
  // Podman Desktop's container list — only `podman run` on a first-time setup.
  if (containerExists()) {
    if (containerRunning()) {
      console.log(`${CONTAINER_NAME} is already running.`);
    } else {
      runCommand('podman', ['start', CONTAINER_NAME]);
    }
  } else {
    const entrypointPath = path.resolve(ROOT_DIR, 'piston-entrypoint.sh');
    // Normalize path backslashes to forward slashes for container mount compatibility on Windows
    const normalizedPath = entrypointPath.replace(/\\/g, '/');

    runCommand('podman', [
      'run',
      '-d',
      '--name',
      CONTAINER_NAME,
      '-p',
      '127.0.0.1:2000:2000',
      '--privileged',
      // Pin GitHub's release-asset CDN to a reachable anycast IP. `ppman install`
      // downloads runtimes from release-assets/objects.githubusercontent.com; on
      // some networks the 185.199.109.133 edge is unroutable and an unhandled
      // fetch timeout crashes the whole Piston process. .108.133 is stable.
      '--add-host',
      'release-assets.githubusercontent.com:185.199.108.133',
      '--add-host',
      'objects.githubusercontent.com:185.199.108.133',
      '--add-host',
      'raw.githubusercontent.com:185.199.108.133',
      '-v',
      'piston_data:/piston',
      '-v',
      `"${normalizedPath}:/piston_api/src/docker-entrypoint.sh:ro"`,
      'ghcr.io/engineer-man/piston',
    ]);
  }
} else if (argsObj.action === 'stop') {
  // Stop but keep the container (shows as "Exited" in Podman Desktop, restart
  // with `piston:start`). Use `piston:remove` to delete it entirely.
  if (containerExists()) {
    runCommand('podman', ['stop', CONTAINER_NAME]);
  } else {
    console.log(`${CONTAINER_NAME} does not exist — nothing to stop.`);
  }
} else if (argsObj.action === 'remove') {
  if (containerExists()) {
    runCommand('podman', ['rm', '-f', CONTAINER_NAME]);
  } else {
    console.log(`${CONTAINER_NAME} does not exist — nothing to remove.`);
  }
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
  runCommand('podman', ['ps', '-a', '--filter', `name=${CONTAINER_NAME}`]);
} else {
  console.error(`Unknown action: ${argsObj.action}`);
  process.exit(1);
}
