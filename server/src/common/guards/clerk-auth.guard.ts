import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator.js';
import { PrismaService } from '@/prisma/prisma.service.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) { }

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

    try {
      const secretKey = process.env.CLERK_SECRET_KEY;
      const client = createClerkClient({ secretKey });
      const payload = await client.verifyToken(token);

      const clerkUserId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { clerkUserId },
      });

      request.user = {
        id: clerkUserId,
        email: user?.email ?? (payload as Record<string, unknown>).email as string ?? '',
        role: user?.role ?? 'USER',
      };
      return true;
    } catch (error) {
      this.logger.error('Clerk token verification failed', error);
      throw new UnauthorizedException('Invalid session token');
    }
  }
}
