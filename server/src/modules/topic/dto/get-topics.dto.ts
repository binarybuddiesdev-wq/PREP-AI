import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from "class-validator";

export class GetTopicsDto {

    @ApiPropertyOptional({ enum: ['practice', 'coding'], description: 'Filter topics by category' })
    @IsOptional()
    @IsIn(['practice', 'coding'])
    category?: string;

}
