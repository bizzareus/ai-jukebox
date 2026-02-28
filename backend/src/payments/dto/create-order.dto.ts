import { IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  songId: string;

  @IsString()
  venueId: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerMobile?: string;

  @IsString()
  @IsOptional()
  dedicationMessage?: string;
}
