import React from 'react';
import { LiveKitRoom, LiveKitRoomProps } from '@livekit/components-react';
import { UpliftAIRoomProvider } from './context';
import type { ToolConfig } from './types';

export interface UpliftAIRoomProps extends LiveKitRoomProps {
  tools?: ToolConfig[];
  onToolsChange?: (tools: ToolConfig[]) => void;
  onConnectionChange?: (connected: boolean, agentIdentity?: string) => void;
}

export const UpliftAIRoom: React.FC<UpliftAIRoomProps> = ({
  children,
  tools = [],
  onToolsChange,
  onConnectionChange,
  ...livekitProps
}) => {
  return (
    <LiveKitRoom {...livekitProps}>
      <UpliftAIRoomProvider
        initialTools={tools}
        onToolsChange={onToolsChange}
        onConnectionChange={onConnectionChange}
      >
        {children}
      </UpliftAIRoomProvider>
    </LiveKitRoom>
  );
};