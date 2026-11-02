import { Module } from '@nestjs/common';
import { CodingController } from './coding.controller.js';
import { CodingService } from './coding.service.js';
import { PistonClient } from './piston.client.js';

@Module({
  controllers: [CodingController],
  providers: [CodingService, PistonClient],
})
export class CodingModule {}
