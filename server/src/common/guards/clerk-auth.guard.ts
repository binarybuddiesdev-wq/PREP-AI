import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator.js';
import { PrismaService } from '@/prisma/prisma.service.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new ServiceUnavailableException('Authentication is not configured on this server');
    }
    const client = createClerkClient({ secretKey });
    let payload;

    try {
      payload = await client.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid session token');
    }

    const clerkUserId = payload.sub;
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    request.user = {
      id: clerkUserId,
      email: user?.email ?? ((payload as Record<string, unknown>).email as string) ?? '',
      role: user?.role ?? 'USER',
    };
    return true;
  }
}
