import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyChatIdempotencyService } from './study-chat-idempotency.service.js';

describe('StudyChatIdempotencyService', () => {
  let prisma: { studyChatOperation: Record<string, ReturnType<typeof vi.fn>> };
  let service: StudyChatIdempotencyService;

  const input = {
    clerkUserId: 'clerk-user-1',
    userId: 'mongo-user-1',
    scope: 'study-chat:create',
    key: 'create-key-1',
    requestFingerprint: 'fingerprint-1',
    conversationId: '507f1f77bcf86cd799439011',
  };

  const operation = (overrides: Record<string, unknown> = {}) => ({
    id: '507f1f77bcf86cd799439012',
    ...input,
    operationId: 'deterministic-operation-id',
    status: 'PROCESSING',
    leaseToken: 'lease-token-1',
    leaseExpiresAt: new Date('2026-11-03T10:05:00.000Z'),
    response: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      studyChatOperation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => ({ id: operation().id, ...data })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new StudyChatIdempotencyService(prisma as never);
  });

  it('creates a durable claim for a new valid operation key', async () => {
    const result = await service.claim(input, new Date('2026-11-03T10:00:00.000Z'));

    expect(result.kind).toBe('claimed');
    expect(prisma.studyChatOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'mongo-user-1',
        scope: 'study-chat:create',
        requestFingerprint: 'fingerprint-1',
        conversationId: '507f1f77bcf86cd799439011',
        status: 'PROCESSING',
        leaseExpiresAt: new Date('2026-11-03T10:05:00.000Z'),
      }),
    });
  });

  it('omits conversation scope when claiming a create operation without a conversation id', async () => {
    const { conversationId: _conversationId, ...createInput } = input;

    await service.claim(createInput, new Date('2026-11-03T10:00:00.000Z'));

    expect(prisma.studyChatOperation.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ conversationId: expect.anything() }),
    });
  });

  it('rejects reuse of an operation key with a different fingerprint', async () => {
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ requestFingerprint: 'different-fingerprint' })
    );

    await expect(service.claim(input, new Date('2026-11-03T10:00:00.000Z'))).rejects.toThrow(
      'Idempotency-Key was already used with a different request'
    );
    expect(prisma.studyChatOperation.create).not.toHaveBeenCalled();
  });

  it('rejects an operation while another matching request holds its live lease', async () => {
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ leaseExpiresAt: new Date('2026-11-03T10:01:00.000Z') })
    );

    await expect(service.claim(input, new Date('2026-11-03T10:00:00.000Z'))).rejects.toThrow(
      'An identical request is still processing'
    );
    expect(prisma.studyChatOperation.updateMany).not.toHaveBeenCalled();
  });

  it('claims an expired operation lease with compare-and-set', async () => {
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ leaseExpiresAt: new Date('2026-11-03T09:59:00.000Z') })
    );

    const result = await service.claim(input, new Date('2026-11-03T10:00:00.000Z'));

    expect(result.kind).toBe('claimed');
    expect(prisma.studyChatOperation.updateMany).toHaveBeenCalledWith({
      where: {
        id: '507f1f77bcf86cd799439012',
        userId: 'mongo-user-1',
        status: 'PROCESSING',
        leaseToken: 'lease-token-1',
        leaseExpiresAt: { lte: new Date('2026-11-03T10:00:00.000Z') },
      },
      data: {
        leaseToken: expect.any(String),
        leaseExpiresAt: new Date('2026-11-03T10:05:00.000Z'),
      },
    });
  });

  it('rejects stale-lease reacquisition when another request wins the compare-and-set', async () => {
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ leaseExpiresAt: new Date('2026-11-03T09:59:00.000Z') })
    );
    prisma.studyChatOperation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.claim(input, new Date('2026-11-03T10:00:00.000Z'))).rejects.toThrow(
      'An identical request is still processing'
    );
  });

  it('loads the unique-index winner instead of creating a second live claim', async () => {
    prisma.studyChatOperation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(operation());
    prisma.studyChatOperation.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.claim(input, new Date('2026-11-03T10:00:00.000Z'))).rejects.toThrow(
      'An identical request is still processing'
    );
    expect(prisma.studyChatOperation.create).toHaveBeenCalledOnce();
    expect(prisma.studyChatOperation.findUnique).toHaveBeenCalledTimes(2);
  });

  it('propagates a unique-index error if its winner cannot be reloaded', async () => {
    const duplicateError = { code: 'P2002' };
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.studyChatOperation.create.mockRejectedValueOnce(duplicateError);

    await expect(service.claim(input)).rejects.toBe(duplicateError);
  });

  it('propagates non-unique persistence errors without treating them as claim races', async () => {
    const persistenceError = new Error('MongoDB unavailable');
    prisma.studyChatOperation.create.mockRejectedValueOnce(persistenceError);

    await expect(service.claim(input)).rejects.toBe(persistenceError);
    expect(prisma.studyChatOperation.findUnique).toHaveBeenCalledOnce();
  });

  it('returns the persisted response for a completed matching operation', async () => {
    const response = { id: 'conversation-1', turnCount: 2 };
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ status: 'COMPLETED', response })
    );

    await expect(service.claim(input, new Date('2026-11-03T10:00:00.000Z'))).resolves.toEqual({
      kind: 'replay',
      response,
    });
    expect(prisma.studyChatOperation.create).not.toHaveBeenCalled();
    expect(prisma.studyChatOperation.updateMany).not.toHaveBeenCalled();
  });

  it('fails safely when a completed operation has no saved response', async () => {
    prisma.studyChatOperation.findUnique.mockResolvedValueOnce(
      operation({ status: 'COMPLETED', response: null })
    );

    await expect(service.claim(input)).rejects.toThrow(
      'Completed Study Chat operation has no saved response'
    );
  });

  it('completes and releases only the claim held by this request', async () => {
    const claim = {
      operationId: 'operation-1',
      leaseToken: 'lease-token-1',
      userId: 'mongo-user-1',
    };

    const completedAt = new Date('2026-11-04T12:00:00.000Z');
    await service.complete(claim, { id: 'conversation-1' }, completedAt);
    await service.release(claim);

    expect(prisma.studyChatOperation.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'mongo-user-1',
        operationId: 'operation-1',
        status: 'PROCESSING',
        leaseToken: 'lease-token-1',
      },
      data: {
        status: 'COMPLETED',
        response: { id: 'conversation-1' },
        expiresAt: new Date('2026-11-05T12:00:00.000Z'),
      },
    });
    expect(prisma.studyChatOperation.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'mongo-user-1',
        operationId: 'operation-1',
        status: 'PROCESSING',
        leaseToken: 'lease-token-1',
      },
    });
  });

  it('rejects completion if the claim lease is no longer owned', async () => {
    prisma.studyChatOperation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.complete(
        { operationId: 'operation-1', leaseToken: 'expired-token', userId: 'mongo-user-1' },
        { id: 'conversation-1' }
      )
    ).rejects.toThrow('An identical request is still processing');
  });

  it('renews only the currently owned processing lease', async () => {
    await service.renew(
      { userId: 'mongo-user-1', operationId: 'operation-1', leaseToken: 'lease-token-1' },
      new Date('2026-11-03T10:02:00.000Z')
    );

    expect(prisma.studyChatOperation.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'mongo-user-1',
        operationId: 'operation-1',
        status: 'PROCESSING',
        leaseToken: 'lease-token-1',
      },
      data: { leaseExpiresAt: new Date('2026-11-03T10:07:00.000Z') },
    });
  });

  it('rejects a lease renewal after another request owns the claim', async () => {
    prisma.studyChatOperation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.renew({ userId: 'mongo-user-1', operationId: 'operation-1', leaseToken: 'old' })
    ).rejects.toThrow('An identical request is still processing');
  });

  it('deletes operation records only for the conversation owner', async () => {
    await service.deleteForConversation('mongo-user-1', '507f1f77bcf86cd799439011');

    expect(prisma.studyChatOperation.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'mongo-user-1', conversationId: '507f1f77bcf86cd799439011' },
    });
  });
});
