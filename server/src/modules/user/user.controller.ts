import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { UserService } from './user.service.js';
import {
    ApiTags as ApiTagsEnum,
    ApiOperation as ApiOperationEnum,
    ApiRoutes,
    CurrentUser,
    Roles,
    UserMeResponse,
    GetSettingsResponse,
    UpdateSettingsResponse,
    SetupCompleteResponse,
    GetUserResponse,
    GET_ME_SUCCESS,
    GET_SETTINGS_SUCCESS,
    UPDATE_SETTINGS_SUCCESS,
    SETUP_COMPLETE_SUCCESS,
    GET_USER_SUCCESS,
    ERROR_MESSAGES,
    ClerkAuthGuard,
    RolesGuard,
} from '@/common/index.js';

@ApiTags(ApiTagsEnum.USERS)
@Controller(ApiRoutes.USERS)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class UserController {

    constructor(
        @InjectPinoLogger(UserController.name)
        private readonly logger: PinoLogger,
        private readonly userService: UserService,
    ) { }

    @ApiBearerAuth()
    @Get('me')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.USER_GET_ME })
    @ApiResponse(UserMeResponse)
    async me(@CurrentUser('id') userId: string) {
        this.logger.debug({ userId }, 'Get me request received');
        const data = await this.userService.findOrCreateUser(userId);
        return { message: GET_ME_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Get('settings')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.USER_GET_SETTINGS })
    @ApiResponse(GetSettingsResponse)
    async getSettings(@CurrentUser('id') userId: string) {
        this.logger.debug({ userId }, 'Get settings request received');
        await this.userService.findOrCreateUser(userId);
        const data = await this.userService.getSettings(userId);
        return { message: GET_SETTINGS_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Patch('settings')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.USER_UPDATE_SETTINGS })
    @ApiResponse(UpdateSettingsResponse)
    async updateSettings(
        @CurrentUser('id') userId: string,
        @Body() body: { profile?: Record<string, unknown>; preferences?: Record<string, unknown>; notifications?: Record<string, unknown> },
    ) {
        this.logger.debug({ userId }, 'Update settings request received');
        await this.userService.findOrCreateUser(userId);
        const data = await this.userService.upsertSettings(userId, body);
        return { message: UPDATE_SETTINGS_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Patch('setup-complete')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.USER_SETUP_COMPLETE })
    @ApiResponse(SetupCompleteResponse)
    async setupComplete(@CurrentUser('id') userId: string) {
        this.logger.debug({ userId }, 'Setup complete request received');
        const data = await this.userService.findOrCreateUser(userId);
        if (data) {
            await this.userService.markSetupComplete(userId);
        }
        return { message: SETUP_COMPLETE_SUCCESS, data };
    }

    @ApiBearerAuth()
    @Roles('ADMIN')
    @Get(':clerkUserId')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperationEnum.USER_GET_BY_ID })
    @ApiResponse(GetUserResponse)
    async getUserByClerkId(@Param('clerkUserId') clerkUserId: string) {
        this.logger.debug({ clerkUserId }, 'Get user by ID request received');
        const data = await this.userService.findByClerkId(clerkUserId);
        if (!data) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        return { message: GET_USER_SUCCESS, data };
    }
}
