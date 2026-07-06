import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateQuestionDto {

    @ApiPropertyOptional({ example: 'What is the difference between useEffect and useLayoutEffect?', description: 'Updated question text' })
    @IsString()
    @IsOptional()
    question?: string;

    @ApiPropertyOptional({ example: '6a4a626a5297951e05388165', description: 'Updated topic ID' })
    @IsString()
    @IsOptional()
    topicId?: string;

    @ApiPropertyOptional({ example: 'Senior', enum: ['Junior', 'Mid', 'Senior'], description: 'Updated difficulty level' })
    @IsString()
    @IsOptional()
    @IsIn(['Junior', 'Mid', 'Senior'])
    difficulty?: string;

    @ApiPropertyOptional({ example: 'useEffect runs after render...', description: 'Updated reference answer' })
    @IsString()
    @IsOptional()
    referenceAnswer?: string;

}