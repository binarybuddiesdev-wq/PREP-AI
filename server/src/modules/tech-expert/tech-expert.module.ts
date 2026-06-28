import { Module } from '@nestjs/common';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';

@Module({
  controllers: [TechExpertController],
  providers: [TechExpertService],
})
export class TechExpertModule {}
