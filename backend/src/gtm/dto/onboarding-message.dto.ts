import { IsOptional, IsString, MinLength } from 'class-validator';

export class OnboardingMessageDto {
  @IsString()
  @MinLength(1)
  placeName: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}
