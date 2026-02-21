import { IsString } from 'class-validator';

export class AddSongByUrlDto {
  @IsString()
  youtubeUrl: string;
}
