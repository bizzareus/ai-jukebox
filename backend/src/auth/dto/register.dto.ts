import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminRole } from '../admin.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @IsString()
  @IsOptional()
  venueId?: string;

  /** Invite token from GTM onboarding link; when present, a venue is created and admin is assigned. */
  @IsString()
  @IsOptional()
  invite?: string;
}
