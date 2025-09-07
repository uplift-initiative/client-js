# UpliftAI Basic Assistant Example

A simple example demonstrating how to use `@upliftai/assistants-react` to build a real-time AI assistant.

## Features

- Audio-only voice assistant
- Real-time voice visualization
- Dynamic tool registration
- Custom instruction updates
- Connection status display

## Running the Example

1. Install dependencies `npm install` or `pnpm install` and run `npm run dev`

3. Open http://localhost:3000 in your browser

4. Enter your UpliftAI Assistant ID and click Connect

## How It Works

### Creating a Session

The example uses the public session endpoint for simplicity:

```tsx
const response = await fetch(
  `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participantName: 'Test User',
    }),
  }
);
```

### Custom Tools

The example includes two sample tools:

1. **Weather Tool** - Returns mock weather data for a location
2. **Calculator Tool** - Performs basic arithmetic calculations

Tools can be dynamically added or removed while the assistant is running.

### Updating Instructions

You can update the assistant's behavior by providing custom instructions through the UI.

## Key Components

- `UpliftAIRoom` - Main wrapper component that establishes the connection
- `useUpliftAIRoom` - Hook for accessing room functionality for updating tools and instructions on the fly.

## Notes

- This example requires a public UpliftAI assistant ID that is publicly accessible
- You can preconfigure tool in the UpliftAI platform or API and just register tools in the inital tools array
- UpliftAIRoom is fully compatible with LiveKit components
- In your repo, you can install `@upliftai/assistants-react` and `@livekit/components-react`  directly from npm

## Learn More

- [UpliftAI Documentation](https://docs.upliftai.org)
- [LiveKit Documentation](https://docs.livekit.io)
- [@upliftai/assistants-react Package](../../packages/upliftai-assistants-react)