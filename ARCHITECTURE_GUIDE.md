# Software Architecture Guide & Reference Manual
**Project: App Designer Monorepo**  
**Classification: Architectural Reverse-Engineering & Stack-Independent Reference Manual**

---

## 1. Executive Architecture Overview

### 1.1 Architectural Philosophy and Style
The system is architected as a **Clean, Hexagonal, Command-Driven Monorepo** with strict unidirectional data flow, total separation of concerns, and inverted dependency boundaries. It fuses four foundational architectural paradigms:

1. **Ports and Adapters (Hexagonal Architecture):** Core abstractions, domain interfaces, and service identifiers are completely isolated from concrete infrastructure (file systems, HTTP transports, AST parsers, WebWorkers, bundlers, code editors). Concrete implementations adapt to core ports via Dependency Injection.
2. **CQRS-Lite (Command Query Responsibility Segregation):** All state modifications across the application occur strictly via encapsulated **Commands** dispatched through a centralized `CommandExecutor` (`useCommandExecutor()`). All state reads occur strictly via read-only **Model Readers** (`useModelReader()` / `IIDEModelReader`). UI components and external consumers have zero direct write or read access to mutable stores.
3. **Multi-Scope Dual History Model:** Reversible domain operations (IDE file operations, canvas element manipulations) are automatically tracked across discrete undo/redo history stacks via pre-execution state capture and inverse execution, maintaining cross-scope LIFO sequence synchronization.
4. **Hierarchical Sub-Application Session Isolation:** The architecture supports multi-module composition where child DI containers inherit from a shell root container and project module-scoped state through transparent runtime ES Proxies (`createCompositeStore`), enabling isolated module workspaces within a unified hosting environment.

### 1.2 High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             UI / PRESENTATION LAYER                              │
│  apps/app-designer (Shell UI)  │  packages/components (Presentational Primitives)│
│  - React Views / Pages         │  - Pure Design Primitives                       │
│  - Observer Component Tree     │  - Property Editors / Canvas Widgets            │
│  - usePageLifeCycle Bridge     │  - StyledComponents (Styled*) / Tailwind        │
└───────────────┬───────────────────────────────────▲──────────────────────────────┘
                │ Dispatches Commands (Writes)       │ Reads State (Fine-grained)
                ▼                                   │
┌───────────────────────────────────────────────────┴──────────────────────────────┐
│                        BUSINESS / APPLICATION LOGIC LAYER                        │
│  packages/logic                                                                  │
│  - Command Registry & Command Executor (Inverse & Snapshot Dual Undo)            │
│  - ModelReader (Fine-Grained Computed Observables)                               │
│  - ESBundler (In-Browser Transpilation & Whole-App Composition)                  │
│  - Preview Orchestrator, HMR Channel & Component Inspector Overlay               │
│  - AST Engine Orchestration & Source Write-Back Coordinators                     │
│  - Page Lifecycle Controllers (EditorPage, DashboardPage, etc.)                  │
└───────────────┬───────────────────────────────────┬──────────────────────────────┘
                │ Mutates State                     │ Invokes Adapters
                ▼                                   ▼
