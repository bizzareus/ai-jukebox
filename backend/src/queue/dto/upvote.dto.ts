import { IsString, IsNotEmpty } from 'class-validator';

export class UpvoteDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
