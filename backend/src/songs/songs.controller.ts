import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SongsService } from './songs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('q') query: string) {
    return this.songsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.songsService.findById(id);
  }
}
