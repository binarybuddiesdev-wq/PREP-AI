# Spec file patterns

Reference for the `testing` skill. Complete controller, service, Mastra-service, simple-controller and smoke-test spec examples. Load when writing a new spec.

## The spec file patterns

### Controller spec — full NestJS testing module

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { CanActivate, ConflictException, ExecutionContext } from '@nestjs/common';
import { TopicController } from './topic.controller.js';
import { TopicService } from './topic.service.js';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
import { CREATE_TOPIC_SUCCESS } from '@/common/constants/api.constants.js';

describe('TopicController', () => {
  let controller: TopicController;
  let service: TopicService;

  // 1. Mock guard class
  class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      return true;
    }
  }

  // 2. Create mock service object with typed mock methods
  const topicService = {
    createTopic: vi.fn().mockResolvedValue({ id: '1', name: 'React' }),
    getTopicBySlug: vi.fn().mockResolvedValue(null),
  } as unknown as TopicService;

  // 3. beforeEach: compile fresh module each time
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicController],
      providers: [{ provide: TopicService, useValue: topicService }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    controller = module.get(TopicController);
    service = module.get(TopicService);
  });

  // 4. Tests: assert controller shape { message, data }
  it('returns the success envelope on create', async () => {
    const result = await controller.createTopic({
      name: 'React',
      category: 'practice',
      slug: 'react',
    });
    expect(result).toEqual({ message: expect.any(String), data: { id: '1', name: 'React' } });
    expect(topicService.createTopic).toHaveBeenCalledWith({
      name: 'React',
      category: 'practice',
      slug: 'react',
    });
  });

  // 5. Error case: assert the thrown exception type
  it('throws ConflictException when slug already exists', async () => {
    topicService.createTopic.mockRejectedValue(new ConflictException('already exists'));
    await expect(
      controller.createTopic({ name: 'React', category: 'practice', slug: 'react' })
    ).rejects.toThrow(ConflictException);
  });
});
```

### Service spec — mock Prisma + Logger

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PrismaService } from '@/prisma/prisma.service.js';
import { TopicService } from './topic.service.js';

describe('TopicService', () => {
  let service: TopicService;
  let prisma: { topic: { findFirst: ReturnType<typeof vi.fn>; ... } };
  let mockPinoLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      topic: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockPinoLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'PinoLogger:TopicService', useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get(TopicService);
  });

  it('creates a topic successfully', async () => {
    prisma.topic.findFirst.mockResolvedValue(null); // no duplicate
    prisma.topic.create.mockResolvedValue({ id: '1', name: 'React', slug: 'react' });
    const result = await service.createTopic({ name: 'React', category: 'practice', slug: 'react' });
    expect(result).toEqual({ id: '1', name: 'React', slug: 'react' }); // raw data, no envelope
    expect(prisma.topic.create).toHaveBeenCalledWith({ data: { name: 'React', category: 'practice', slug: 'react' } });
  });

  it('throws ConflictException when topic already exists', async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: '1', name: 'React' });
    await expect(service.createTopic({ name: 'React', category: 'practice', slug: 'react' })).rejects.toThrow(ConflictException);
  });
});
```

### Mastra agent spec — mock mastra.config.js

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';

// Top-level vi.mock for the mastra config module
const mockGenerate = vi.fn();
vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: {
    getAgent: () => ({
      generate: mockGenerate,
    }),
  },
}));

describe('TechExpertService', () => {
  let service: TechExpertService;

  beforeEach(async () => {
    mockGenerate.mockResolvedValue({ object: { topic: 'Arrays' }, text: '{"topic":"Arrays"}' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechExpertService],
    }).compile();
    service = module.get(TechExpertService);
  });

  it('returns structured answer', async () => {
    const result = await service.askQuestion({ question: 'What are arrays?' });
    expect(result.data).toEqual({ topic: 'Arrays' });
    expect(mockGenerate).toHaveBeenCalled();
  });
});
```

### Simple controller spec — no NestJS testing module

For controllers with no guards and no Prisma dependency:

```ts
import { vi } from 'vitest';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';

describe('TechExpertController', () => {
  let controller: TechExpertController;
  let service: TechExpertService;

  beforeEach(() => {
    const mockService = { askQuestion: vi.fn() } as unknown as TechExpertService;
    controller = new TechExpertController(mockService);
    service = mockService;
  });

  it('returns the response', async () => {
    service.askQuestion.mockResolvedValue({ data: { topic: 'Arrays' }, error: null, meta: {} });
    const result = await controller.ask({ question: 'What are arrays?' });
    expect(result).toEqual({ data: { topic: 'Arrays' }, error: null, meta: {} });
  });
});
```

### Smoke test — service with no dependencies

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuestionService } from './question.service.js';

describe('QuestionService', () => {
  it('should be defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionService],
    }).compile();
    const service = module.get(QuestionService);
    expect(service).toBeDefined();
  });
});
```
