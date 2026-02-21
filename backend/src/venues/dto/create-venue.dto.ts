import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
