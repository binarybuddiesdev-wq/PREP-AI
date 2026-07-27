import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';

import { TheoryService } from './theory.service.js';
import { StartSessionDto, SubmitAnswerDto, GetSessionQuestionsDto, GetSessionHistoryDto, GetScoreTrendDto } from './dto/index.js';
import {
    ApiTags as ApiTagsEnum,
    ApiOperation as ApiOperationEnum,
    ApiRoutes,
    CurrentUser,
    StartSessionResponse,
    THEORY_SESSION_STARTED,
    GetSessionQuestionsResponse,
    THEORY_QUESTIONS_FETCHED,
    SubmitAnswerResponse,
    THEORY_ANSWER_SUBMITTED,
    CompleteSessionResponse,
    THEORY_SESSION_COMPLETED,
    GetSessionDetailResponse,
    THEORY_SESSION_FETCHED,
    GetSessionHistoryResponse,
    THEORY_SESSIONS_FETCHED,
    GetWeakAreasResponse,
    THEORY_WEAK_AREAS_FETCHED,
    GetScoreTrendResponse,
    THEORY_SCORE_TREND_FETCHED,
    ClerkAuthGuard,
    RolesGuard,
} from '@/common/index.js';

@ApiTags(ApiTagsEnum.THEORY)
@Controller(ApiRoutes.THEORY)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class TheoryController {

    constructor(private readonly theoryService: TheoryService) { }

    @ApiBearerAuth()
    @Post('session/start')
    @HttpCode(201)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_START_SESSION })
    @ApiResponse(StartSessionResponse)
    async startSession(@Body() dto: StartSessionDto, @CurrentUser('id') userId: string) {
        const data = await this.theoryService.startSession(dto, userId);
        return { message: THEORY_SESSION_STARTED, data };
    }

    @ApiBearerAuth()
    @Get('session/:sessionId/questions')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_GET_QUESTIONS })
    @ApiResponse(GetSessionQuestionsResponse)
    async getSessionQuestions(
        @Param('sessionId') sessionId: string,
        @CurrentUser('id') userId: string,
        @Query() dto: GetSessionQuestionsDto,
    ) {
        const data = await this.theoryService.getSessionQuestions(sessionId, userId, dto);
        return { message: THEORY_QUESTIONS_FETCHED, data };
    }

    @ApiBearerAuth()
    @Post('session/:sessionId/answer')
    @HttpCode(201)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_SUBMIT_ANSWER })
    @ApiResponse(SubmitAnswerResponse)
    async submitAnswer(
        @Param('sessionId') sessionId: string,
        @Body() dto: SubmitAnswerDto,
        @CurrentUser('id') userId: string,
    ) {
        const data = await this.theoryService.submitAnswer(sessionId, userId, dto);
        return { message: THEORY_ANSWER_SUBMITTED, data };
    }

    @ApiBearerAuth()
    @Post('session/:sessionId/complete')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_COMPLETE_SESSION })
    @ApiResponse(CompleteSessionResponse)
    async completeSession(
        @Param('sessionId') sessionId: string,
        @CurrentUser('id') userId: string,
    ) {
        const data = await this.theoryService.completeSession(sessionId, userId);
        return { message: THEORY_SESSION_COMPLETED, data };
    }

    @ApiBearerAuth()
    @Get('session/:sessionId')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_GET_SESSION })
    @ApiResponse(GetSessionDetailResponse)
    async getSessionDetail(
        @Param('sessionId') sessionId: string,
        @CurrentUser('id') userId: string,
    ) {
        const data = await this.theoryService.getSessionDetail(sessionId, userId);
        return { message: THEORY_SESSION_FETCHED, data };
    }

    @ApiBearerAuth()
    @Get('sessions')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_GET_SESSIONS })
    @ApiResponse(GetSessionHistoryResponse)
    async getSessionHistory(
        @CurrentUser('id') userId: string,
        @Query() dto: GetSessionHistoryDto,
    ) {
        const data = await this.theoryService.getSessionHistory(userId, dto);
        return { message: THEORY_SESSIONS_FETCHED, data };
    }

    @ApiBearerAuth()
    @Get('weak-areas')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_GET_WEAK_AREAS })
    @ApiResponse(GetWeakAreasResponse)
    async getWeakAreas(@CurrentUser('id') userId: string) {
        const data = await this.theoryService.getWeakAreas(userId);
        return { message: THEORY_WEAK_AREAS_FETCHED, data };
    }

    @ApiBearerAuth()
    @Get('score-trend')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.THEORY_GET_SCORE_TREND })
    @ApiResponse(GetScoreTrendResponse)
    async getScoreTrend(
        @CurrentUser('id') userId: string,
        @Query() dto: GetScoreTrendDto,
    ) {
        const data = await this.theoryService.getScoreTrend(userId, dto);
        return { message: THEORY_SCORE_TREND_FETCHED, data };
    }
}
