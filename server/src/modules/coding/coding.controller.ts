import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CodingService } from './coding.service.js';
import {
  CodingSessionHistoryDto,
  ExecuteCodingDto,
  ListCodingProblemsDto,
  StartCodingSessionDto,
} from './dto/index.js';
import {
  ApiOperation as ApiOperationEnum,
  ApiRoutes,
  ApiTags as ApiTagsEnum,
} from '@/common/constants/api.constants.js';
import {
  CODING_EXECUTION_FETCHED,
  CODING_EXECUTION_QUEUED,
  CODING_PROBLEM_FETCHED,
  CODING_PROBLEMS_FETCHED,
  CODING_SESSION_COMPLETED,
  CODING_SESSION_FETCHED,
  CODING_SESSION_STARTED,
  CODING_SESSIONS_FETCHED,
  CODING_SUBMISSION_QUEUED,
} from '@/common/constants/api.constants.js';
import { ClerkAuthGuard, CurrentUser, RolesGuard } from '@/common/index.js';
import {
  CodingProblemResponse,
  CodingProblemsResponse,
  CodingRunResponse,
  CodingSessionCompletedResponse,
  CodingSessionDetailResponse,
  CodingExecutionResponse,
  CodingSessionHistoryResponse,
  CodingSessionStartedResponse,
  CodingSubmitResponse,
} from '@/common/schemas/index.js';

@ApiTags(ApiTagsEnum.CODING)
@Controller(ApiRoutes.CODING)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class CodingController {
  constructor(private readonly codingService: CodingService) {}

  @ApiBearerAuth()
  @Get('problems')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_LIST_PROBLEMS })
  @ApiResponse(CodingProblemsResponse)
  async listProblems(@Query() dto: ListCodingProblemsDto) {
    return { message: CODING_PROBLEMS_FETCHED, data: await this.codingService.listProblems(dto) };
  }

  @ApiBearerAuth()
  @Get('problems/:problemId')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_GET_PROBLEM })
  @ApiResponse(CodingProblemResponse)
  async getProblem(@Param('problemId') problemId: string) {
    return {
      message: CODING_PROBLEM_FETCHED,
      data: await this.codingService.getProblem(problemId),
    };
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @Post('session/start')
  @HttpCode(201)
  @ApiOperation({ summary: ApiOperationEnum.CODING_START_SESSION })
  @ApiResponse(CodingSessionStartedResponse)
  async startSession(
    @Body() dto: StartCodingSessionDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    return {
      message: CODING_SESSION_STARTED,
      data: await this.codingService.startSession(dto, userId, idempotencyKey),
    };
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this coding request',
  })
  @Post('session/:sessionId/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: ApiOperationEnum.CODING_RUN_CODE })
  @ApiResponse(CodingRunResponse)
  async runCode(
    @Param('sessionId') sessionId: string,
    @Body() dto: ExecuteCodingDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string
  ) {
    return {
      message: CODING_EXECUTION_QUEUED,
      data: await this.codingService.runCode(sessionId, userId, dto, idempotencyKey),
    };
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this coding request',
  })
  @Post('session/:sessionId/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: ApiOperationEnum.CODING_SUBMIT })
  @ApiResponse(CodingSubmitResponse)
  async submitSolution(
    @Param('sessionId') sessionId: string,
    @Body() dto: ExecuteCodingDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string
  ) {
    return {
      message: CODING_SUBMISSION_QUEUED,
      data: await this.codingService.submitSolution(sessionId, userId, dto, idempotencyKey),
    };
  }

  @ApiBearerAuth()
  @Get('session/:sessionId/executions/:executionId')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_GET_EXECUTION })
  @ApiResponse(CodingExecutionResponse)
  async getExecution(
    @Param('sessionId') sessionId: string,
    @Param('executionId') executionId: string,
    @CurrentUser('id') userId: string
  ) {
    return {
      message: CODING_EXECUTION_FETCHED,
      data: await this.codingService.getExecution(sessionId, executionId, userId),
    };
  }

  @ApiBearerAuth()
  @Get('session/:sessionId')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_GET_SESSION })
  @ApiResponse(CodingSessionDetailResponse)
  async getSessionDetail(@Param('sessionId') sessionId: string, @CurrentUser('id') userId: string) {
    return {
      message: CODING_SESSION_FETCHED,
      data: await this.codingService.getSessionDetail(sessionId, userId),
    };
  }

  @ApiBearerAuth()
  @Post('session/:sessionId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_COMPLETE_SESSION })
  @ApiResponse(CodingSessionCompletedResponse)
  async completeSession(@Param('sessionId') sessionId: string, @CurrentUser('id') userId: string) {
    return {
      message: CODING_SESSION_COMPLETED,
      data: await this.codingService.completeSession(sessionId, userId),
    };
  }

  @ApiBearerAuth()
  @Get('sessions')
  @HttpCode(200)
  @ApiOperation({ summary: ApiOperationEnum.CODING_GET_HISTORY })
  @ApiResponse(CodingSessionHistoryResponse)
  async getSessionHistory(
    @CurrentUser('id') userId: string,
    @Query() dto: CodingSessionHistoryDto
  ) {
    return {
      message: CODING_SESSIONS_FETCHED,
      data: await this.codingService.getSessionHistory(userId, dto),
    };
  }
}
