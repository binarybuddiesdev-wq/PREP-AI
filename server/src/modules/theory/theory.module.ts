import { Module } from '@nestjs/common';
import { TheoryService } from './theory.service.js';
import { TheoryController } from './theory.controller.js';

@Module({
  providers: [TheoryService],
  controllers: [TheoryController]
})
export class TheoryModule { }
