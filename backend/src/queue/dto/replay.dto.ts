import { IsIn, IsString } from 'class-validator';

export class ReplayDto {
  @IsString()
  songId: string;

  @IsIn(['immediate', 'queue_next'])
  mode: 'immediate' | 'queue_next';
}
