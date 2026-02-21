import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';
import { PlaylistsService } from '../playlists/playlists.service';
import { QueueService } from '../queue/queue.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venuesService: VenuesService,
    private readonly playlistsService: PlaylistsService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  create(@Body() dto: CreateVenueDto, @CurrentAdmin() admin: Admin) {
    return this.venuesService.create(dto, admin.id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentAdmin() admin: Admin) {
    return this.venuesService.findByOwner(admin.id);
  }

  @Get(':slug/songs/popular')
  getPopularSongs(@Param('slug') slug: string) {
    return this.venuesService.findBySlug(slug).then((venue) =>
      this.playlistsService.getPopularSongsForVenue(venue.id, 20),
    );
  }

  @Get(':slug/songs/most-played')
  getMostPlayedSongs(@Param('slug') slug: string) {
    return this.venuesService.findBySlug(slug).then((venue) =>
      this.queueService.getMostPlayedSongs(venue.id, 20),
    );
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.venuesService.findBySlug(slug);
  }

  @Post(':id/qr-code')
  @UseGuards(JwtAuthGuard)
  refreshQr(@Param('id') id: string) {
    return this.venuesService.refreshQrCode(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: Partial<Admin>) {
    return this.venuesService.update(id, body);
  }
}
