import { Type } from 'class-transformer';
import { IsString, IsArray, ValidateNested, IsOptional, IsIn, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ClerkEmail {
  @ApiProperty({ example: 'john@gmail.com' })
  @IsString()
  email_address!: string;
}

export class ClerkUserDataDto {
  @ApiProperty({ example: 'user_abc123' })
  @IsString()
  id!: string;

  @ApiProperty({ type: [ClerkEmail] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClerkEmail)
  email_addresses!: ClerkEmail[];

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ example: 'https://lh3.googleusercontent.com/...', required: false })
  @IsOptional()
  @IsString()
  image_url?: string;
}

export class ClerkWebhookEventDto {
  @ApiProperty({ example: 'event' })
  @IsString()
  @IsObject()
  object!: string;

  @ApiProperty({ example: 'user.created', enum: ['user.created', 'user.updated', 'user.deleted'] })
  @IsString()
  @IsIn(['user.created', 'user.updated', 'user.deleted'])
  type!: string;

  @ApiProperty({ type: ClerkUserDataDto })
  @ValidateNested()
  @Type(() => ClerkUserDataDto)
  data!: ClerkUserDataDto;
}