┌──────────────────────────────┐    ┌──────────────────────────────────────────────┐
│          DATA LAYER          │    │                SERVICE LAYER                 │
│  packages/data               │    │  packages/service                            │
│  - MobX-State-Tree Stores    │    │  - HTTP / WebSocket Service Clients          │
│  - Virtual File System (VFS) │    │  - FetchServiceTransport                     │
│  - GeneratedPageStore        │    │  - Typed ServiceResult<T> Envelopes          │
│  - Composite Proxy Stores    │    │  - Token Store & Auth Interceptors           │
└───────────────┬──────────────┘    └──────────────────────┬───────────────────────┘
                │                                          │
                └───────────────────┬──────────────────────┘
                                    │ References Interfaces & Base Abstractions
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               CORE / PORTS LAYER                                 │
│  packages/core                                                                   │
│  - Dependency Injection Abstractions (ContainerImpl, ComponentDescriptor)        │
│  - Service Identifier Symbols (TYPES, ServiceIDs, HostServiceIDs)                │
│  - Command & History Interfaces (ICommand, IUndoableCommand, ICommandExecutor)   │
│  - Domain Contracts (IIDEModelReader, IFileSystem, IServiceTransport, etc.)      │
└───────────────────────────────────┬──────────────────────────────────────────────┘
                                    │ References Pure Types & Utilities
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                LEAF UTILITY LAYER                                │
│  packages/utils                                                                  │
│  - Pure Helper Functions (String transformations, Tree traversals, VFS helpers)  │
│  - AST Parser Integrations (SWC WASM Engine wrappers)                            │
│  - Shared DTO Shapes & Zero-Workspace-Dependency Constants                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Multi-Host & Editor Delivery Bridge

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-EDITOR HOSTING TARGETS                             │
│  VS Code Webview  │  Antigravity IDE  │  Cursor Fork  │  Browser Standalone      │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ JSON-RPC over Webview Bridge
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            apps/extension (Adapter)                              │
│  - Host-Agnostic Hosting Detector (detectHostingType)                            │
│  - RPC Hosts: FileSystem, Workspace, Dependencies, Diagnostics                   │
│  - ZERO imports of internal @stealth-ai/* packages (Bridge Isolation)            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Directory Structure

```
app-designer/
├── apps/
│   ├── app-designer/                 # Web Application Shell & Composition Root
│   │   ├── src/
│   │   │   ├── app/                  # Global CSS, Tailwind entry, Root layout
│   │   │   ├── auth/                 # Authentication route guards & context
│   │   │   ├── boot.tsx              # Application entry point & bootloader
│   │   │   ├── bootstrap/            # DI Container registration & composition roots
│   │   │   ├── common/               # Shell-specific layout primitives & providers
│   │   │   ├── components/           # IDE Shell UI (WebIDE, Toolbar, ActivityBar, Sidebar, Panels)
│   │   │   ├── config/               # App configuration loaders & runtime resolvers
│   │   │   ├── context/              # React DI context bindings (Inversify Provider)
│   │   │   ├── hooks/                # Shell React hooks (Lifecycle bridges, navigation, inspection)
│   │   │   ├── module-app/           # Sub-module visual rendering & hosting container
│   │   │   ├── module-container/     # Child DI container factories & composite store proxies
│   │   │   ├── pages/                # Route page components (RootEditor, Dashboard, Readonly)
│   │   │   ├── router/               # React Router 7 route definitions & guards
│   │   │   ├── session/              # Module session manager & multi-workspace coordinator
│   │   │   ├── utils/                # Shell-specific helper functions
│   │   │   ├── vfs/                  # Shell VFS sync orchestrators
│   │   │   └── vscode/               # VS Code / IDE Host bridge listeners & relays
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── component-designer-agent/     # Isolated AI Agent Package (Future Swarm Worker)
│   └── extension/                    # Multi-Editor Extension Host (VS Code, Antigravity, Cursor)
│       ├── src/
│       │   ├── dependency-install.ts # Remote package installation delegate
│       │   ├── deps-cache.ts         # Module resolution & caching on host filesystem
│       │   ├── designer-panel.ts     # Webview panel coordinator
│       │   ├── detect-hosting-type.ts# Host environment sniffing (VS Code vs Forks)
│       │   ├── fs-rpc-host.ts        # Host FileSystem RPC bridge provider
│       │   ├── sidebar-view.ts       # Host native sidebar tree view provider
│       │   └── workspace-rpc-host.ts # Host Workspace command execution bridge
│       └── package.json
├── packages/
│   ├── core/                         # DI Ports, Abstract Interfaces, Service Identifiers
│   │   ├── src/
│   │   │   ├── interfaces/           # Pure contracts (Commands, Model Readers, Hosts, Stores)
│   │   │   ├── ioc/                  # DI Container abstractions & ComponentDescriptor contracts
│   │   │   ├── service-identifiers.ts# Inversify Symbol constants (TYPES, ServiceIDs, HostServiceIDs)
│   │   │   └── index.ts              # Package public barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── utils/                        # Pure Leaf Utilities & Shared Helpers (Zero Workspace Deps)
│   │   ├── src/
│   │   │   ├── ast/                  # AST transformation utilities & traversal helpers
│   │   │   ├── ast-engine.ts         # SWC-WASM wrapper for JSX/TSX syntax tree building
│   │   │   ├── dom-path-matcher.ts   # DOM-to-Source code location resolvers
│   │   │   ├── files-tree-builder.ts # Flat-to-hierarchical tree transformation
│   │   │   ├── package-json-utils.ts # Dependency manifest parsers & normalizers
│   │   │   ├── vfs-tree-utils.ts     # Virtual file system immutable tree operators
│   │   │   └── index.ts              # Package public barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── data/                         # State Management & Virtual File System (MST Stores)
│   │   ├── src/
│   │   │   ├── di-module.ts          # ComponentDescriptor binding store singletons
│   │   │   ├── service-ids.ts        # Data layer specific Symbol identifiers
│   │   │   ├── store/
│   │   │   │   ├── models/           # MobX-State-Tree model definitions
│   │   │   │   │   ├── generated-page.ts     # Virtual File System (VFS) source of truth
│   │   │   │   │   ├── component-tree.ts     # Visual component tree model
│   │   │   │   │   ├── layout.ts             # IDE layout, split pane, and panel stores
│   │   │   │   │   ├── modules-store.ts      # Multi-module registry & feature policies
│   │   │   │   │   ├── module-workspace-store.ts # Module-isolated workspace state
│   │   │   │   │   ├── projects.ts           # Project catalog & metadata models
│   │   │   │   │   └── tech-stack.ts         # User project stack configuration model
│   │   │   │   ├── root-store.ts     # Canonical RootStore composition
│   │   │   │   └── type.ts           # Inferred MST instance and snapshot types
│   │   │   └── index.ts              # Package public barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── service/                      # External Infrastructure Clients & Network Transports
│   │   ├── src/
│   │   │   ├── auth/                 # Auth token storage & memory persistence
│   │   │   ├── collab/               # WebSocket real-time collaboration client
│   │   │   ├── mock-service/         # Mock backend HTTP service client
│   │   │   ├── service-descriptor.ts # ComponentDescriptor registering all service singletons
│   │   │   ├── service-ids.ts        # Service layer Symbol identifiers
│   │   │   ├── theme-page/           # Theme preview fetching client
│   │   │   ├── transport/            # FetchServiceTransport with token injection
│   │   │   ├── types-service/        # NPM type acquisition service client
│   │   │   ├── workspace/            # Workspace files HTTP client (WorkspaceServiceClient)
│   │   │   └── index.ts              # Package public barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── logic/                        # Application Business Logic, Commands & Bundler
│   │   ├── src/
│   │   │   ├── app-designer/         # IDE page controllers (EditorPage, DashboardPage, etc.)
│   │   │   ├── command/              # Command Pattern implementation
│   │   │   │   ├── commands/         # Domain commands (One class per file)
│   │   │   │   ├── command-executor.ts   # CommandExecutor with dual undo/redo coordination
│   │   │   │   ├── command-registry.ts   # Command registration catalog
│   │   │   │   ├── history/          # Inverse & Snapshot command history stacks
│   │   │   │   └── di-module.ts      # Command multi-bindings
│   │   │   ├── component-designer/   # Nested visual drag-and-drop builder logic
│   │   │   │   ├── codegen/          # React/TSX AST code generators
│   │   │   │   ├── write-back/       # AST source file reconciliation coordinators
│   │   │   │   └── di-module.ts      # Component Designer logic bindings
│   │   │   ├── es-bundler/           # In-browser esbuild-wasm bundling & resolution
│   │   │   ├── host/                 # Default Browser Host adapters (Noop implementations)
│   │   │   ├── model-reader/         # ModelReader (Fine-grained state query implementation)
│   │   │   ├── preview/              # Live preview iframe orchestrator & HMR pipeline
│   │   │   ├── scaffold/             # App project scaffolding & template evaluation
│   │   │   ├── sync/                 # Cross-slice state synchronizers
│   │   │   ├── theme/                # Theme application and CSS variable generation
│   │   │   ├── zip-extractor.ts      # Project archive export/import engine
│   │   │   ├── di-module.ts          # Logic layer ComponentDescriptor
│   │   │   └── index.ts              # Package public barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── components/                   # Reusable Presentational UI Primitives & Widgets
│       ├── src/
│       │   ├── common/               # Design system wrappers (Buttons, Modals, Dropdowns)
│       │   ├── component-designer/   # Visual builder UI widgets & property panels
│       │   ├── components/           # Specialized UI components (File trees, Tabs, Editors)
│       │   ├── hoc/                  # Higher-order component enhancers
│       │   ├── hooks/                # Presentational UI hooks (useModelReader, useCommandExecutor)
│       │   └── index.ts              # Package public barrel export
│       ├── package.json
│       └── tsconfig.json
├── docs/                             # Architecture Decision Records (ADRs) & System Specs
│   ├── decisions/                    # Formal ADR-001 through ADR-050
│   └── features/                     # Feature domain specifications
├── e2e/                              # Playwright End-to-End Test Suite
├── eslint.config.js                  # Monorepo boundary & architectural constraint enforcer
├── pnpm-workspace.yaml               # Monorepo package registry & dependency overrides
└── package.json                      # Workspace scripts & tooling definitions
```

---

## 3. Layer Responsibilities

| Layer & Location | Purpose | Responsibilities | Non-Responsibilities | Allowed Dependencies | Forbidden Dependencies | Inputs & Outputs |
|---|---|---|---|---|---|---|
| **Core**<br>`packages/core` | System contracts, Ports, and DI definitions | • Exposes TypeScript interfaces (`I*`)<br>• Defines DI Symbol tokens (`TYPES`, `ServiceIDs`)<br>• Defines Command & History contracts<br>• Provides `ContainerImpl` abstraction | • Zero business logic<br>• Zero mutable state<br>• Zero DOM or UI code<br>• Zero concrete network calls | `packages/utils` (types only) | `packages/data`<br>`packages/logic`<br>`packages/service`<br>`packages/components`<br>`apps/*` | **Input:** None<br>**Output:** Pure Interfaces & DI Tokens |
| **Utils**<br>`packages/utils` | Pure stateless utility library (Leaf) | • Pure string, path, and tree manipulation<br>• SWC AST parsing primitives<br>• DOM-to-Source location resolvers<br>• Package manifest parsers | • Zero application state<br>• Zero side-effects<br>• Zero business orchestration<br>• Zero UI styling | **None** (Absolute Leaf Package) | Every other workspace package (`@stealth-ai/*`) | **Input:** Raw primitives/ASTs<br>**Output:** Transformed primitives/trees |
| **Data**<br>`packages/data` | State management & Virtual File System | • MobX-State-Tree model definitions<br>• Virtual File System (`GeneratedPageStore`)<br>• State serialization & snapshot extraction<br>• Atomic state mutations (MST Actions) | • Zero HTTP/network requests<br>• Zero React or DOM code<br>• Zero AST parsing logic<br>• Zero bundling logic | `packages/core`<br>`packages/utils` | `packages/logic`<br>`packages/service`<br>`packages/components`<br>`apps/*` | **Input:** Action payloads<br>**Output:** Observable state snapshots |
| **Service**<br>`packages/service` | External I/O & Network infrastructure | • HTTP REST client implementations<br>• WebSocket real-time transport<br>• Auth header token injection<br>• Standardized `ServiceResult<T>` envelopes | • Zero business decisions<br>• Zero state persistence<br>• Zero UI components | `packages/core`<br>`packages/utils` | `packages/data`<br>`packages/logic`<br>`packages/components`<br>`apps/*` | **Input:** Endpoint requests<br>**Output:** `ServiceResult<T>` data |
| **Logic**<br>`packages/logic` | Application business rules & domain commands | • Encapsulated Command classes<br>• CommandExecutor & Dual Undo Engine<br>• ModelReader fine-grained query provider<br>• In-browser esbuild-wasm bundler<br>• Source write-back AST reconcilers<br>• Page lifecycle orchestration | • Zero React UI rendering<br>• Zero DOM manipulation<br>• Zero CSS/styling | `packages/core`<br>`packages/utils`<br>`packages/data`<br>`packages/service` | `packages/components`<br>`apps/*`<br>`react` (UI) | **Input:** Commands & Parameters<br>**Output:** Domain mutations & Results |
| **Components**<br>`packages/components` | Reusable presentational UI primitives | • Pure presentational React widgets<br>• StyledComponents (`Styled*`) & Tailwind layout<br>• Property editors & canvas toolbars<br>• Custom hooks (`useModelReader`, `useCommandExecutor`) | • Zero business rules<br>• Zero direct state mutation<br>• Zero direct network calls | `packages/core`<br>`packages/utils`<br>Third-party UI libs | `packages/data`<br>`packages/logic`<br>`packages/service`<br>`apps/*` | **Input:** Props / Reader queries<br>**Output:** JSX Elements |
| **UI Shell**<br>`apps/app-designer` | Application composition root & layout | • Application bootloader (`boot.tsx`)<br>• DI container registration (`register-container.ts`)<br>• React Router 7 page configuration<br>• IDE shell layout & toolbars<br>• VS Code Webview RPC bridge relays | • Direct state mutations (Must use Commands)<br>• Direct store access (Must use ModelReader) | `packages/core`<br>`packages/utils`<br>`packages/logic`<br>`packages/service`<br>`packages/components`<br>`packages/data` (Composition root only) | Direct store imports in UI components | **Input:** User interactions / URL<br>**Output:** Mounted Application |
| **Extension**<br>`apps/extension` | Multi-editor host adapter (VS Code / Antigravity) | • Host environment detection (`detectHostingType`)<br>• Host file system & workspace RPC hosts<br>• Native editor sidebar & webview provider | • Internal IDE logic execution<br>• Direct store access | VS Code Extension API | **All workspace packages** (`@stealth-ai/*`) | **Input:** Webview RPC messages<br>**Output:** Host OS / Editor calls |

---

## 4. Dependency Direction & Graph

### 4.1 Monorepo Dependency Rules
The monorepo enforces a strict **unidirectional dependency hierarchy** verified at build time and statically enforced by ESLint (`eslint.config.js`).

```
                     ┌──────────────────────┐
                     │    apps/extension    │ (Isolated Host Adapter)
                     └──────────┬───────────┘
                                │ RPC Bridge (JSON Messages)
                                ▼
                     ┌──────────────────────┐
                     │  apps/app-designer   │ (Composition Root & UI Shell)
                     └──────────┬───────────┘
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│packages/component│  │  packages/logic  │  │ packages/service │
└─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
          │                     │                     │
          │                     ▼                     │
          │           ┌──────────────────┐            │
          │           │  packages/data   │            │
          │           └─────────┬────────┘            │
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                     ┌──────────────────────┐
                     │    packages/core     │ (Ports & Service IDs)
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │    packages/utils    │ (Stateless Leaf)
                     └──────────────────────┘
```

### 4.2 Dependency Inversion Principle (DIP) in Practice
1. **Abstractions Own the Boundary:** `packages/core` defines the abstract interface `IWorkspaceServiceClient`. `packages/service` implements `WorkspaceServiceClient`. `packages/logic` (`EditorPage`) injects `IWorkspaceServiceClient` via the DI identifier `ServiceLayerIDs.WorkspaceServiceClient`. `packages/logic` never has a compile-time dependency on the concrete implementation in `packages/service`.
2. **UI Decoupling via CQRS Ports:** UI components in `apps/app-designer` and `packages/components` never import `packages/data` (enforced as a fatal ESLint error). Components read state strictly through `IIDEModelReader` / `ICDModelReader` and write state through `ICommandExecutor`.
3. **Multi-Editor Isolation:** `apps/extension` has **zero** dependencies on any `@stealth-ai/*` workspace package. It communicates exclusively over a JSON-RPC message protocol (`__bridge__`), ensuring that changes in IDE internals never break host editor compatibility.

---

## 5. Circular Dependency Prevention

### 5.1 Prevention Architecture
Circular dependencies are prevented through structural boundaries and automated tooling:

1. **Leaf Package Isolation (`packages/utils`):** The utility layer is prohibited from importing any monorepo package. If a utility needs a type from `packages/core`, that type is either moved to `packages/utils` or the function is refactored into a higher layer.
2. **Interface Segregation in `packages/core`:** By placing all interfaces, service identifiers, and DI tokens in `packages/core`, two sibling packages (e.g., `packages/logic` and `packages/service`) can interact through core contracts without ever importing each other.
3. **No-Restricted-Imports ESLint Gate:** The ESLint flat configuration explicitly forbids cross-layer and upward imports:
   - `packages/components` cannot import `data`, `logic`, `service`, or `ui`.
   - `packages/logic` cannot import `components`, `ui`, or `react`.
   - `packages/data` cannot import `logic`, `service`, or `components`.
   - Deep imports bypassing package barrel exports (`@stealth-ai/*/*`) are flagged as fatal errors across all packages.
4. **Proxy-Based Composite Stores for Modules:** Rather than creating circular references between global root stores and module-scoped stores, `createCompositeStore` wraps the root store in an ES Proxy, intercepting property access without bidirectional store linking.

---

## 6. Core / Domain / Shared Layer (`packages/core`)

### 6.1 Purpose and Responsibility
`packages/core` acts as the system's **Domain Ports Registry**. It defines the contracts, protocols, and identifiers required for the entire application to function without providing concrete implementations.

### 6.2 Key Architectural Artifacts
- **Service Identifiers (`service-identifiers.ts`):** Unique symbol tokens used by the Inversify IoC container to decouple interface declarations from implementations:
  ```typescript
  export const TYPES = {
    IRootStore: Symbol.for('IRootStore'),
    IESBundler: Symbol.for('IESBundler'),
    ICommandExecutor: Symbol.for('ICommandExecutor'),
    ICommandRegistry: Symbol.for('ICommandRegistry'),
    IModelReader: Symbol.for('IModelReader'),
  } as const;
  ```
- **Command Interfaces (`interfaces/command.ts`):** Defines the metadata, execution signatures, and undo contracts for domain and ephemeral commands:
  ```typescript
  export interface ICommand<TPayload = void, TResult = void> {
    readonly metadata: ICommandMetadata<TPayload>;
    execute(payload?: TPayload): Promise<TResult> | TResult;
    canExecute?(context?: unknown): boolean;
  }

  export interface IUndoableCommand<TPayload = void, TUndo = unknown, TResult = void>
    extends ICommand<TPayload, TResult> {
    captureUndo(payload: TPayload): TUndo;
    undo(state: TUndo): Promise<void> | void;
  }
  ```
- **IoC Container Abstraction (`ioc/container-impl.ts`):** Encapsulates Inversify container configuration behind a modular `ComponentDescriptor` pattern, allowing each package to declare its own DI bindings.

---

## 7. Data Layer (`packages/data`)

### 7.1 Purpose and Architectural Role
`packages/data` provides immutable snapshotting, observable reactivity, and state persistence using **MobX-State-Tree (MST)**. It owns the **Virtual File System (VFS)** and all state slices.

### 7.2 The Virtual File System (VFS) as Single Source of Truth
The core model in `packages/data` is `GeneratedPageStore` (`store/models/generated-page.ts`), which maintains:
1. `filesInfo.filesContent`: ReadonlyMap of normalized file paths to current buffer contents.
2. `filesInfo.modifyedFilesContent`: Unsaved file buffer modifications (retains the literal historical property identifier `modifyedFilesContent` defined in MST `FilesInfoModel` for backward compatibility).
3. `filesTreeView`: Hierarchical tree structure of folders and files (`FolderTreeStructureModel`).
4. `filesInfoMapper`: Semantic mapping of component trees, exports, and import declarations.
5. `filesAstInfo`: Cached AST representations computed by the SWC parser.

### 7.3 Data Layer Isolation Rules
- **Zero Business Logic:** The data layer contains only structural mutations (actions like `setFilesContent`, `deleteFile`, `addNode`). Validation, compilation, file generation, and write-back orchestration live exclusively in `packages/logic`.
- **Zero Network Knowledge:** The data layer has no awareness of REST endpoints, WebSockets, or HTTP headers. It receives data solely via command payloads dispatched by logic controllers.

---

## 8. Business / Application / Logic Layer (`packages/logic`)

### 8.1 Purpose and Structure
`packages/logic` is the brain of the application. It contains all use cases, commands, orchestrators, code generators, and compilation engines. It is designed to be **fully executable in headless environments (Node.js/WebWorkers) with zero UI present**.

### 8.2 The Command Pattern and Dual-Scope Undo System
Every state mutation in the application is modeled as an individual Command class implementing `ICommand` or `IUndoableCommand`.

#### One Command Per File (ADR-031)
Commands live in `packages/logic/src/command/commands/<domain>/<command-name>.ts`. Each file exports a single command class annotated with `@injectable()`.

#### Dual-Scope Undo Coordination (ADR-015)
The application maintains two independent undo strategies:
1. **IDE Scope:** Uses `InverseCommandHistory` (Command Pattern: `captureUndo` -> `undo()`).
2. **Canvas Scope:** Uses `SnapshotHistory` (State Pattern: Full MST snapshot rollback).

`CommandExecutor` (`command-executor.ts`) assigns a globally increasing monotonic sequence number (`seq`) to every executed domain command. When the user triggers `undo()`, the executor compares the sequence numbers at the top of both history stacks:
```typescript
function scopeWithHighestPendingUndoSeq(
  ideSeq: number | undefined,
  canvasSeq: number | undefined
): CommandScope | undefined {
  if (ideSeq === undefined && canvasSeq === undefined) return undefined;
  if (canvasSeq === undefined) return 'ide';
  if (ideSeq === undefined) return 'canvas';
  return canvasSeq > ideSeq ? 'canvas' : 'ide';
}
```
This guarantees strict global LIFO reversal across interleaved IDE and visual canvas edits.

### 8.3 In-Browser ES Bundler & Live Preview Engine
`packages/logic/src/es-bundler` and `packages/logic/src/preview` compile user applications directly inside the browser using WebAssembly (`esbuild-wasm` and `@swc/wasm-web`):
1. **Virtual Resolution:** Resolves imports against `GeneratedPageStore.filesInfo.filesContent`.
2. **Package Fallback:** Resolves third-party NPM dependencies via an in-memory cache or CDN.
3. **Preview Orchestrator (`PreviewOrchestrator`):** Manages iframe lifecycle, runtime error boundaries, and Hot Module Replacement (HMR) messaging.

### 8.4 Source Write-Back System (ADR-041)
When visual manipulations occur on the canvas (e.g., resizing a component, adding a rule, editing a style prop), the `SourceWriteBackService` and its specialized coordinators (`StyleWriteBackCoordinator`, `RulesWriteBackCoordinator`, `AddWriteBackCoordinator`) parse the underlying TSX AST, insert or patch the JSX syntax nodes, format the code, and dispatch `EditorCommandIds.UpdateModifiedContent` to update the VFS.

---

## 9. UI / Presentation Layer (`apps/app-designer` & `packages/components`)

### 9.1 Separation of Presentational Primitives vs Shell Views
- **`packages/components` (Pure Primitives):** Contains dumb UI components (buttons, input fields, modals, property grids, timeline widgets). They receive data via props or via the decoupled `useModelReader()` hook and emit intents via `useCommandExecutor()`.
- **`apps/app-designer` (Smart Shell):** Composes presentational components into complete IDE views (Toolbar, ActivityBar, Sidebar, Monaco Editor, Canvas, Preview Panel).

### 9.2 React + MobX Observer Integration
All components consuming state from `ModelReader` are wrapped in `observer` from `mobx-react-lite`. Because `ModelReader` returns actual MST observable values or computed properties, MobX automatically tracks component dependencies and triggers fine-grained re-renders only when the observed property changes.

### 9.3 Styling Paradigm
- **Layout & Sizing:** Handled via utility classes (**Tailwind CSS**).
- **Dynamic Theming & Complex Styles:** Handled via **Styled Components** (`styled-components`).
- **Strict Convention:** Styled component identifiers must start with `Styled` (e.g., `StyledEditorPanel`, `StyledToolbarButton`) and live in a co-located `*.styles.ts` file. Inline `style={{}}` attributes are strictly prohibited.

---

## 10. Feature Organization & Modular Session Architecture

### 10.1 Hybrid Architecture
The repository employs a hybrid organizational model:
1. **Horizontal Technical Packages:** `packages/core`, `packages/data`, `packages/logic`, `packages/service`, `packages/components`.
2. **Vertical Domain Modules:** Within `packages/logic/src/command/commands/` and `packages/data/src/store/models/`, features are grouped by domain (`editor`, `project`, `modules`, `layout`, `preview`, `theme`, `auth`, `component-designer`).

### 10.2 Sub-Application Session Isolation (ADR-011, ADR-020, ADR-034)
The application allows composing multiple sub-modules (micro-frontends) within a single project workspace.
- **Session Manager (`SessionManager`):** Tracks active workspace sessions.
- **Child DI Containers (`createModuleContainer`):** When navigating to a specific module, a child Inversify container is created inheriting from the root shell container.
- **Composite Store Proxy (`createCompositeStore`):** A proxy wraps the global root store and redirects module-scoped store accesses (`filesInfo`, `componentTree`, `layout`) to an isolated `ModuleWorkspaceStore` while falling through to the shared root store for global services (`auth`, `projects`, `theme`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                         SHELL CONTAINER (ROOT)                         │
│  RootStore (Global Projects, User Profile, Themes, Global Auth)        │
│  CommandRegistry, CommandExecutor (Shell Scope)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Creates Child Container on Navigation
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    MODULE SESSION CONTAINER (CHILD)                    │
│  ModuleWorkspaceStore (Isolated VFS, Component Tree, Canvas State)     │
│  CompositeStore Proxy (Module Store -> Root Store Fallthrough)         │
│  CommandRegistry & CommandExecutor (Module-Scoped Registry)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Data Flow

### Flow 1: Code Editing & Live Preview Compilation

```
[ Monaco Editor ]
       │ User types code
       ▼
