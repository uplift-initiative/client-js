# @upliftai/assistants-react

React components and hooks for building real-time AI assistants with UpliftAI and LiveKit.

A thin wrapper around LiveKit room, it allows you to easily connect to an UpliftAI assistant session, manage tools, and update instructions dynamically.

## Installation

```bash
npm install @upliftai/assistants-react
```

## Peer Dependencies

This package requires the following peer dependencies (you have to install as well):

```json
{
  "@livekit/components-react": "^2.8.0",
  "livekit-client": "^2.7.0",
  "react": "^17.0.0 || ^18.0.0 || ^19.0.0",
  "react-dom": "^17.0.0 || ^18.0.0 || ^19.0.0"
}
```

## Full Example

See the [examples/react-assistant-demo](../../examples/react-assistant-demo) directory for a complete working example.

## Quick Start

### 1. Get Session Credentials

First, create a session with your UpliftAI assistant. You'll need to call the UpliftAI API from your backend:

```javascript
// Backend code
const response = await fetch(
  `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createSession`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_API_KEY}`,
    },
    body: JSON.stringify({
      participantName: 'User Name',
    }),
  }
);

const { token, wsUrl, roomName } = await response.json();
```

For public assistants, you can use the public endpoint:

```javascript
// Can be called from frontend for public assistants
const response = await fetch(
  `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createPublicSession`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participantName: 'User Name',
    }),
  }
);

const { token, wsUrl, roomName } = await response.json();
```

### 2. Create Your Assistant Component

```tsx
import React from 'react';
import {
  UpliftAIRoom,
  useUpliftAIRoom,
  useVoiceAssistant,
  AudioTrack,
  BarVisualizer,
  TrackToggle,
  DisconnectButton,
} from '@upliftai/assistants-react';
import { Track } from 'livekit-client';

function AssistantView() {
  const { updateInstruction, isConnected, agentParticipant } = useUpliftAIRoom();
  const { state } = useVoiceAssistant();

  return (
    <div>
      <h2>AI Assistant</h2>
      
      {/* Show connection status */}
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {agentParticipant && <p>Agent: {agentParticipant.identity}</p>}
      
      {/* Voice visualization */}
      <BarVisualizer state={state} />
      
      {/* Assistant state */}
      <p>
        {state === 'speaking' && 'Assistant is speaking...'}
        {state === 'thinking' && 'Assistant is thinking...'}
        {state === 'listening' && 'Listening...'}
      </p>
      
      {/* Audio controls */}
      <TrackToggle source={Track.Source.Microphone} />
      <DisconnectButton />
    </div>
  );
}

function App({ token, wsUrl }) {
  return (
    <UpliftAIRoom
      token={token}
      serverUrl={wsUrl}
      connect={true}
      audio={true}
      video={false}
    >
      <AssistantView />
    </UpliftAIRoom>
  );
}
```

## Adding Custom Tools

You can extend your assistant's capabilities by adding custom tools:

```tsx
import { UpliftAIRoom, useUpliftAIRoom, ToolConfig } from '@upliftai/assistants-react';

// Define your tools
const tools: ToolConfig[] = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
      },
      required: ['location'],
    },
    timeout: 10, // seconds
    handler: async (data) => {
      const payload = JSON.parse(data.payload);
      const { location } = payload.arguments.raw_arguments;
      
      // Your weather API call here
      const weather = await fetchWeather(location);
      
      return JSON.stringify({
        result: weather,
        presentationInstructions: `The weather in ${location} is ${weather.temperature}°F`,
      });
    },
  },
];

function App({ token, wsUrl }) {
  return (
    <UpliftAIRoom
      token={token}
      serverUrl={wsUrl}
      connect={true}
      audio={true}
      video={false}
      tools={tools} // Pass tools here
    >
      <AssistantView />
    </UpliftAIRoom>
  );
}
```

### Dynamic Tool Management

You can also add, update, or remove tools dynamically:

```tsx
function ToolManager() {
  const { addTool, removeTool, updateTool } = useUpliftAIRoom();
  
  const handleAddTool = async () => {
    await addTool({
      name: 'calculator',
      description: 'Perform calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Math expression to evaluate',
          },
        },
        required: ['expression'],
      },
      timeout: 5,
      handler: async (data) => {
        const { expression } = JSON.parse(data.payload).arguments.raw_arguments;
        const result = eval(expression); // Note: Use a safe math parser in production
        return JSON.stringify({ result });
      },
    });
  };
  
  return (
    <button onClick={handleAddTool}>Add Calculator Tool</button>
  );
}
```

## Updating Assistant Instructions

You can update the assistant's instructions in real-time:

```tsx
function InstructionManager() {
  const { updateInstruction } = useUpliftAIRoom();
  const [instructions, setInstructions] = useState('');
  
  const handleUpdate = async () => {
    await updateInstruction(instructions);
  };
  
  return (
    <div>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Enter custom instructions..."
      />
      <button onClick={handleUpdate}>Update Instructions</button>
    </div>
  );
}
```

## API Reference

### `<UpliftAIRoom>`

The main component that wraps your application and provides the UpliftAI context.

#### Props

All props from `@livekit/components-react`'s `LiveKitRoom` component, plus:

- `tools?: ToolConfig[]` - Array of tools to register with the assistant
- `onToolsChange?: (tools: ToolConfig[]) => void` - Callback when tools change
- `onConnectionChange?: (connected: boolean, agentIdentity?: string) => void` - Callback when connection status changes

### `useUpliftAIRoom()`

Hook to access UpliftAI room functionality.

#### Returns

- `addTool(config: ToolConfig): Promise<void>` - Add a new tool
- `updateTool(config: ToolConfig): Promise<void>` - Update an existing tool
- `removeTool(name: string): Promise<void>` - Remove a tool
- `upsertTools(configs: ToolConfig[]): Promise<void>` - Replace all tools
- `updateInstruction(instruction: string): Promise<void>` - Update assistant instructions
- `isConnected: boolean` - Connection status
- `agentParticipant: Participant | null` - The agent participant object

### Tool Configuration

Interfaces already exported from this package.

```typescript
interface ToolInvocationData {
  requestId: string;
  callerIdentity: string;
  payload: string; // You will have to parse this JSON string
  responseTimeout: number;
}

interface ParameterConfig {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: any[];
  items?: ParameterConfig;
  properties?: Record<string, ParameterConfig>;
  required?: string[];
}

interface ToolConfig {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterConfig>;
    required?: string[];
  };
  timeout: number; // in seconds
  handler: (data: ToolInvocationData) => Promise<string>;
}
```

## LiveKit Components

This package re-exports all components from `@livekit/components-react`, so you can use LiveKit components directly:

```tsx
import {
  AudioTrack,
  VideoTrack,
  ControlBar,
  Chat,
  RoomAudioRenderer,
  // ... and more
} from '@upliftai/assistants-react';
```
## License

MIT