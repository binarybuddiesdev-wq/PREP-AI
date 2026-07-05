import { Module } from '@nestjs/common';
import { TopicService } from './topic.service.js';
import { TopicController } from './topic.controller.js';

@Module({
  providers: [TopicService],
  controllers: [TopicController]
})
export class TopicModule { }
