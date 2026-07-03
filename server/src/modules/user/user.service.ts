import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadRequestException, Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/clerk-sdk-node';

import { ERROR_MESSAGES } from '@/common/index.js';
import { ClerkUserDataDto } from './dto/index.js';

@Injectable()
export class UserService {

    constructor(private readonly prisma: PrismaService,
        @InjectPinoLogger(UserService.name) private readonly logger: PinoLogger
    ) { }

    async createUser(dto: ClerkUserDataDto) {
        const { email_addresses, id, first_name, last_name, image_url } = dto;

        if (!email_addresses || email_addresses.length === 0) {
            throw new BadRequestException('User must have at least one email address');
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { clerkUserId: id },
        });

        if (existingUser) {
            this.logger.info({ userId: existingUser.id }, 'User already exists, returning existing');
            return existingUser;
        }

        const user = await this.prisma.user.create({
            data: {
                clerkUserId: id,
                email: email_addresses[0].email_address,
                name: `${first_name ?? ''} ${last_name ?? ''}`.trim(),
                avatarUrl: image_url,
                role: 'USER',
                isNewUser: true,
            },
        });

        this.logger.info({ userId: user.id }, 'User registered successfully');
        return user;
    }

    async findByClerkId(clerkUserId: string) {
        return this.prisma.user.findUnique({
            where: { clerkUserId },
        });
    }

    async findOrCreateUser(clerkUserId: string) {
        const existing = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (existing) {
            return existing;
        }

        this.logger.info({ clerkUserId }, 'User not found in DB, fetching from Clerk');

        const secretKey = process.env['CLERK_SECRET_KEY'];
        const client = createClerkClient({ secretKey });
        const clerkUser = await client.users.getUser(clerkUserId);

        const primaryEmail = clerkUser.emailAddresses?.find(
            (e) => e.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress ?? '';

        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
        const avatarUrl = (clerkUser as unknown as Record<string, string>).image_url ?? null;

        const user = await this.prisma.user.create({
            data: {
                clerkUserId,
                email: primaryEmail,
                name,
                avatarUrl,
                role: 'USER',
                isNewUser: true,
            },
        });

        this.logger.info({ userId: user.id }, 'User created via lazy sync');
        return user;
    }

    async updateUser(clerkUserId: string, data: { email?: string; name?: string; avatarUrl?: string }) {
        const user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            this.logger.warn({ clerkUserId }, 'User not found for update');
            return null;
        }

        const updated = await this.prisma.user.update({
            where: { clerkUserId },
            data,
        });

        this.logger.info({ userId: updated.id }, 'User updated');
        return updated;
    }

    async deleteUser(clerkUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            this.logger.warn({ clerkUserId }, 'User not found for deletion');
            return null;
        }

        await this.prisma.userSettings.deleteMany({
            where: { userId: user.id },
        });

        await this.prisma.user.delete({
            where: { clerkUserId },
        });

        this.logger.info({ userId: user.id }, 'User deleted');
        return user;
    }

    async markSetupComplete(clerkUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            this.logger.warn({ clerkUserId }, 'User not found for setup completion');
            return null;
        }

        const updated = await this.prisma.user.update({
            where: { clerkUserId },
            data: { isNewUser: false },
        });

        this.logger.info({ userId: updated.id }, 'Setup marked complete');
        return updated;
    }

    async getSettings(clerkUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            this.logger.warn({ clerkUserId }, 'User not found for settings');
            return null;
        }

        const settings = await this.prisma.userSettings.findUnique({
            where: { userId: user.id },
        });

        return settings;
    }

    async upsertSettings(
        clerkUserId: string,
        data: { profile?: Record<string, unknown>; preferences?: Record<string, unknown>; notifications?: Record<string, unknown> },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            this.logger.warn({ clerkUserId }, 'User not found for settings upsert');
            return null;
        }

        const createData: Prisma.UserSettingsUncheckedCreateInput = {
            userId: user.id,
        };
        if (data.profile !== undefined) createData.profile = data.profile as Prisma.InputJsonValue;
        if (data.preferences !== undefined) createData.preferences = data.preferences as Prisma.InputJsonValue;
        if (data.notifications !== undefined) createData.notifications = data.notifications as Prisma.InputJsonValue;

        const updateData: Prisma.UserSettingsUncheckedUpdateInput = {};
        if (data.profile !== undefined) updateData.profile = data.profile as Prisma.InputJsonValue;
        if (data.preferences !== undefined) updateData.preferences = data.preferences as Prisma.InputJsonValue;
        if (data.notifications !== undefined) updateData.notifications = data.notifications as Prisma.InputJsonValue;

        const settings = await this.prisma.userSettings.upsert({
            where: { userId: user.id },
            create: createData,
            update: updateData,
        });

        this.logger.info({ userId: user.id }, 'Settings upserted');
        return settings;
    }
}
