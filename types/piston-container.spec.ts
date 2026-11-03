import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPistonContainerArgs } from './piston-container.js';

test('builds a loopback-only Piston container with explicit sandbox limits', () => {
  const args = buildPistonContainerArgs('C:\\workspace\\PREP-AI\\piston-entrypoint.sh');
  const environment = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--env') {
      const [key, value] = args[index + 1].split('=');
      environment.set(key, value);
    }
  }

  assert.equal(args[args.indexOf('-p') + 1], '127.0.0.1:2000:2000');
  assert.ok(args.includes('--privileged'));
  assert.ok(args.includes('--cpus=4'));
  assert.ok(args.includes('--memory=2g'));
  assert.ok(args.includes('--pids-limit=512'));
  assert.ok(args.includes('piston_data:/piston'));
  assert.ok(
    args.some((argument) =>
      argument.includes(
        'C:/workspace/PREP-AI/piston-entrypoint.sh:/piston_api/src/docker-entrypoint.sh:ro'
      )
    )
  );

  assert.deepEqual(Object.fromEntries(environment), {
    PISTON_DISABLE_NETWORKING: 'true',
    PISTON_MAX_PROCESS_COUNT: '32',
    PISTON_MAX_OPEN_FILES: '64',
    PISTON_MAX_FILE_SIZE: '1048576',
    PISTON_OUTPUT_MAX_SIZE: '16384',
    PISTON_MAX_CONCURRENT_JOBS: '5',
    PISTON_COMPILE_TIMEOUT: '10000',
    PISTON_RUN_TIMEOUT: '3000',
    PISTON_COMPILE_CPU_TIME: '10000',
    PISTON_RUN_CPU_TIME: '3000',
    PISTON_COMPILE_MEMORY_LIMIT: '268435456',
    PISTON_RUN_MEMORY_LIMIT: '268435456',
  });
});