[ useCommandExecutor().execute(EditorCommandIds.UpdateModifiedContent) ]
       │ Dispatches Ephemeral Command (No History)
       ▼
[ UpdateModifiedContentCommand ]
       │ Mutates
       ▼
[ GeneratedPageStore.filesInfo.modifyedFilesContent ] (Literal MST model identifier)
       │ User presses Ctrl+S
       ▼
[ useCommandExecutor().execute(EditorCommandIds.SaveFile) ]
       │ Dispatches Domain Command (Undoable)
       ▼
[ SaveFileCommand.captureUndo() ] ──> Stores previous file content in InverseCommandHistory
       │ Executes
       ▼
[ GeneratedPageStore.saveFile() ] ──> Flushes modified buffer to filesContent
       │ Triggers
       ▼
[ EditorPage.onReady() / computeFileAst() ]
       │ Parses AST via SWC WASM
       ▼
[ UpdateFileAstInfoCommand & UpdateFileInfoMapperCommand ]
       │ Updates VFS Semantic Metadata
       ▼
[ PreviewOrchestrator (Debounced Reaction) ]
       │ Resolves VFS files via ESBundler (esbuild-wasm)
       ▼
[ Compiled JS Bundle / Blob URL ]
       │ Dispatches postMessage
       ▼
