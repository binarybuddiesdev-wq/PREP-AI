import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  Max,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MAX_TOPIC_ID_LENGTH = 64;

export class StartSessionDto {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'MongoDB Topic ID. Required for topic mode.',
  })
  @ValidateIf((dto: StartSessionDto) => dto.mode === 'topic')
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TOPIC_ID_LENGTH)
  topicId?: string;

  @ApiProperty({ enum: ['topic', 'weak'], example: 'topic' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['topic', 'weak'])
  mode!: 'topic' | 'weak';

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
