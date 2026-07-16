import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkTokenVerifier } from './adapters/clerk-token-verifier';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ITokenVerifier } from './ports/token-verifier.port';

@Module({
  providers: [
    { provide: ITokenVerifier, useClass: ClerkTokenVerifier },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AuthModule {}
