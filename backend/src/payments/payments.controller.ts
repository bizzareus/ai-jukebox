import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin, AdminRole } from '../auth/admin.entity';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  createOrder(
    @Body() dto: CreateOrderDto,
  ): ReturnType<PaymentsService['createOrder']> {
    return this.paymentsService.createOrder(dto);
  }

  @Get('order-status')
  getOrderStatus(
    @Query('orderId') orderId: string | undefined,
  ): ReturnType<PaymentsService['getOrderStatus']> {
    if (!orderId?.trim()) {
      throw new BadRequestException('orderId is required');
    }
    return this.paymentsService.getOrderStatus(orderId.trim());
  }

  @Get('qr-image')
  async proxyQrImage(
    @Query('url') url: string | undefined,
  ): Promise<StreamableFile> {
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('Missing url');
    }
    const { buffer, contentType } =
      await this.paymentsService.proxyQrImage(url);
    return new StreamableFile(buffer, { type: contentType });
  }

  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): ReturnType<PaymentsService['handleWebhook']> {
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  getEarnings(
    @CurrentAdmin() admin: Admin,
    @Query('venueId') venueId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): ReturnType<PaymentsService['getVenueEarnings']> {
    const effectiveVenueId =
      admin.role === AdminRole.SUPER_ADMIN && venueId ? venueId : admin.venueId;
    if (!effectiveVenueId) {
      return Promise.resolve({ payments: [], total: 0, count: 0 });
    }
    return this.paymentsService.getVenueEarnings(
      effectiveVenueId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
