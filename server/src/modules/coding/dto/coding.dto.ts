import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CODING_LANGUAGES = ['javascript', 'typescript', 'python'] as const;
export type CodingLanguage = (typeof CODING_LANGUAGES)[number];

export class ListCodingProblemsDto {
  @ApiPropertyOptional({ example: 'Arrays' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @ApiPropertyOptional({ enum: ['Easy', 'Medium', 'Hard'] })
  @IsOptional()
  @IsIn(['Easy', 'Medium', 'Hard'])
  difficulty?: string;
}

export class StartCodingSessionDto {
  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  problemIds?: string[];
}

export class ExecuteCodingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  problemId!: string;

  @ApiProperty({ enum: CODING_LANGUAGES })
  @IsIn(CODING_LANGUAGES)
  language!: CodingLanguage;

  @ApiProperty({ maxLength: 32000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32000)
  code!: string;
}

export class CodingSessionHistoryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
