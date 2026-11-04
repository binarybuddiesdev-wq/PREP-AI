import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiRoutes, ClerkAuthGuard, CurrentUser, RolesGuard } from '@/common/index.js';
import { PdfService } from './pdf.service.js';
import { PdfListDto } from './dto/pdf-list.dto.js';
import { requireIdempotencyKey } from '@/common/idempotency/index.js';

@ApiTags('PDF Study')
@ApiBearerAuth()
@Controller(ApiRoutes.PDFS)
@UseGuards(ClerkAuthGuard, RolesGuard)
export class PdfController {
  constructor(private readonly pdfs: PdfService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Upload a study PDF for asynchronous indexing' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'PDF accepted for indexing' })
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    const key = requireIdempotencyKey(idempotencyKey);
    let file;
    try {
      file = await request.file();
      if (!file) throw new BadRequestException('PDF file is required');
      if (file.fieldname !== 'file') {
        throw new BadRequestException('Upload the PDF using the multipart field named "file"');
      }
      const buffer = await file.toBuffer();
      const data = await this.pdfs.upload(buffer, file.filename, file.mimetype, userId, key);
      return { message: 'PDF upload accepted', data };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE'
      ) {
        throw new BadRequestException('PDF exceeds the configured file size limit');
      }
      throw error;
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List the authenticated user’s PDF sources' })
  async list(@CurrentUser('id') userId: string, @Query() dto: PdfListDto) {
    return { message: 'PDF sources fetched', data: await this.pdfs.list(userId, dto.limit) };
  }

  @Get(':pdfId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the status of an owned PDF source' })
  async get(@Param('pdfId') pdfId: string, @CurrentUser('id') userId: string) {
    return { message: 'PDF source fetched', data: await this.pdfs.get(pdfId, userId) };
  }

  @Get(':pdfId/content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Read the authenticated user’s ready PDF source' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Private PDF bytes',
    content: { 'application/pdf': {} },
  })
  async content(
    @Param('pdfId') pdfId: string,
    @CurrentUser('id') userId: string,
    @Res() reply: FastifyReply
  ) {
    const content = await this.pdfs.getContent(pdfId, userId);
    return reply
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Disposition', 'inline; filename="document.pdf"')
      .type('application/pdf')
      .send(content);
  }

  @Post(':pdfId/reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @ApiOperation({ summary: 'Rebuild the searchable index for an owned PDF' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'PDF reindex accepted' })
  async reindex(
    @Param('pdfId') pdfId: string,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    return {
      message: 'PDF reindex queued',
      data: await this.pdfs.reindex(pdfId, userId, idempotencyKey),
    };
  }

  @Delete(':pdfId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Revoke a PDF from retrieval and queue deletion' })
  async delete(@Param('pdfId') pdfId: string, @CurrentUser('id') userId: string) {
    return { message: 'PDF deletion queued', data: await this.pdfs.delete(pdfId, userId) };
  }
}
