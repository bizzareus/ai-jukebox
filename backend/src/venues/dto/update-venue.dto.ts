import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pricePerSong?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Allow()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  pricingEnabled?: boolean;

  /** Optional logo URL for venue branding (e.g. QR code overlay). */
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;
}
