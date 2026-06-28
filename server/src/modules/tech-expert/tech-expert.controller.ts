import { Controller, Post, Body, UsePipes, HttpCode } from '@nestjs/common';
import { TechExpertService } from './tech-expert.service.js';
import { ITechExpertResponse, techExpertRequestSchema, TechExpertRequestDto, TechExpertResponseDto } from './tech-expert.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Tech Expert')
@Controller('tech-expert')
export class TechExpertController {
  constructor(private readonly techExpertService: TechExpertService) { }

  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(techExpertRequestSchema))
  @ApiOperation({ summary: 'Ask any technology-related question - programming, cloud, AI/ML, databases, DevOps, and more' })
  @ApiBody({ type: TechExpertRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Successful AI response about technology topics',
    type: TechExpertResponseDto,
  })
  public async ask(@Body() body: TechExpertRequestDto): Promise<ITechExpertResponse> {
    return this.techExpertService.askQuestion(body);
  }
}