[ Preview iframe (Live Render & Component Inspector Overlay) ]
```

### Flow 2: Visual Canvas Drag-and-Drop & Source Write-Back

```
[ Component Designer Visual Canvas ]
       │ User drops a new UI Component onto Canvas
       ▼
[ useCommandExecutor().execute('canvas.add-component', payload) ]
       │ Dispatches Domain Canvas Command
       ▼
[ AddComponentCommand ]
       │ Captures MST Snapshot in SnapshotHistory & mutates Canvas MST Store
       ▼
[ CanvasCommandExecutedListener Notification ]
       │ Fired for category === 'canvas'
       ▼
[ SourceWriteBackService.handleCommandExecuted() ]
       │ Selects Coordinator
       ▼
[ AddWriteBackCoordinator.execute() ]
       │ Reads TSX AST from ModelReader.getFilesAstInfo()
       ▼
[ ASTEngine.insertJSXElement() ]
       │ Manipulates AST Syntax Nodes & Formats Code
       ▼
[ useCommandExecutor().execute(EditorCommandIds.UpdateModifiedContent) ]
       │ Writes updated TSX text back into VFS buffer
       ▼
[ Monaco Editor & Preview iframe automatically synchronize ]
```

### Flow 3: Workspace Route Navigation & Page Lifecycle

```
[ User Navigates to /app/:projectId/editor ]
       │ React Router 7 detects URL match
       ▼
