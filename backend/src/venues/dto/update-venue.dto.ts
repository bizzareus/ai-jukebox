import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateVenueDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerSong?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;
}
