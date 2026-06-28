import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export const techExpertRequestSchema = z.object({
  question: z.string().min(1, 'Question must not be empty'),
});

export interface ITechExpertRequest {
  question: string;
}

export class TechExpertRequestDto implements ITechExpertRequest {
  @ApiProperty({
    description: 'Ask any technology-related question - programming, cloud, AI/ML, databases, DevOps, etc.',
    example: 'Explain the difference between REST and GraphQL APIs.',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  public question!: string;
}

export const techAnswerSchema = z.object({
  topic: z.string().describe('The main technology topic being explained'),
  summary: z.string().describe('A concise 2-3 sentence summary of the answer'),
  keyPoints: z.array(z.string()).describe('List of key points or takeaways'),
  examples: z.array(z.string()).describe('Practical examples if applicable'),
  relatedTopics: z.array(z.string()).describe('Related technologies or concepts to explore'),
});

export type TechAnswer = z.infer<typeof techAnswerSchema>;

export interface ITechExpertResponseData {
  answer: TechAnswer | null;
  rawResponse: string;
}

export class TechExpertResponseDataDto implements ITechExpertResponseData {
  @ApiProperty({ description: 'Structured answer object', type: Object, nullable: true })
  public answer!: TechAnswer | null;

  @ApiProperty({ description: 'Raw text response from the model', type: String })
  public rawResponse!: string;
}

export interface ITechExpertResponse {
  data: ITechExpertResponseData | null;
  error: string | null;
  meta: Record<string, unknown>;
}

export class TechExpertResponseDto implements ITechExpertResponse {
  @ApiProperty({ type: TechExpertResponseDataDto, nullable: true })
  public data!: TechExpertResponseDataDto | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  public error!: string | null;

  @ApiProperty({ type: Object, example: {} })
  public meta!: Record<string, unknown>;
}
