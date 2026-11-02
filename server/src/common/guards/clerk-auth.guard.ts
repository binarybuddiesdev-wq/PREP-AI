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
import { USER_DATABASE_UNAVAILABLE } from '@/common/constants/api.constants.js';
import { PrismaService } from '@/prisma/prisma.service.js';

const USER_LOOKUP_TIMEOUT_MS = 4_000;

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
    let lookupTimeout: ReturnType<typeof setTimeout> | undefined;
    const userLookup = this.prisma.user.findUnique({ where: { clerkUserId } });
    const user = await Promise.race([
      userLookup,
      new Promise<never>((_, reject) => {
        lookupTimeout = setTimeout(
          () => reject(new UserLookupTimeoutError()),
          USER_LOOKUP_TIMEOUT_MS
        );
      }),
    ])
      .catch((error: unknown) => {
        if (error instanceof UserLookupTimeoutError || isMongoServerUnavailable(error)) {
          throw new ServiceUnavailableException(USER_DATABASE_UNAVAILABLE, {
            cause: error,
          });
        }
        throw error;
      })
      .finally(() => {
        if (lookupTimeout) clearTimeout(lookupTimeout);
      });

    request.user = {
      id: clerkUserId,
      email: user?.email ?? ((payload as Record<string, unknown>).email as string) ?? '',
      role: user?.role ?? 'USER',
    };
    return true;
  }
}

class UserLookupTimeoutError extends Error {
  constructor() {
    super(`User profile lookup exceeded ${USER_LOOKUP_TIMEOUT_MS}ms`);
    this.name = 'UserLookupTimeoutError';
  }
}

const isMongoServerUnavailable = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;

  const databaseError = error as { code?: unknown; meta?: { message?: unknown } };
  if (databaseError.code === 'P1001' || databaseError.code === 'P1002') return true;
  return (
    databaseError.code === 'P2010' &&
    typeof databaseError.meta?.message === 'string' &&
    /server selection timeout|no available servers/i.test(databaseError.meta.message)
  );
};
