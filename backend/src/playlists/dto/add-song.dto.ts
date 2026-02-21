import { IsInt, IsOptional, IsString } from 'class-validator';

export class AddSongDto {
  @IsString()
  youtubeVideoId: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
