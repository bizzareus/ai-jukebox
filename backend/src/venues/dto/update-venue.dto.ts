import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVenueDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  upiVpa?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerSong?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;
}
