import { Module } from '@nestjs/common';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { MetricsModule } from '@/modules/metrics/metrics.module.js';
import { AuditModule } from '@/modules/audit/audit.module.js';
import { PaymentsController, RazorpayWebhookController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentReconciliationWorker } from './payment-reconciliation.worker.js';
import { RazorpayProvider } from './razorpay-provider.js';

@Module({
  imports: [JobQueueModule, MetricsModule, AuditModule],
  controllers: [PaymentsController, RazorpayWebhookController],
  providers: [PaymentsService, RazorpayProvider, PaymentReconciliationWorker],
})
export class PaymentsModule {}
