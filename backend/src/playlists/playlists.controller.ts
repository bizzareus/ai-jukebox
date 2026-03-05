import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { AddSongByUrlDto } from './dto/add-song-by-url.dto';
import { AddGlobalByPlaylistDto } from './dto/add-global-by-playlist.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Controller()
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  // Public: customers can view playlists for a venue
  @Get('venues/:venueId/playlists')
  findByVenue(@Param('venueId') venueId: string) {
    return this.playlistsService.findByVenue(venueId);
  }

  // Global library: any authenticated admin can read; super admin can add songs by URL
  @Get('playlists/global')
  @UseGuards(JwtAuthGuard)
  getGlobalPlaylist() {
    return this.playlistsService.getOrCreateGlobalPlaylist();
  }

  @Post('playlists/global/songs')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  addSongToGlobalByUrl(@Body() dto: AddSongByUrlDto) {
    return this.playlistsService.addSongToGlobalByYoutubeUrl(dto.youtubeUrl);
  }

  @Post('playlists/global/songs/by-playlist')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  addSongsToGlobalByPlaylist(@Body() dto: AddGlobalByPlaylistDto) {
    return this.playlistsService.addSongsToGlobalByPlaylistId(
      dto.youtubePlaylistId,
    );
  }

  @Delete('playlists/global/songs/:songId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  removeSongFromGlobal(@Param('songId') songId: string) {
    return this.playlistsService.removeSongFromGlobalPlaylist(songId);
  }

  @Get('playlists/global-collections')
  @UseGuards(JwtAuthGuard)
  getGlobalCollections() {
    return this.playlistsService.findGlobalCollections();
  }

  @Post('playlists/global-collections')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  createGlobalCollection(@Body() dto: CreatePlaylistDto) {
    return this.playlistsService.createGlobalCollection(dto);
  }

  @Post('playlists/global-collections/:id/songs')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  addSongToGlobalCollectionByUrl(
    @Param('id') id: string,
    @Body() dto: AddSongByUrlDto,
  ) {
    return this.playlistsService.addSongToPlaylistByYoutubeUrl(
      id,
      dto.youtubeUrl,
    );
  }

  @Post('playlists/global-collections/:id/songs/by-playlist')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  addYouTubePlaylistToGlobalCollection(
    @Param('id') id: string,
    @Body() dto: AddGlobalByPlaylistDto,
  ) {
    return this.playlistsService.addSongsToPlaylistByYoutubePlaylistId(
      id,
      dto.youtubePlaylistId,
    );
  }

  @Delete('playlists/global-collections/:id/songs/:songId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  removeSongFromGlobalCollection(
    @Param('id') id: string,
    @Param('songId') songId: string,
  ) {
    return this.playlistsService.removeSong(id, songId);
  }

  @Get('playlists/:id')
  findOne(@Param('id') id: string) {
    return this.playlistsService.findById(id);
  }

  // Admin: manage playlists
  @Post('venues/:venueId/playlists')
  @UseGuards(JwtAuthGuard)
  create(@Param('venueId') venueId: string, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(venueId, dto);
  }

  @Patch('playlists/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePlaylistDto>) {
    return this.playlistsService.update(id, dto);
  }

  @Delete('playlists/:id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string) {
    return this.playlistsService.delete(id);
  }

  @Post('playlists/:id/songs')
  @UseGuards(JwtAuthGuard)
  addSong(@Param('id') id: string, @Body() dto: AddSongDto) {
    return this.playlistsService.addSong(id, dto);
  }

  @Delete('playlists/:id/songs/:songId')
  @UseGuards(JwtAuthGuard)
  removeSong(@Param('id') id: string, @Param('songId') songId: string) {
    return this.playlistsService.removeSong(id, songId);
  }
}
