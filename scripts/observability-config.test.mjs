import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import YAML from 'yaml';

const readYaml = async (path) => YAML.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('Prometheus scrape template authenticates to the application metrics endpoint', async () => {
  const config = await readYaml('../deploy/observability/prometheus/prometheus.yml');
  const job = config.scrape_configs.find(({ job_name }) => job_name === 'prepai-api');

  assert.ok(job, 'prepai-api scrape job exists');
  assert.equal(job.metrics_path, '/metrics');
  assert.equal(job.authorization.credentials_file, '/etc/prometheus/secrets/prepai-metrics-token');
  assert.ok(job.static_configs.some(({ targets }) => targets.includes('server:3000')));
  const probeJob = config.scrape_configs.find(({ job_name }) => job_name === 'prepai-probes');

  assert.ok(probeJob, 'health probe scrape job exists');
  assert.equal(probeJob.metrics_path, '/probe');
  assert.ok(
    probeJob.static_configs.some(
      ({ targets }) =>
        targets.includes('http://server:3000/healthz') &&
        targets.includes('http://server:3000/readyz')
    ),
    'liveness and readiness endpoints are probed'
  );
});

test('Blackbox Exporter uses a bounded HTTP probe module', async () => {
  const config = await readYaml('../deploy/observability/blackbox/blackbox.yml');

  assert.equal(config.modules?.http_2xx?.prober, 'http');
  assert.equal(config.modules.http_2xx.timeout, '5s');
  assert.equal(config.modules.http_2xx.http.method, 'GET');
});

test('Prometheus alert rules only reference metrics exposed by the application', async () => {
  const rules = await readYaml('../deploy/observability/prometheus/alerts.yml');
  const groups = rules.groups;
  const alerts = groups.flatMap(({ rules: groupRules }) => groupRules);
  const names = alerts.map(({ alert }) => alert);
  const expressions = alerts.map(({ expr }) => String(expr));
  const metricNames = [
    'probe_success',
    'http_request_duration_seconds',
    'http_rate_limit_exceeded_total',
    'worker_job_attempts_total',
    'bullmq_job_count',
    'redis_memory_used_bytes',
    'redis_memory_max_bytes',
    'mastra_provider_failovers_total',
    'prisma_query_duration_seconds',
    'webhook_signature_failures_total',
  ];

  assert.ok(groups.length > 0, 'at least one rule group exists');
  assert.equal(new Set(names).size, names.length, 'alert names are unique');
  const targetAlert = alerts.find(({ alert }) => alert === 'PrepAIApiTargetDown');
  assert.match(String(targetAlert?.expr), /absent\(/, 'missing scrape targets are detected too');
  const authLimitAlert = alerts.find(({ alert }) => alert === 'PrepAIAuthRateLimitRejectionsHigh');
  const generalLimitAlert = alerts.find(
    ({ alert }) => alert === 'PrepAIGeneralRateLimitRejectionsHigh'
  );
  assert.match(String(authLimitAlert?.expr), /route_class="auth"/);
  assert.match(String(authLimitAlert?.expr), /http_rate_limit_exceeded_total/);
  assert.match(String(authLimitAlert?.expr), /> 20/);
  assert.equal(authLimitAlert?.for, '2m');
  assert.equal(authLimitAlert?.labels?.severity, 'warning');
  assert.match(String(generalLimitAlert?.expr), /route_class="general"/);
  assert.match(String(generalLimitAlert?.expr), /http_rate_limit_exceeded_total/);
  assert.match(String(generalLimitAlert?.expr), /> 100/);
  assert.equal(generalLimitAlert?.for, '2m');
  assert.equal(generalLimitAlert?.labels?.severity, 'warning');
  for (const metric of metricNames) {
    assert.ok(
      expressions.some((expr) => expr.includes(metric)),
      `${metric} is covered`
    );
  }
  for (const rule of alerts) {
    assert.ok(rule.for, `${rule.alert} has a pending duration`);
    assert.ok(
      ['warning', 'critical'].includes(rule.labels?.severity),
      `${rule.alert} has severity`
    );
    assert.ok(rule.annotations?.summary, `${rule.alert} has an operator summary`);
    assert.ok(rule.annotations?.description, `${rule.alert} has an actionable description`);
  }
});

test('Grafana dashboard is portable and has panels for the service signals', async () => {
  const dashboard = JSON.parse(
    await readFile(
      new URL('../deploy/observability/grafana/prepai-overview.json', import.meta.url),
      'utf8'
    )
  );
  const targets = dashboard.panels.flatMap((panel) => panel.targets ?? []);
  const expressions = targets.map(({ expr }) => expr ?? '');

  assert.equal(dashboard.uid, 'prepai-overview');
  assert.equal(dashboard.timezone, 'browser');
  for (const metric of [
    'probe_success',
    'topic_cache_operation_duration_seconds',
    'http_request_duration_seconds',
    'worker_job_attempts_total',
    'bullmq_job_count',
    'redis_memory_used_bytes',
    'mastra_provider_failovers_total',
    'prisma_query_duration_seconds',
    'webhook_signature_failures_total',
  ]) {
    assert.ok(
      expressions.some((expr) => expr.includes(metric)),
      `${metric} is graphed`
    );
  }
});

test('Sentry release upload is optional, main-only, and uses server build maps', async () => {
  const workflow = await readYaml('../.github/workflows/ci.yml');
  const releaseStep = workflow.jobs['test-server'].steps.find(({ uses }) =>
    uses?.startsWith('getsentry/action-release@')
  );

  assert.ok(releaseStep, 'CI has an official Sentry release action');
  assert.match(releaseStep.if, /github\.event_name == 'push'/);
  assert.match(releaseStep.if, /refs\/heads\/main/);
  assert.match(releaseStep.if, /SENTRY_AUTH_TOKEN/);
  assert.equal(releaseStep.with.sourcemaps, './server/dist');
  assert.equal(releaseStep.with.release, 'prepai+${{ github.sha }}');
  assert.equal(releaseStep.with.set_commits, 'skip');
  assert.equal(releaseStep.env.SENTRY_AUTH_TOKEN, '${{ secrets.SENTRY_AUTH_TOKEN }}');
  assert.equal(releaseStep.env.SENTRY_ORG, '${{ vars.SENTRY_ORG }}');
  assert.equal(releaseStep.env.SENTRY_PROJECT, '${{ vars.SENTRY_PROJECT }}');
});
