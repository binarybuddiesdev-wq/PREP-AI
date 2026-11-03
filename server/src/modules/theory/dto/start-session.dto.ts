import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  Max,
  ValidateIf,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  IsMongoId,
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

  @ApiPropertyOptional({
    type: [String],
    description: 'One to five owned, ready PDF source IDs. Required for PDF mode.',
  })
  @ValidateIf((dto: StartSessionDto) => dto.mode === 'pdf')
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsMongoId({ each: true })
  pdfIds?: string[];

  @ApiProperty({ enum: ['topic', 'weak', 'pdf'], example: 'topic' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['topic', 'weak', 'pdf'])
  mode!: 'topic' | 'weak' | 'pdf';

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
