import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = path.join(rootDirectory, 'server');
const composeFile = path.join(rootDirectory, 'docker-compose.integration.yml');
const projectName = `prepai-data-isolation-test-${process.pid}`;
const mongoPort = 27018;
const postgresPort = 5433;
const databaseName = 'prepai_data_isolation_test';
const mongoUrl = `mongodb://127.0.0.1:${mongoPort}/${databaseName}?replicaSet=rs0&directConnection=true`;
const postgresUrl = `postgresql://postgres:postgres@127.0.0.1:${postgresPort}/${databaseName}`;
const childEnvironment = {
  ...process.env,
  DATABASE_URL: mongoUrl,
  POSTGRESQL_URL: postgresUrl,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDirectory,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function assertTestPortsAvailable() {
  for (const [port, service] of [
    [mongoPort, 'MongoDB'],
    [postgresPort, 'PostgreSQL'],
  ]) {
    if (!(await isPortAvailable(port))) {
      throw new Error(
        `${service} integration-test port ${port} is already in use. ` +
          'Stop the process using that test port and retry; no containers were changed.'
      );
    }
  }
}

async function waitForTcp(port) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const available = await new Promise((resolve) => {
      const socket = createServer();
      socket.once('error', () => resolve(false));
      socket.listen(port, '127.0.0.1', () => socket.close(() => resolve(true)));
    });
    if (!available) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for database test port ${port}`);
}

async function waitForContainerHealth(service) {
  const containerName = `${projectName}_${service}_1`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      process.platform === 'win32' ? 'podman.exe' : 'podman',
      ['inspect', '--format', '{{.State.Health.Status}}', containerName],
      { cwd: rootDirectory, env: process.env, encoding: 'utf8' }
    );
    if (result.status === 0 && result.stdout.trim() === 'healthy') return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for the isolated ${service} container to become healthy`);
}

const compose = (args) => run('podman-compose', ['-p', projectName, '-f', composeFile, ...args]);

let composeStartAttempted = false;
let primaryError;
try {
  await assertTestPortsAvailable();
  composeStartAttempted = true;
  compose(['up', '-d']);
  await Promise.all([waitForTcp(mongoPort), waitForTcp(postgresPort)]);
  await Promise.all([waitForContainerHealth('mongo'), waitForContainerHealth('postgres')]);

  const schemaCommands = [
    ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'],
    ['prisma', 'db', 'push', '--schema=prisma/schema.postgresql.prisma', '--skip-generate'],
  ];
  for (const args of schemaCommands) {
    let lastError;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      try {
        run('pnpm', ['exec', ...args], { cwd: serverDirectory, env: childEnvironment });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 20) await delay(1_000);
      }
    }
    if (lastError) throw lastError;
  }

  run('pnpm', ['test:e2e'], { cwd: serverDirectory, env: childEnvironment });
} catch (error) {
  primaryError = error;
} finally {
  if (composeStartAttempted) {
    try {
      compose(['down', '--volumes', '--remove-orphans']);
    } catch (cleanupError) {
      process.stderr.write(
        `Failed to remove the isolated database test project: ${cleanupError}\n`
      );
      if (!primaryError) primaryError = cleanupError;
    }
  }
}

if (primaryError) {
  process.stderr.write(`${primaryError}\n`);
  process.exitCode = 1;
}
