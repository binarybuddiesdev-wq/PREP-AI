import { IsString, IsNotEmpty, IsIn, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartSessionDto {

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'MongoDB Topic ID. Required for topic mode.' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiProperty({ enum: ['topic', 'weak', 'pdf'], example: 'topic' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['topic', 'weak', 'pdf'])
  mode!: string;

  @ApiProperty({ enum: ['Junior', 'Mid', 'Senior'], example: 'Mid' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['Junior', 'Mid', 'Senior'])
  difficulty!: string;

  @ApiProperty({ example: 10, description: 'Number of questions. Max: 10 (free), 30 (premium).' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(30)
  totalQuestions!: number;
}
