import {
  Body,
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
import { ReplayDto } from './dto/replay.dto';
import { FreeQueueDto } from './dto/free-queue.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('free-request')
  freeRequest(@Body() dto: FreeQueueDto) {
    return this.queueService.enqueueFreeRequest(dto);
  }

  @Get(':venueId')
  getQueue(@Param('venueId') venueId: string) {
    return this.queueService.getQueueWithEta(venueId);
  }

  @Get(':venueId/now-playing')
  getNowPlaying(@Param('venueId') venueId: string) {
    return this.queueService.getNowPlaying(venueId);
  }

  @Get(':venueId/history/daily-stats')
  @UseGuards(JwtAuthGuard)
  getHistoryDailyStats(
    @Param('venueId') venueId: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? parseInt(days, 10) : 30;
    const n = Number.isFinite(parsed) ? parsed : 30;
    return this.queueService.getDailyPlayCounts(venueId, n);
  }

  @Get(':venueId/history')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @Param('venueId') venueId: string,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    const n = Number.isFinite(parsed) ? parsed : undefined;
    return this.queueService.getHistory(venueId, date, n);
  }

  @Get(':venueId/recent-plays')
  @UseGuards(JwtAuthGuard)
  getRecentPlays(
    @Param('venueId') venueId: string,
    @Query('limit') limit?: string,
  ) {
    return this.queueService.getRecentPlays(
      venueId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Post('replay')
  @UseGuards(JwtAuthGuard)
  replay(@CurrentAdmin() admin: Admin, @Body() dto: ReplayDto) {
    return this.queueService.replay(admin.venueId, dto.songId, dto.mode);
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
