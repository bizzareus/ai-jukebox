import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Admin } from './admin.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminsController } from './admins.controller';
import { JwtStrategy } from './jwt.strategy';
import { LoginLinkTokenService } from './login-link-token.service';
import { GtmModule } from '../gtm/gtm.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
    GtmModule,
    forwardRef(() => VenuesModule),
  ],
  controllers: [AuthController, AdminsController],
  providers: [AuthService, JwtStrategy, LoginLinkTokenService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