[ RootEditorPage (apps/app-designer/src/pages) ]
       │ Calls hook
       ▼
[ usePageLifeCycle(PageLifeCycleIds.EditorPage) ]
       │ Resolves IPageLifeCycle from Inversify DI
       ▼
[ EditorPage.onNavigate(context) ]
       │ Checks generation counter (Race Condition Guard)
       ▼
[ WorkspaceServiceClient.getAppFiles(projectId) ]
       │ Fetches project files over HTTP via FetchServiceTransport
       ▼
[ ServiceResult<AppFilesDto> ]
       │ If success === true
       ▼
[ CommandExecutor.execute(ProjectCommandIds.Initialize, { filesContent, ... }) ]
       │ Mutates
       ▼
[ GeneratedPageStore.initialize() ] ──> Populates VFS & Builds File Tree
       │ Page marked Ready
       ▼
[ EditorPage.onReady() ] ──> Triggers Background AST Parsing & Mapper Hydration
       │
       ▼
[ usePageLifeCycle sets isReady = true ] ──> IDE Shell Renders Editor & Canvas
```

---

## 12. Dependency Injection Architecture

### 12.1 Container Implementation & Scopes
Dependency injection is powered by **InversifyJS** managed through the `ContainerImpl` wrapper (`packages/core/src/ioc/container-impl.ts`).

- **Singleton Scope (`inSingletonScope()`):** Default for all services, model readers, transports, and stores. Created once per container lifecycle.
- **Request Scope (`inRequestScope()`):** Used for `InverseCommandHistory`. A fresh history instance is created per `CommandExecutor` resolution graph, preventing child module containers from accidentally sharing the root history stack.
- **Transient Scope (`inTransientScope()`):** Used during command registry initialization to instantiate command classes before registering them in `CommandRegistry`.

### 12.2 Component Descriptor Pattern
Each package exposes a `ComponentDescriptor` object declaring its DI bindings:
```typescript
export interface ComponentDescriptor {
  name: string;
  bindings: (container: Container) => void;
}
```
Composition roots (`apps/app-designer/src/bootstrap/register-container.ts`) assemble descriptors declaratively:
```typescript
container.addFromDescriptor(dataDescriptor);
container.addFromDescriptor(logicDescriptor);
container.addFromDescriptor(commandsDescriptor);
container.addFromDescriptor(serviceDescriptor);
container.autobind();
```

---

## 13. Abstractions & Core Interfaces

| Abstraction | Layer Owner | Implementing Package | Key Methods / Contract | Architectural Benefit |
|---|---|---|---|---|
| `ICommand<P, R>` | `packages/core` | `packages/logic` | `execute(payload?: P): Promise<R>` | Encapsulates all state operations as testable objects |
| `IUndoableCommand<P, U, R>` | `packages/core` | `packages/logic` | `captureUndo(payload: P): U`<br>`undo(state: U): void` | Provides deterministic, reversible state transactions |
| `ICommandExecutor` | `packages/core` | `packages/logic` | `execute(id: symbol, payload?: unknown)`<br>`undo()`, `redo()` | Centralized execution pipeline with schema validation and history |
| `IIDEModelReader` | `packages/core` | `packages/logic` | Fine-grained getters (`getActiveFilePath()`, `getFilesContent()`, etc.) | Read-only reactive facade decoupling UI from MST models |
| `IFileSystem` | `packages/core` | `packages/logic` (`host/`) | `readFile()`, `writeFile()`, `deleteFile()` | Abstracts Host OS filesystem vs Browser In-Memory VFS |
| `IServiceTransport` | `packages/core` | `packages/service` | `fetch(path: string, options?: RequestInit)` | Isolates HTTP transport from auth header injection and base URLs |
| `IWorkspaceServiceClient` | `packages/core` | `packages/service` | `getAppFiles(appId: string): Promise<ServiceResult<AppFilesDto>>` | Typed backend API client returning Result envelopes |
| `IPageLifeCycle<P, Q>` | `packages/core` | `packages/logic` | `onNavigate(ctx)`, `onReady()`, `onLeave()` | Decouples page initialization workflows from React rendering |
| `IESBundler` | `packages/core` | `packages/logic` | `bundle(entryPoint, options)` | Encapsulates WebAssembly in-browser bundling pipeline |
| `IAstParser` | `packages/core` | `apps/app-designer` (`swc-ast-parser.ts`) | `parse(code: string): Promise<unknown>` | Decouples SWC WASM parser runtime initialization from logic consumers |
| `ASTEngine` | `packages/utils` | `packages/utils` | `buildJSXTree()`, `insertJSXElement()`, `extractProps()` | Pure stateless AST analysis, JSX node manipulation, and syntax code generation |

---

## 14. Models, Entities, DTOs & Mappers

### 14.1 Separation of Data Structures
1. **Domain Entities (MST Models in `packages/data`):** Observable, mutable via actions only, enforce runtime type safety (e.g., `GeneratedPageStore`, `LayoutStore`, `ModulesStore`).
2. **DTOs (Data Transfer Objects in `packages/utils` & `packages/core`):** Plain TypeScript interfaces representing serialized wire formats (e.g., `AppFilesDto`, `ModulePackageInfo`, `VfsTreeNode`).
3. **Snapshots (`SnapshotIn<T>` / `SnapshotOut<T>`):** Immutable plain JS objects serialized from MST models for undo/redo state preservation and local persistence.
4. **Mappers & Hydrators (`packages/logic/src/app-designer/pages/apply-file-mappers.ts`):** Pure functions that transform raw file strings into AST trees and hydrate `filesInfoMapper` records without coupling to network models.

---

## 15. Error Handling Architecture

### 15.1 Standardized Result Pattern (`ServiceResult<T>`)
Network and infrastructure operations never throw raw unhandled exceptions. They return a strongly typed `ServiceResult<T>` union (`packages/core/src/interfaces/service-result.ts`):
```typescript
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; statusCode?: number } };
```

### 15.2 Layered Exception Handling
- **Service Layer:** Catches fetch and network errors, maps them to standard codes (`HTTP_ERROR`, `API_ERROR`, `NETWORK_ERROR`, `PARSE_ERROR`), and wraps them in `{ success: false, error }`.
- **Command Layer:** Validates incoming payloads against Zod schemas (`metadata.schema.parse(payload)`). Rejects invalid payloads before execution.
- **Page Lifecycle Layer:** Uses generation counters (`_generation`) to detect and safely discard responses from aborted or superseded route navigations.
- **UI Layer:** Catches React render crashes via error boundaries; catches lifecycle errors via `usePageLifeCycle().error` and displays friendly error alerts.

---

## 16. State Management Paradigm

### 16.1 Single Source of Truth
All application state lives inside MobX-State-Tree stores instantiated in `packages/data/src/store/root-store.ts`.

### 16.2 Read/Write Segregation Rules
```
┌────────────────────────────────────────────────────────────────────────┐
│                              REACT UI                                  │
└──────────────────┬──────────────────────────────────▲──────────────────┘
                   │                                  │
  1. Writes via    │                                  │ 4. Observes fine-grained
     Command       │                                  │    getters (Auto-tracked)
     Executor      ▼                                  │
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│           COMMAND EXECUTOR           │   │         MODEL READER        │
│  - Validates Zod Schema              │   │  - Exposes fine-grained     │
│  - Captures Undo State               │   │    observable getters       │
│  - Dispatches to Domain Command      │   │  - Computed memoized views  │
└──────────────────┬───────────────────┘   └──────────▲──────────────────┘
                   │                                  │
  2. Executes MST  │                                  │ 3. Reads MST
     Action        ▼                                  │    Observables
