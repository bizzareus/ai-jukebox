import { Controller, Get, Param, Query } from '@nestjs/common';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  /** Public: search by song name, artist, channel (DB + YouTube). Used by customer venue home. */
  @Get('search')
  search(@Query('q') query: string) {
    return this.songsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.songsService.findById(id);
  }
}
