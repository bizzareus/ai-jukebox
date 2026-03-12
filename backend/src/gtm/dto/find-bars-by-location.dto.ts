import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindBarsByLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  /** 0 = first page (center), 1+ = offset center for more results (max 20 per page). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  page?: number;
}
