import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator.js';
import { ApiTags as Tags, ApiOperation as Ops } from '@/common/constants/api.constants.js';
import { HealthService } from './health.service.js';
import type { IReadinessReport, ILivenessReport } from './health.types.js';

@ApiTags(Tags.HEALTH)
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  @HttpCode(200)
  @ApiOperation({ summary: Ops.HEALTH_CHECK })
  @ApiResponse({ status: 200, description: 'Simple health check returning {status: "ok"}' })
  check(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('healthz')
  @HttpCode(200)
  @ApiOperation({ summary: Ops.HEALTH_LIVENESS })
  @ApiResponse({ status: 200, description: 'Process is alive and the event loop is responsive' })
  liveness(): ILivenessReport {
    return this.healthService.liveness();
  }

  @Public()
  @Get('readyz')
  @HttpCode(200)
  @ApiOperation({ summary: Ops.HEALTH_READINESS })
  @ApiResponse({ status: 200, description: 'All critical dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unreachable' })
  async readiness(): Promise<IReadinessReport> {
    const report = await this.healthService.readiness();
    if (report.status === 'not-ready') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