┌─────────────────────────────────────────────────────┴──────────────────┐
│                          MOBX-STATE-TREE STORE                         │
│  - GeneratedPageStore (VFS)       - LayoutStore                        │
│  - ComponentTreeStore             - ModulesStore                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Navigation & Routing Architecture

### 17.1 Decoupled Page Lifecycle Pattern (ADR-021)
Routing decisions and UI rendering are decoupled from page data initialization:
1. React Router 7 matches the URL route (`apps/app-designer/src/router/routes.tsx`).
2. Route component mounts and invokes `usePageLifeCycle(PageLifeCycleIds.EditorPage)`.
3. The hook resolves the logic controller `EditorPage` (implementing `IPageLifeCycle`).
4. `EditorPage.onNavigate()` executes asynchronous initialization (file fetching, VFS mounting, default module verification).
5. When complete, `EditorPage.onReady()` kicks off background AST parsing and mapper hydration.
6. When navigating away, `EditorPage.onLeave()` cleans up resources and cancels pending generation keys.

---

## 18. Shared Utilities & Helpers (`packages/utils`)

### 18.1 Leaf Utility Architecture
`packages/utils` is strictly a leaf package. It has **zero dependencies on any other package in the monorepo**.
- **`ast-engine.ts`:** Wraps SWC WebAssembly to construct JSX syntax trees.
- **`vfs-tree-utils.ts`:** Immutable tree operators for searching, inserting, and deleting nodes from virtual file trees.
- **`package-json-utils.ts`:** Parsers for discovering workspace package manifests and analyzing NPM dependency trees.
- **`dom-path-matcher.ts`:** Resolves visual canvas elements to exact source file lines and column offsets.

---

## 19. Configuration & Environment

### 19.1 Hierarchy of Configuration
1. **Host Environment (`IEnvironment`):** Identifies whether the application is running in a standard Web Browser, VS Code Webview, Desktop Electron container, or Cloud IDE container.
2. **Application Configuration (`IAppConfig`):** Loaded asynchronously at boot (`resolveAppConfig()`), defining service endpoints, mock URLs, and feature toggles.
3. **Environment Services Binding (`bindEnvironmentServices`):** Injects environment-specific adapters into the DI container based on detected runtime capabilities.

---

## 20. Testing Architecture

### 20.1 Multi-Tier Test Suite
1. **Unit & Integration Tests (Vitest):**
   - Co-located with source files: `foo.ts` -> `__tests__/foo.test.ts`.
   - Tests execute against pure DI containers and mock services without mounting UI.
   - Fast, headless verification of AST transformations, Commands, Model Readers, and Store Actions.
2. **End-to-End Tests (Playwright):**
   - Located in root `e2e/`.
   - Boots full web dev server, exercises real Monaco editor typing, drag-and-drop canvas manipulation, and preview iframe compilation.
3. **Extension Host Integration Tests (VS Code Test Electron):**
   - Located in `apps/extension/src/__tests__/`.
   - Runs via `pnpm run extension:test:integration`, booting an automated VS Code Electron instance to verify extension RPC host bridges, file-watching, and webview communications in a real IDE host environment.
4. **Test Bridges (`installTestBridge.ts`):**
   - Exposes clean testing hooks (`window.__TEST_BRIDGE__`) in non-production builds for deterministic E2E assertions.

---

## 21. Naming Conventions

| Artifact Type | Naming Convention | Example |
|---|---|---|
| **Interface** | Prefixed with `I` in PascalCase | `ICommand`, `IIDEModelReader`, `IFileSystem` |
| **Type Alias / Union** | PascalCase without `I` prefix | `CommandScope`, `TargetType`, `ServiceResult<T>` |
| **Command Class** | PascalCase ending in `Command` | `SaveFileCommand`, `CreateFileCommand` |
| **Service Class** | PascalCase ending in `Service` or `Client` | `WorkspaceServiceClient`, `AppThemeService` |
| **Model Definition** | PascalCase ending in `Model` or `Store` | `GeneratedPageStore`, `FilesInfoModel` |
| **Component Descriptor** | camelCase ending in `Descriptor` | `logicDescriptor`, `dataDescriptor` |
| **Styled Component** | PascalCase prefixed with `Styled` | `StyledToolbarButton`, `StyledCanvasContainer` |
| **Custom Hook** | camelCase prefixed with `use` | `useModelReader`, `useCommandExecutor` |
| **File Names** | kebab-case throughout (`*.ts`, `*.tsx`) | `command-executor.ts`, `editor-page.ts` |
| **Types File** | Co-located `*.types.ts` or `types.ts` | `command.types.ts`, `root-store.ts` |

