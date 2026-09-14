import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProxyPayment } from './proxy-payment.entity';
import { ProxyPaymentsService } from './proxy-payments.service';
import { ProxyPaymentsController } from './proxy-payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProxyPayment])],
  controllers: [ProxyPaymentsController],
  providers: [ProxyPaymentsService],
  exports: [ProxyPaymentsService, TypeOrmModule],
})
export class ProxyPaymentsModule {}
