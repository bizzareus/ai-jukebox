import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class UpdateVenueDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerSong?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  /** Optional logo URL for venue branding (e.g. QR code overlay). */
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;
}
