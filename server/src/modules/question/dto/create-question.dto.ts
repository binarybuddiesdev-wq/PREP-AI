import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateQuestionDto {

    @ApiProperty({ example: 'What is the difference between useEffect and useLayoutEffect?', description: 'The question text' })
    @IsNotEmpty()
    @IsString()
    question!: string;

    @ApiProperty({ example: '60f7b2c1e4b0a1234567890a', description: 'Topic ID the question belongs to' })
    @IsNotEmpty()
    @IsString()
    topicId!: string;

    @ApiProperty({ example: 'Mid', enum: ['Junior', 'Mid', 'Senior'], description: 'Question difficulty level' })
    @IsNotEmpty()
    @IsString()
    @IsIn(['Junior', 'Mid', 'Senior'])
    difficulty!: string;

    @ApiPropertyOptional({ example: 'useEffect runs after render, useLayoutEffect runs synchronously before paint', description: 'Model answer for AI comparison' })
    @IsOptional()
    @IsString()
    referenceAnswer?: string;

}
