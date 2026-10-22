#!/usr/bin/env node
// Runs the Tier 1 checks from server-verify-implementation / ui-verify-implementation.
// The skills own the meaning of each check; this file only runs them and records the output.
//
// Usage:
//   node scripts/gate.js [--stack server|ui|all|auto] [--level dev|full] [--print-plan]
//
//   --stack auto   (default) pick the stacks from `git diff main...HEAD`, the working tree and untracked files
//   --level dev    Tier 1 (default)
//   --level full   Tier 1 plus the server coverage run (the pre-merge level)
//   --print-plan   list the commands and run nothing
//
// Every command is non-mutating. There is no result cache; a green line is evidence for the tree you ran it on.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index > -1 ? args[index + 1] : fallback;
};
const stackOption = option('--stack', 'auto');
const level = option('--level', 'dev');
const printPlanOnly = args.includes('--print-plan');

if (!['server', 'ui', 'all', 'auto'].includes(stackOption) || !['dev', 'full'].includes(level)) {
  console.error(
    'usage: node scripts/gate.js [--stack server|ui|all|auto] [--level dev|full] [--print-plan]'
  );
  process.exit(2);
}

const git = (...gitArgs) => {
  const result = spawnSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').filter(Boolean) : [];
};

const detectStacks = () => {
  const changed = new Set([
    ...git('diff', '--name-only', 'main...HEAD'),
    ...git('diff', '--name-only', 'HEAD'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ]);
  const stacks = new Set();
  for (const file of changed) {
    if (file.startsWith('server/')) {
      stacks.add('server');
    } else if (file.startsWith('ui/')) {
      stacks.add('ui');
    }
  }
  return [...stacks];
};

const stacks =
  stackOption === 'all'
    ? ['server', 'ui']
    : stackOption === 'auto'
      ? detectStacks()
      : [stackOption];

const step = (name, cwd, command) => ({ name, cwd, command });
const plan = [
  step('root lint', '.', 'pnpm lint'),
  step('root format check', '.', 'pnpm format:check'),
];

if (stacks.includes('server')) {
  plan.push(
    step('server prisma generate', 'server', 'pnpm prisma:generate'),
    step('server build', 'server', 'pnpm build'),
    step('server spec type-check', 'server', 'pnpm exec tsc --noEmit -p tsconfig.json'),
    step('server unit tests', 'server', 'pnpm test')
  );
  if (level === 'full') {
    plan.push(step('server coverage', 'server', 'pnpm test:coverage'));
  }
}
if (stacks.includes('ui')) {
  plan.push(
    step('ui lint', 'ui', 'pnpm lint'),
    step('ui type-check', 'ui', 'pnpm exec tsc -b'),
    step('ui build', 'ui', 'pnpm build'),
    step('ui unit tests', 'ui', 'pnpm test -- --run')
  );
}
if (fs.existsSync(path.join(repoRoot, 'scripts/check-agent-docs.js'))) {
  plan.push(step('agent docs', '.', 'pnpm run check:agent-docs'));
}

console.info(
  `gate: level=${level} stacks=${stacks.length ? stacks.join(',') : '(none changed: root checks only)'}`
);
if (printPlanOnly) {
  for (const item of plan) {
    console.info(`  [${item.cwd}] ${item.command}   (${item.name})`);
  }
  process.exit(0);
}

const logDir = path.join(repoRoot, 'node_modules/.cache/gate');
fs.mkdirSync(logDir, { recursive: true });

let failures = 0;
plan.forEach((item, index) => {
  const started = Date.now();
  const result = spawnSync(item.command, {
    cwd: path.join(repoRoot, item.cwd),
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const logFile = path.join(
    logDir,
    `${String(index + 1).padStart(2, '0')}-${item.name.replace(/\W+/g, '-')}.log`
  );
  fs.writeFileSync(logFile, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const passed = result.status === 0;
  if (!passed) {
    failures += 1;
  }
  console.info(
    `${passed ? 'PASS' : 'FAIL'}  ${item.name.padEnd(24)} exit=${result.status}  ${seconds}s  log=${path.relative(repoRoot, logFile)}`
  );
});

console.info(
  failures === 0
    ? '\ngate: all checks passed'
    : `\ngate: ${failures} check(s) failed. Read the log of each FAIL line; compare with the merge-base before calling one a regression.`
);
process.exit(failures === 0 ? 0 : 1);
