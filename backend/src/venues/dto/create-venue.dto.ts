import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  upiVpa: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  pricePerSong?: number;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsString()
  @IsOptional()
  adminName?: string;
}
