# Types, controllers and tests for Mastra-powered modules

Reference for the `mastra-ai` skill. The `*.types.ts` pattern, the controller pattern, and the spec pattern for a module that calls an agent.

## The types and schemas pattern

Each module that uses Mastra defines its types in a
`<name>.types.ts` file co-located with the service/controller:

```ts
// tech-expert.types.ts
import { z } from 'zod';

// Zod schemas for validation + structured output
export const techExpertRequestSchema = z.object({
  question: z.string().min(1),
});

export const techAnswerSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  examples: z.array(z.string()),
  relatedTopics: z.array(z.string()),
});

export type TechAnswer = z.infer<typeof techAnswerSchema>;

// NestJS DTOs with class-validator + swagger decorators
export class TechExpertRequestDto implements ITechExpertRequest { ... }
export class TechExpertResponseDto implements ITechExpertResponse { ... }

// Interface shapes for service return values
export interface ITechExpertRequest { question: string; }
export interface ITechExpertResponse { data: ...; error: string | null; meta: Record<string, unknown>; }
```

The pattern:

1. **Zod schemas** for request validation and structured output
2. **`z.infer<typeof schema>`** for TypeScript types derived from Zod
3. **class-validator DTOs** with `@ApiProperty` decorators for Swagger
4. **Interfaces** for the service return value shape

The controller uses `ZodValidationPipe(techExpertRequestSchema)`
for request validation, and the service uses the Zod schema as
the `structuredOutput.schema`.

## The controller pattern for Mastra-powered endpoints

```ts
@Controller('tech-expert')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('USER')
export class TechExpertController {
  constructor(private readonly techExpertService: TechExpertService) {}

  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(techExpertRequestSchema))
  @ApiOperation({ summary: 'Ask a technology question' })
  public async ask(@Body() body: TechExpertRequestDto): Promise<ITechExpertResponse> {
    return this.techExpertService.askQuestion(body);
  }
}
```

- Uses `ZodValidationPipe` with the Zod schema (not class-validator pipe)
- Returns the interface type (`ITechExpertResponse`)
- Guards and roles applied at controller level
- Module wiring: `@Module({ controllers: [TechExpertController], providers: [TechExpertService] })`

## The testing pattern for Mastra-powered services

Mock the mastra config module using `vi.mock` at the top level:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';

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
    mockGenerate.mockResolvedValue({
      object: { topic: 'Arrays' },
      text: '{"topic":"Arrays"}',
    });
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

The mock `generate` must return an object with both `.object`
and `.text`:

```ts
mockGenerate.mockResolvedValue({
  object: {/* parsed structured data */},
  text: JSON.stringify({/* same data */}),
});
```

`response.object` gives you the parsed structured data.
`response.text` gives the raw string. The service typically
returns `response.object`.
