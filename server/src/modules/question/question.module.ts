import { Module } from '@nestjs/common';
import { QuestionService } from './question.service.js';
import { QuestionController } from './question.controller.js';

@Module({
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
