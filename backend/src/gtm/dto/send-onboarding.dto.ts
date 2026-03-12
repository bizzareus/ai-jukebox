import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendOnboardingDto {
  @IsString()
  placeName: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}
