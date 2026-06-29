import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmStripeDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
