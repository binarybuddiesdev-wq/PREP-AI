import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class GetQuestionsDto {

    @ApiProperty({ example: '6a4a626a5297951e05388165', description: 'Topic ID to filter questions by' })
    @IsNotEmpty()
    @IsString()
    topicId!: string;

    @ApiProperty({ example: 'Mid', enum: ['Junior', 'Mid', 'Senior'], description: 'Difficulty level to filter questions by' })
    @IsNotEmpty()
    @IsString()
    @IsIn(['Junior', 'Mid', 'Senior'])
    difficulty!: string;

}
