import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Get('order-status')
  orderStatus(@Query('orderId') orderId: string) {
    return this.paymentsService.getOrderStatus(orderId);
  }

  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  earnings(
    @CurrentAdmin() admin: Admin,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentsService.getVenueEarnings(
      admin.venueId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
