import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { AddVenueAdminDto } from './dto/add-venue-admin.dto';
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

  @Post(':id/admins')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  addAdmin(@Param('id') venueId: string, @Body() dto: AddVenueAdminDto) {
    return this.venuesService.addAdminToVenue(
      venueId,
      dto.email,
      dto.password,
      dto.name,
    );
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentAdmin() admin: Admin) {
    return this.venuesService.findByOwner(admin.id);
  }

  /** Venue admin: get the venue they manage (by admin.venueId). */
  @Get('current')
  @UseGuards(JwtAuthGuard)
  async current(@CurrentAdmin() admin: Admin) {
    if (!admin.venueId) throw new ForbiddenException('No venue assigned');
    return this.venuesService.findById(admin.venueId);
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
  async update(
    @Param('id') id: string,
    @Body() body: UpdateVenueDto,
    @CurrentAdmin() admin: Admin,
  ) {
    const isSuperAdmin = admin.role === 'super_admin';
    if (!isSuperAdmin && admin.venueId !== id) {
      throw new ForbiddenException('You can only update your own venue');
    }
    return this.venuesService.update(id, body);
  }
}
