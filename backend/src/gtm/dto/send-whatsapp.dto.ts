import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BarItemDto {
  @IsString()
  @MinLength(1)
  phone: string;

  @IsOptional()
  @IsString()
  barName?: string;
}

export class SendWhatsappDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarItemDto)
  bars: BarItemDto[];

  @IsString()
  @MinLength(1)
  message: string;
}
