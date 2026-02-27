import { IsString, MinLength } from 'class-validator';

export class AddGlobalByPlaylistDto {
  @IsString()
  @MinLength(1, { message: 'Playlist ID or URL is required' })
  youtubePlaylistId: string;
}
