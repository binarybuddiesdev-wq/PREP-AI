import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, ClerkAuthGuard, Roles, RolesGuard, Public } from '@/common/index.js';
import {
  ApiOperation as ApiOperationEnum,
  ApiRoutes,
  ApiTags as ApiTagsEnum,
} from '@/common/constants/api.constants.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { PaymentsService } from './payments.service.js';
import { createSubscriptionSchema } from './dto/create-subscription.schema.js';

@ApiTags(ApiTagsEnum.PAYMENTS)
@Controller(ApiRoutes.PAYMENTS)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', maxLength: 200 },
  })
  @ApiOperation({ summary: ApiOperationEnum.PAYMENT_START_SUBSCRIPTION })
  async createSubscription(
    @Body(new ZodValidationPipe(createSubscriptionSchema)) body: unknown,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey?: string
  ) {
    const data = await this.payments.startSubscription(
      userId,
      body as { plan: 'monthly' | 'yearly' },
      idempotencyKey
    );
    return { message: 'Subscription request accepted', data };
  }

  @ApiBearerAuth()
  @Get('subscriptions/current')
  @ApiOperation({ summary: ApiOperationEnum.PAYMENT_GET_CURRENT_SUBSCRIPTION })
  async getCurrentSubscription(@CurrentUser('id') userId: string) {
    const data = await this.payments.getCurrentSubscription(userId);
    return { message: 'Current subscription fetched', data };
  }

  @ApiBearerAuth()
  @Post('subscriptions/current/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: ApiOperationEnum.PAYMENT_CANCEL_SUBSCRIPTION })
  async cancelCurrentSubscription(@CurrentUser('id') userId: string) {
    const data = await this.payments.cancelCurrentSubscription(userId);
    return { message: 'Subscription cancellation scheduled', data };
  }

  @ApiBearerAuth()
  @Post('charges/:chargeId/refund')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: ApiOperationEnum.PAYMENT_REFUND_CHARGE })
  async refundCharge(@Param('chargeId') chargeId: string, @CurrentUser('id') adminUserId: string) {
    const data = await this.payments.initiateFullRefund(chargeId, adminUserId);
    return { message: 'Full refund requested', data };
  }
}

@ApiTags(ApiTagsEnum.PAYMENT_WEBHOOKS)
@Controller(ApiRoutes.WEBHOOKS)
export class RazorpayWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: ApiOperationEnum.PAYMENT_RECEIVE_RAZORPAY_WEBHOOK })
  async receiveRazorpayWebhook(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string
  ) {
    const data = await this.payments.acceptWebhook(request.rawBody, signature, eventId);
    return { message: 'Razorpay webhook accepted', data };
  }
}
