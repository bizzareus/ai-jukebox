import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VenuesService } from './venues.service';
import { AuthService } from '../auth/auth.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { AddVenueAdminDto } from './dto/add-venue-admin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin, AdminRole } from '../auth/admin.entity';
import { ImportCollectionDto } from '../playlists/dto/import-collection.dto';
import { PlaylistsService } from '../playlists/playlists.service';
import { QueueService } from '../queue/queue.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venuesService: VenuesService,
    private readonly authService: AuthService,
    private readonly playlistsService: PlaylistsService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  create(@Body() dto: CreateVenueDto, @CurrentAdmin() admin: Admin) {
    return this.venuesService.create(dto, admin.id);
  }

  @Get(':id/admins')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getAdmins(@Param('id') venueId: string) {
    return this.authService.findByVenueId(venueId);
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

  @Get('by-id/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  findById(@Param('id') id: string) {
    return this.venuesService.findById(id);
  }

  @Get(':id/recent-customers')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getRecentCustomers(
    @Param('id') venueId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit
      ? Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
      : 50;
    return this.queueService.getRecentCustomers(venueId, n);
  }

  @Get(':slug/songs/popular')
  getPopularSongs(@Param('slug') slug: string) {
    return this.venuesService
      .findBySlug(slug)
      .then((venue) =>
        this.playlistsService.getPopularSongsForVenue(venue.id, 20),
      );
  }

  @Get(':slug/songs/most-played')
  getMostPlayedSongs(@Param('slug') slug: string) {
    return this.venuesService
      .findBySlug(slug)
      .then((venue) => this.queueService.getMostPlayedSongs(venue.id, 20));
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

  @Post(':id/playlists/import-collection')
  @UseGuards(JwtAuthGuard)
  async importCollection(
    @Param('id') venueId: string,
    @Body() dto: ImportCollectionDto,
    @CurrentAdmin() admin: Admin,
  ) {
    const canImport =
      admin.role === AdminRole.SUPER_ADMIN || admin.venueId === venueId;
    if (!canImport) {
      throw new ForbiddenException('You can only import to your own venue');
    }
    return this.playlistsService.importGlobalCollectionToVenue(
      venueId,
      dto.globalPlaylistId,
    );
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
