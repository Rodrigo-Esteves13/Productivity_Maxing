import { IsUUID } from 'class-validator';

// Amigo a quem o dono manda o quiz (tem de ser amizade aceite).
export class ShareQuizFriendDto {
  @IsUUID()
  userId!: string;
}