---

## 22. File Size & Responsibility Standards

1. **Single Command Per File (ADR-031):** Every command must live in its own file. Bundling multiple command classes into a single file is strictly prohibited.
2. **Small Focused Components:** React components should not exceed ~100-150 lines. Large views must be broken down into `/parts` subdirectories.
3. **Complexity Budget (ADR-040):** Functions are kept below a cyclomatic complexity threshold of 18. Complex switch dispatchers (such as AST visitor nodes) are isolated into dedicated resolver files (`ast-engine.jsx-node-resolvers.ts`).

---

## 23. What Should NEVER Happen (Architectural Anti-Patterns)

1. **UI Layer Directly Importing Data Models:** UI components must never import `packages/data`. They must read via `useModelReader()` and write via `useCommandExecutor()`.
2. **Logic Layer Importing React or DOM:** `packages/logic` must never import `react`, `react-dom`, or browser DOM types. Logic must remain 100% headless.
3. **Utilities Importing Monorepo Packages:** `packages/utils` must never import from `@stealth-ai/*`.
4. **Bypassing Package Barrels (Deep Imports):** Consumers must never import internal paths (`@stealth-ai/core/src/interfaces/command.ts`). Imports must target package roots (`@stealth-ai/app-designer-core`).
5. **Direct Store Mutation Outside MST Actions:** Store state must never be modified by direct property assignment. All changes must occur inside defined MST actions invoked through Commands.
6. **Silent Error Swallowing:** Catch blocks must never be empty. Errors must either be logged with context and re-thrown or mapped into a structured `ServiceResult` error envelope.
7. **Inline React Styles:** Never use `style={{ ... }}` in components. Always use Tailwind utility classes or `Styled*` styled-components.

---

## 24. Explicit Architectural Rules

### Rule 1: Strict Layer Boundary Isolation
- **Rationale:** Prevents circular dependencies and guarantees that business logic can be tested without UI dependencies.
- **Correct:** `apps/app-designer/src/pages/Editor.tsx` -> calls `useCommandExecutor().execute(EditorCommandIds.SaveFile)`.
- **Incorrect:** `apps/app-designer/src/pages/Editor.tsx` -> imports `rootStore` from `@stealth-ai/app-designer-data` and calls `rootStore.generatedPage.saveFile()`.

### Rule 2: Unidirectional Hexagonal Port Inversion
- **Rationale:** Allows substituting infrastructure (e.g., swapping Browser VFS for Node.js OS FileSystem) without altering application logic.
- **Correct:** `packages/logic` injects `IFileSystem` bound to `HostServiceIDs.FileSystem`.
- **Incorrect:** `packages/logic` directly imports `fs` from Node.js or `localStorage` from browser globals.

### Rule 3: Single Command Class per File
- **Rationale:** Ensures clean git history, isolated unit testing, and modular dependency injection bundling.
- **Correct:** `packages/logic/src/command/commands/editor/save-file-command.ts` containing only `SaveFileCommand`.
- **Incorrect:** `packages/logic/src/command/commands/editor-commands.ts` containing 10 different command classes.

---

## 25. How to Add a New Feature

When adding a new feature (e.g., "AI Code Explanation Panel"):

1. **Define Core Contracts (`packages/core`):**
   - Add service identifier symbols in `packages/core/src/service-identifiers.ts`.
   - Define interfaces in `packages/core/src/interfaces/ai-explainer.ts` (e.g., `IAIExplainerService`, `IAIExplainerModelReader`).
2. **Define State Models (`packages/data`):**
   - Create MST model in `packages/data/src/store/models/ai-explainer.ts`.
   - Add the slice to `RootStore` in `packages/data/src/store/root-store.ts`.
   - Expose state in `IReadonlyRootStore` (`packages/core`).
3. **Implement Domain Commands & Logic (`packages/logic`):**
   - Create commands in `packages/logic/src/command/commands/ai-explainer/` (e.g., `RequestExplanationCommand.ts`).
   - Register commands in `packages/logic/src/command/di-module.ts`.
   - Add query methods to `ModelReader` (`packages/logic/src/model-reader/model-reader.ts`).
4. **Implement External Service Client if needed (`packages/service`):**
   - Create `AIExplainerServiceClient` in `packages/service/src/ai-explainer/`.
   - Register client in `packages/service/src/service-descriptor.ts`.
5. **Build Presentational Components (`packages/components`):**
   - Create UI components in `packages/components/src/ai-explainer/`.
   - Use `useModelReader()` to read explanation state; use `useCommandExecutor()` to dispatch request commands.
6. **Mount in IDE Shell (`apps/app-designer`):**
   - Add the new panel to the IDE layout parts (`apps/app-designer/src/components/web-ide/parts/panel/`).

---

## 26. How to Modify an Existing Feature

1. **Locate Architectural Responsibility:**
   - State shape change? -> `packages/data/src/store/models/`
   - Business rule / compilation change? -> `packages/logic/`
   - Network / endpoint change? -> `packages/service/`
   - Visual styling change? -> `packages/components/`
2. **Preserve Interface Contracts:** If changing a method signature on a service or model reader, update the interface in `packages/core` first, then update all implementations and mock fixtures.
3. **Check Undo Reversibility:** If adding a state mutation to a domain command, verify that `captureUndo()` captures the necessary state snapshot and `undo()` completely reverts the change.
4. **Verify Layer Boundaries:** Run `pnpm lint && pnpm type-check && pnpm test` to verify no layer constraints or circular dependencies were introduced.

---

## 27. Architectural Decision Analysis (Key ADRs)

| Decision | What Was Chosen | Reason / Benefit | Trade-off / Cost | Alternative Considered | Transferable Principle |
|---|---|---|---|---|---|
| **ADR-001** | MobX-State-Tree for State Management | Structured trees, built-in snapshots, JSON patches, and fine-grained MobX reactivity | Strict action boilerplate; runtime type overhead | Redux Toolkit, Zustand, Valtio | Use structured, snapshot-capable state trees when building document/IDE editors requiring undo/redo |
| **ADR-002** | InversifyJS for Dependency Injection | Decouples interfaces from implementations; allows multi-editor and multi-environment portability | Setup complexity and metadata reflection requirement | Manual constructor injection, Service Locator | Use IoC containers when targeting multiple deployment hosts (Web, Desktop, Extension) |
| **ADR-003** | In-Browser Bundling (`esbuild-wasm` + SWC) | Instant preview generation without remote backend build servers; works offline | WebAssembly memory overhead and initial load latency | Remote Server Bundling (Docker/Node), WebContainers | Offload compilation to client-side WebAssembly for zero-latency interactive developer tools |
| **ADR-006** | UI-to-Data Layer Boundary Gate | Forbids UI components from importing data models directly; mandates CQRS ModelReader/Command pattern | Requires creating commands and reader getters for every state interaction | Direct store binding (`useStore()`) | Strict CQRS boundaries prevent presentation layers from tangling with data structures |
| **ADR-007** | Command Pattern with Dual Undo | Encapsulates operations as discrete classes with isolated undo state capture | Proliferation of small command files | Direct model action calls | Model operations as discrete command objects whenever multi-level undo/redo is required |
| **ADR-011** | Sub-Module Container & Session Isolation | Child DI containers + Proxy composite stores isolate micro-apps within a single workspace | Complex proxy debugging and container lifecycle management | Single monolithic store with namespacing | Use hierarchical DI containers and Proxy stores for nested multi-tenant / multi-app composition |
| **ADR-019** | Host-Agnostic Editor Delivery via RPC Bridge | Extension host communicates via JSON-RPC over webview postMessage without internal code dependencies | Serialization overhead across message boundary | Direct embedding of IDE packages into VS Code extension | Decouple extension host adapters from core app logic via message passing for multi-host support |
| **ADR-031** | One Command Per File | Strict 1:1 mapping of command classes to files | Increases total file count in repository | Grouping all domain commands into a single file | One class per file maximizes maintainability, git mergeability, and test modularity |

