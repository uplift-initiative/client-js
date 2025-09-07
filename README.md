# UpliftAI Client Libraries

Monorepo containing client libraries for building real-time AI assistants with UpliftAI.

## Packages

- [`@upliftai/assistants-react`](./packages/upliftai-assistants-react) - React components and hooks for building AI assistants

## Getting Started

### Installation

Install the package you need:

```bash
npm install @upliftai/assistants-react
```

### Quick Example

```tsx
import { UpliftAIRoom, useUpliftAIRoom } from '@upliftai/assistants-react';

function App({ token, wsUrl }) {
  return (
    <UpliftAIRoom
      token={token}
      serverUrl={wsUrl}
      connect={true}
      audio={true}
    >
      <YourAssistantUI />
    </UpliftAIRoom>
  );
}
```

## Development

This monorepo uses pnpm for package management.

### Setup

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev
```

### Running Examples

```bash
# Navigate to an example
cd examples/basic-assistant

# Start the development server
pnpm dev
```

## API Documentation

See the individual package READMEs for detailed API documentation:

- [@upliftai/assistants-react README](./packages/upliftai-assistants-react/README.md)

## License

MIT