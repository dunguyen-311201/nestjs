import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['authorization'];

    if (token !== 'Bearer mock-token') {
      throw new UnauthorizedException('Missing or invalid token');
    }

    return true;
  }
}
