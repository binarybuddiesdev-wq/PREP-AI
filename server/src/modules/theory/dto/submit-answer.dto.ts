import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SubmitAnswerDto {
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439022', description: 'MongoDB Question ID. Null for AI-generated questions.' })
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiProperty({ example: 'What is the difference between useEffect and useLayoutEffect?', description: 'The question text' })
  @IsNotEmpty()
  @IsString()
  questionText!: string;

  @ApiProperty({ example: 'useEffect runs after the browser paints...', description: 'User\'s text answer' })
  @IsNotEmpty()
  @IsString()
  userAnswer!: string;

  @ApiPropertyOptional({ example: 120, description: 'Time taken in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  timeTaken?: number;
}
