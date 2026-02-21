import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get(':venueId')
  getQueue(@Param('venueId') venueId: string) {
    return this.queueService.getQueueWithEta(venueId);
  }

  @Get(':venueId/now-playing')
  getNowPlaying(@Param('venueId') venueId: string) {
    return this.queueService.getNowPlaying(venueId);
  }

  @Get(':venueId/history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Param('venueId') venueId: string, @Query('date') date?: string) {
    return this.queueService.getHistory(venueId, date);
  }

  @Post('advance')
  @UseGuards(JwtAuthGuard)
  advance(@CurrentAdmin() admin: Admin) {
    return this.queueService.advanceQueue(admin.venueId);
  }

  @Post(':itemId/play')
  @UseGuards(JwtAuthGuard)
  markPlaying(@Param('itemId') itemId: string) {
    return this.queueService.markPlaying(itemId);
  }

  @Post(':itemId/skip')
  @UseGuards(JwtAuthGuard)
  skip(@Param('itemId') itemId: string) {
    return this.queueService.skip(itemId);
  }
}
