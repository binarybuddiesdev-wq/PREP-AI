import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator.js';
import { ApiTags as Tags } from '@/common/constants/api.constants.js';

@ApiTags(Tags.HEALTH)
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return { status: 'ok' };
  }
}
