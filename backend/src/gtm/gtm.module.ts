import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GtmLead } from './gtm-lead.entity';
import { GtmService } from './gtm.service';
import { GtmController } from './gtm.controller';
import { InviteTokenService } from './invite-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([GtmLead]), ConfigModule],
  controllers: [GtmController],
  providers: [GtmService, InviteTokenService],
  exports: [GtmService, InviteTokenService],
})
export class GtmModule {}
