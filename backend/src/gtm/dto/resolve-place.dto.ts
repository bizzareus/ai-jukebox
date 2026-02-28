import { IsString, MinLength } from 'class-validator';

export class ResolvePlaceDto {
  @IsString()
  @MinLength(10)
  mapsUrl: string;
}
