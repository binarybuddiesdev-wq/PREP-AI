import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsLowercase, IsOptional, IsString } from 'class-validator';

export class UpdateTopicDto {

    @ApiPropertyOptional({ example: 'React.js', description: 'Display name of the topic' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'react-js', description: 'URL-friendly slug (lowercase)' })
    @IsOptional()
    @IsString()
    @IsLowercase()
    slug?: string;

    @ApiPropertyOptional({ example: 'practice', enum: ['practice', 'coding'], description: 'Topic category' })
    @IsOptional()
    @IsString()
    @IsIn(['practice', 'coding'])
    category?: string;

    @ApiPropertyOptional({ example: '⚛️', description: 'Optional emoji icon' })
    @IsOptional()
    @IsString()
    icon?: string;

}
