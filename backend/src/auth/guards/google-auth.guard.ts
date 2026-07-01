import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
 
// Usado tanto para /auth/google (início do login) como para
// /auth/google/callback — a GoogleStrategy trata da distinção internamente.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      accessType: 'offline',
      prompt: 'consent',
    });
  }
}