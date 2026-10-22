# File structure and a complete component

Reference for the `react-developer` skill. The folder layout for a feature and a page, and a complete worked component with its types, styles and barrel. Load when creating a new feature folder.

## The file structure for a new feature

For a new feature called "hello" with 3 components:

```
ui/src/components/hello/
├── Hello.types.ts                 # all interfaces for this feature
├── Hello.tsx                      # the main component
├── World.tsx                      # a second component
├── Greeting.tsx                   # a third component
├── styles.css                     # all CSS for these components
└── index.ts                       # public exports
```

Plus, if it has shared helpers:

```
ui/src/lib/utils/
└── hello-helpers.ts               # pure functions used by hello/*
```

For a single-component feature, the structure is the same (rule #2):

```
ui/src/components/bye/
├── Bye.types.ts
├── Bye.tsx
├── styles.css
└── index.ts
```

For a page (top-level route):

```
ui/src/pages/DashboardPage.tsx
ui/src/pages/dashboard/
│   ├── dashboard.types.ts
│   ├── DashboardHeader.tsx
│   ├── KpiCards.tsx
│   ├── RecentSessionsTable.tsx
│   ├── styles.css
│   └── index.ts
```

The page file itself is thin — it composes the sub-components and wires
data fetching.

## A complete component example

```ts
// ui/src/components/hello/Hello.types.ts
export interface IHelloProps {
  name: string;
  age?: number;
  className?: string;
  onGreet?: () => void;
}
```

```css
/* ui/src/components/hello/styles.css */
.hello {
  @apply rounded-lg border p-4 flex flex-col gap-2;
}

.hello-title {
  @apply text-lg font-semibold;
}

.hello-greeting {
  @apply text-amber-500;
}
```

```tsx
// ui/src/components/hello/Hello.tsx
import { memo } from 'react';
import { cn } from '@/lib/utils';

import type { IHelloProps } from './Hello.types';

export const Hello = memo((props: IHelloProps) => {
  const { name, age, className, onGreet } = props;

  return (
    <div className={cn('hello', className)}>
      <h2 className="hello-title">
        Hello, <span className="hello-greeting">{name}</span>
      </h2>
      {age !== undefined && <p>Age: {age}</p>}
      {onGreet && (
        <button onClick={onGreet} className="text-sm underline">
          Greet
        </button>
      )}
    </div>
  );
});

Hello.displayName = 'Hello';
```

```ts
// ui/src/components/hello/index.ts
export * from './Hello';
```
