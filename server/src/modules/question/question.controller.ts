import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { QuestionService } from './question.service.js';
import { CreateQuestionDto, GetQuestionsDto, UpdateQuestionDto } from './dto/index.js';
import {
    ApiTags as ApiTagsEnum,
    ApiOperation as ApiOperationEnum,
    ApiRoutes,
    Roles,
    CreateQuestionResponse,
    GetAllQuestionsResponse,
    GetQuestionByIdResponse,
    UpdateQuestionResponse,
    DeleteQuestionResponse,
    CREATE_QUESTION_SUCCESS,
    GET_QUESTIONS_SUCCESS,
    GET_QUESTION_SUCCESS,
    UPDATE_QUESTION_SUCCESS,
    DELETE_QUESTION_SUCCESS,
    ClerkAuthGuard,
    RolesGuard,
} from '@/common/index.js';

@ApiTags(ApiTagsEnum.QUESTIONS)
@Controller(ApiRoutes.QUESTIONS)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class QuestionController {

    constructor(private readonly questionService: QuestionService) { }

    @ApiBearerAuth()
    @Post()
    @HttpCode(201)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.QUESTION_CREATE })
    @ApiResponse(CreateQuestionResponse)
    async createQuestion(@Body() dto: CreateQuestionDto) {
        const data = await this.questionService.createQuestion(dto);
        return { message: CREATE_QUESTION_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Get()
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.QUESTION_GET_ALL })
    @ApiResponse(GetAllQuestionsResponse)
    async getQuestions(@Query() dto: GetQuestionsDto) {
        const data = await this.questionService.getQuestions(dto);
        return { message: GET_QUESTIONS_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Get(':id')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.QUESTION_GET_BY_ID })
    @ApiParam({ name: 'id', description: 'Question ID' })
    @ApiResponse(GetQuestionByIdResponse)
    async getQuestionById(@Param('id') id: string) {
        const data = await this.questionService.getQuestionById(id);
        return { message: GET_QUESTION_SUCCESS, data };
    }


    @ApiBearerAuth()
    @Patch(':id')
    @HttpCode(200)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.QUESTION_UPDATE })
    @ApiParam({ name: 'id', description: 'Question ID' })
    @ApiResponse(UpdateQuestionResponse)
    async updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
        const data = await this.questionService.updateQuestion(id, dto);
        return { message: UPDATE_QUESTION_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Delete(':id')
    @HttpCode(200)
    @Roles('ADMIN')
    @ApiOperation({ summary: ApiOperationEnum.QUESTION_DELETE })
    @ApiParam({ name: 'id', description: 'Question ID' })
    @ApiResponse(DeleteQuestionResponse)
    async deleteQuestion(@Param('id') id: string) {
        await this.questionService.deleteQuestion(id);
        return { message: DELETE_QUESTION_SUCCESS };
    }

}
