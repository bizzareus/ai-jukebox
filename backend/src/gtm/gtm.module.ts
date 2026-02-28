import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GtmLead } from './gtm-lead.entity';
import { GtmService } from './gtm.service';
import { GtmController } from './gtm.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GtmLead]), ConfigModule],
  controllers: [GtmController],
  providers: [GtmService],
  exports: [GtmService],
})
export class GtmModule {}
