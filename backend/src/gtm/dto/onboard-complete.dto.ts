import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardCompleteDto {
  @IsUUID()
  conversationId: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  venueName: string;

  /** Price per song in ₹ (paise not used here). 0 = free. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerSong: number;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
