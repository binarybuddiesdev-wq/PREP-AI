import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsLowercase, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateTopicDto {

    @ApiProperty({ example: 'React', description: 'Display name of the topic' })
    @IsNotEmpty()
    @IsString()
    name!: string;

    @ApiProperty({ example: 'react', description: 'URL-friendly slug (lowercase)' })
    @IsNotEmpty()
    @IsString()
    @IsLowercase()
    slug!: string;

    @ApiProperty({ example: 'practice', enum: ['practice', 'coding'], description: 'Topic category' })
    @IsNotEmpty()
    @IsString()
    @IsIn(['practice', 'coding'])
    category!: string;

    @ApiProperty({ example: '⚡', description: 'Optional emoji icon', required: false })
    @IsOptional()
    @IsString()
    icon?: string;

}
