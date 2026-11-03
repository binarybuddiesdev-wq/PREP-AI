import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { registerTelemetryShutdown } from './sdk-state.js';

const hasOtlpEndpoint = Boolean(
  process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] || process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
);

// Use root trace-ID sampling so a remote parent cannot force all requests to be sampled.
process.env['OTEL_TRACES_SAMPLER'] = 'traceidratio';
const configuredRatio = Number(process.env['OTEL_TRACES_SAMPLER_ARG'] ?? '0.1');
process.env['OTEL_TRACES_SAMPLER_ARG'] =
  Number.isFinite(configuredRatio) && configuredRatio >= 0 && configuredRatio <= 1
    ? String(configuredRatio)
    : '0.1';
if (!hasOtlpEndpoint) process.env['OTEL_TRACES_EXPORTER'] = 'none';
const isWorkerProcess = process.argv.some((argument) => argument.includes('worker.main'));
process.env['OTEL_SERVICE_NAME'] ??= isWorkerProcess ? 'prepai-worker' : 'prepai-api';

export const telemetrySdk = new NodeSDK({
  ...(hasOtlpEndpoint ? { traceExporter: new OTLPTraceExporter() } : {}),
  textMapPropagator: new W3CTraceContextPropagator(),
});

telemetrySdk.start();
registerTelemetryShutdown(() => telemetrySdk.shutdown());
