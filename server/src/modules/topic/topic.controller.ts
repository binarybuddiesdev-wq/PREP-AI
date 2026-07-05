import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { TopicService } from './topic.service.js';
import { CreateTopicDto, GetTopicsDto, GetTopicBySlugDto, UpdateTopicDto } from './dto/index.js';
import {
    ApiTags as ApiTagsEnum,
    ApiOperation as ApiOperationEnum,
    ApiRoutes,
    Roles,
    CreateTopicResponse,
    GetAllTopicsResponse,
    GetTopicBySlugResponse,
    UpdateTopicResponse,
    DeleteTopicResponse,
    CREATE_TOPIC_SUCCESS,
    GET_TOPICS_SUCCESS,
    GET_TOPIC_SUCCESS,
    UPDATE_TOPIC_SUCCESS,
    DELETE_TOPIC_SUCCESS,
    ClerkAuthGuard,
    RolesGuard,
} from '@/common/index.js';

@ApiTags(ApiTagsEnum.TOPICS)
@Controller(ApiRoutes.TOPICS)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class TopicController {

    constructor(private readonly topicService: TopicService) { }

    @ApiBearerAuth()
    @Post()
    @HttpCode(201)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.TOPIC_CREATE })
    @ApiResponse(CreateTopicResponse)
    async createTopic(@Body() dto: CreateTopicDto) {
        const data = await this.topicService.createTopic(dto);
        return { message: CREATE_TOPIC_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Get()
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.TOPIC_GET_ALL })
    @ApiResponse(GetAllTopicsResponse)
    async getAllCategories(@Query() dto: GetTopicsDto) {
        const data = await this.topicService.getAllCategories(dto);
        return { message: GET_TOPICS_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Get(':slug')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.TOPIC_GET_BY_SLUG })
    @ApiParam({ name: 'slug', example: 'react', description: 'Topic slug' })
    @ApiResponse(GetTopicBySlugResponse)
    async getTopicBySlug(@Param() params: GetTopicBySlugDto) {
        const data = await this.topicService.getTopicBySlug(params.slug);
        return { message: GET_TOPIC_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Patch(':id')
    @HttpCode(200)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.TOPIC_UPDATE })
    @ApiParam({ name: 'id', description: 'Topic ID' })
    @ApiResponse(UpdateTopicResponse)
    async updateTopic(@Param('id') id: string, @Body() dto: UpdateTopicDto) {
        const data = await this.topicService.updateTopic(id, dto);
        return { message: UPDATE_TOPIC_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Delete(':id')
    @HttpCode(200)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.TOPIC_DELETE })
    @ApiParam({ name: 'id', description: 'Topic ID' })
    @ApiResponse(DeleteTopicResponse)
    async deleteTopic(@Param('id') id: string) {
        await this.topicService.deleteTopic(id);
        return { message: DELETE_TOPIC_SUCCESS };
    }
}
