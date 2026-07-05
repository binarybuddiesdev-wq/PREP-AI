import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetTopicBySlugDto {

    @ApiProperty({ example: 'react', description: 'Topic slug' })
    @IsString()
    slug!: string;

}
