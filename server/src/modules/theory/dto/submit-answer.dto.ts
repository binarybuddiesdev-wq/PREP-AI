import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const MAX_QUESTION_ID_LENGTH = 64;
const MAX_QUESTION_TEXT_LENGTH = 2000;
const MAX_USER_ANSWER_LENGTH = 8000;

export class SubmitAnswerDto {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439022',
    description: 'MongoDB Question ID. Null for AI-generated questions.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUESTION_ID_LENGTH)
  questionId?: string;

  @ApiProperty({
    example: 'What is the difference between useEffect and useLayoutEffect?',
    description: 'The question text',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_QUESTION_TEXT_LENGTH)
  questionText!: string;

  @ApiProperty({
    example: 'useEffect runs after the browser paints...',
    description: "User's text answer",
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_USER_ANSWER_LENGTH)
  userAnswer!: string;

  @ApiPropertyOptional({ example: 120, description: 'Time taken in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  timeTaken?: number;
}
