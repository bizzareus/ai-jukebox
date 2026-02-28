import { IsString, IsUUID } from 'class-validator';

export class ImportCollectionDto {
  @IsString()
  @IsUUID()
  globalPlaylistId: string;
}
