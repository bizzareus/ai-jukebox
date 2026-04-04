import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FreeQueueDto {
  @IsString()
  @MinLength(1, { message: 'songId must not be empty' })
  songId: string;

  @IsString()
  @MinLength(1, { message: 'venueId must not be empty' })
  venueId: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  customerName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(15, { message: 'customerMobile should be at most 15 characters' })
  customerMobile?: string;
}
