import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { shutdownTelemetry } from './sdk-state.js';

@Injectable()
class TelemetryShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry().catch(() => undefined);
  }
}

@Module({ providers: [TelemetryShutdown] })
export class TracingModule {}
