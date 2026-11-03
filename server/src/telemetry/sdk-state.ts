type TelemetryShutdown = () => Promise<void>;

let shutdown: TelemetryShutdown | undefined;

export function registerTelemetryShutdown(shutdownHandler: TelemetryShutdown): void {
  shutdown = shutdownHandler;
}

export async function shutdownTelemetry(): Promise<void> {
  await shutdown?.();
}