---

## 28. Architectural Strengths

1. **Extreme Testability:** Because all business logic lives in headless commands and page controllers inside `packages/logic` relying on injected interfaces from `packages/core`, 95%+ of application behavior is unit-tested without launching a browser or mounting DOM nodes.
2. **Host Portability:** The core application can run unchanged in a standard web browser, inside a VS Code webview, inside Antigravity/Cursor IDE forks, or inside an Electron shell simply by binding different host adapters (`HostServiceIDs.FileSystem`, `HostServiceIDs.WorkspaceHost`) in DI.
3. **Rock-Solid Undo/Redo Integrity:** By treating undo state capture as a mandatory first-class citizen of the Command lifecycle (`resolveUndoableCommand`), regressions in undo/redo behavior are virtually impossible.
4. **Enforced Boundary Governance:** Automated ESLint rules prevent architectural decay before code can be committed or merged.

---

## 29. Architectural Weaknesses & Risks

1. **Boilerplate Overhead:** Adding a simple state property requires updating the MST Model (`packages/data`), the Readonly Interface (`packages/core`), the ModelReader (`packages/logic`), and creating a Command class with a Zod schema (`packages/logic`).
2. **AST / VFS Synchronization Latency:** When heavy typing occurs in the code editor, continuous AST parsing and component tree regeneration can consume significant CPU in low-spec browser environments if debouncing is misconfigured.
3. **Proxy Composite Store Complexity:** Using ES Proxies for `createCompositeStore` can make runtime state debugging tricky if developers attempt to inspect store properties using raw `console.log` rather than MST snapshot tools.

---

## 30. Stack-Independent Architecture Blueprint

Regardless of whether a future project uses **Flutter, React, Angular, Vue, .NET/WPF, Java/Kotlin, Swift, or Python**, the architectural philosophy of this codebase translates directly into the following blueprint:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION (UI) LAYER                         │
│  - Pure View Components / Widgets / Templates                          │
│  - Receives Read-Only ViewModels / Model Readers                       │
│  - Emits User Intents by Dispatching Commands                          │
└──────────────────┬──────────────────────────────────▲──────────────────┘
                   │ Dispatches Commands              │ Observes Queries
                   ▼                                  │
┌─────────────────────────────────────────────────────┴──────────────────┐
│                    APPLICATION / BUSINESS LOGIC LAYER                  │
│  - Command Bus & Command Handlers (Undoable / Non-Undoable)            │
│  - Query Services / Model Readers (Read-Only Facades)                  │
│  - Domain Workflows, AST/Code Generators, Calculation Engines          │
└───────────────┬─────────────────────────────────────┬──────────────────┘
                │ Mutates State                       │ Invokes Ports
                ▼                                     ▼
┌──────────────────────────────┐     ┌───────────────────────────────────┐
│       STATE/DATA LAYER       │     │     INFRASTRUCTURE / SERVICES     │
│  - Observable Store / Models │     │  - HTTP API Clients / WebSockets  │
│  - Transactional Snapshots   │     │  - File System / Local Storage    │
│  - In-Memory Cache           │     │  - Hardware / OS Platform Bridges │
└───────────────┬──────────────┘     └────────────────┬──────────────────┘
                │                                     │
                └──────────────────┬──────────────────┘
                                   │ Implements Contracts
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       CORE / PORTS / DOMAIN LAYER                      │
│  - Abstract Interfaces / Protocol Declarations                         │
│  - Dependency Injection Tokens & Service Identifiers                   │
│  - Domain Value Objects & Shared Contracts                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ References Pure Helpers
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          LEAF UTILITIES LAYER                          │
│  - Stateless Algorithms, Math, String & Tree Helpers                   │
│  - ZERO dependencies on upper layers or external frameworks            │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Porting Rules for Other Stacks:
1. **Never let UI write directly to State Stores:** Route all mutations through Command objects.
2. **Never let UI read raw Mutable Stores:** Expose read-only query facades (Model Readers).
3. **Isolate Infrastructure behind Ports:** HTTP clients, file storage, and OS APIs must implement interfaces defined in the Core domain layer.
4. **Make Utilities a Pure Leaf:** Utility libraries must never depend on domain, state, or UI modules.
5. **Enforce Boundaries with Linting/Compiler Tools:** Never rely solely on developer discipline; enforce dependency directions with build-time rules.

---

## 31. AI Implementation Instructions (Architectural Constitution)

> **Instructions for AI Agents Implementing a New System Following This Architecture:**
>
> You are building a new application. You MUST adhere to the following architectural constitution:
>
> 1. **Strict Layer Hierarchy:**
>    - Create discrete modules for `core`, `utils`, `data`, `service`, `logic`, `components`, and `app`.
>    - `utils` is a pure leaf. It must NEVER import from any sibling package.
>    - `core` defines interfaces, DI tokens, and ports. It must NEVER contain business logic or state.
>    - `data` owns stores and persistence. It must NEVER make network requests or contain UI logic.
>    - `service` owns external I/O. It must return standardized `Result<T>` types and never contain UI or business rules.
>    - `logic` owns use cases, commands, orchestrators, and query facades. It must remain 100% headless and executable without UI.
>    - `components` and `ui` own presentation. They must NEVER import the data layer directly.
>
> 2. **CQRS-Lite State Interaction:**
>    - **For all state reads:** Create and inject a read-only `ModelReader`. Expose fine-grained, reactive getters.
>    - **For all state writes:** Create an encapsulated `Command` class. Pass it through a centralized `CommandExecutor`.
>
> 3. **Command & Undo Discipline:**
>    - Every state-mutating command must declare whether it is `domain` (undoable) or `ephemeral` (transient).
>    - Domain commands MUST implement a `captureUndo()` method that captures pre-execution state snapshots.
>    - Enforce exactly ONE command class per file.
>
> 4. **Dependency Injection:**
>    - Never instantiate services, stores, or commands directly via `new`. Register them in an IoC container using unique symbol tokens.
>    - Inject dependencies through constructors using abstract interface tokens.
>
> 5. **Defensive Error Handling:**
>    - Never allow external network or file I/O operations to throw unhandled exceptions across layer boundaries. Wrap responses in `{ success: true, data }` or `{ success: false, error }` envelopes.
>
> 6. **Testing Mandate:**
>    - Co-locate unit tests alongside source files (`*.test.*`).
>    - Test business logic and commands by mocking DI container dependencies rather than mounting UI components.
