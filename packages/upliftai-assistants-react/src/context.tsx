import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import type { ToolConfig, ToolUpdateRequest, UpliftAIRoomContextValue } from './types';

const UpliftAIRoomContext = createContext<UpliftAIRoomContextValue | null>(null);

export const useUpliftAIRoom = (): UpliftAIRoomContextValue => {
  const context = useContext(UpliftAIRoomContext);
  if (!context) {
    throw new Error('useUpliftAIRoom must be used within an UpliftAIRoom');
  }
  return context;
};

interface UpliftAIRoomProviderProps {
  children: React.ReactNode;
  initialTools?: ToolConfig[];
  onToolsChange?: (tools: ToolConfig[]) => void;
  onConnectionChange?: (connected: boolean, agentIdentity?: string) => void;
}

export const UpliftAIRoomProvider: React.FC<UpliftAIRoomProviderProps> = ({
  children,
  initialTools = [],
  onToolsChange,
  onConnectionChange,
}) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [registeredTools, setRegisteredTools] = useState<Map<string, ToolConfig>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const previousAgentRef = useRef<string | null>(null);

  const agentParticipant = remoteParticipants.find((p) => p.isAgent);

  useEffect(() => {
    const connected = room.state === ConnectionState.Connected;
    setIsConnected(connected);

    if (agentParticipant && agentParticipant.identity !== previousAgentRef.current) {
      previousAgentRef.current = agentParticipant.identity;
      onConnectionChange?.(true, agentParticipant.identity);
      
      if (initialTools.length > 0) {
        registerInitialTools();
      }
    } else if (!agentParticipant && previousAgentRef.current) {
      previousAgentRef.current = null;
      onConnectionChange?.(false);
    }
  }, [room.state, agentParticipant?.identity]);

  const registerInitialTools = useCallback(async () => {
    if (!agentParticipant || !localParticipant) return;

    for (const tool of initialTools) {
      try {
        await room.registerRpcMethod(tool.name, tool.handler);
        registeredTools.set(tool.name, tool);
      } catch (error) {
        console.error(`Failed to register initial tool ${tool.name}:`, error);
      }
    }

    if (initialTools.length > 0) {
      try {
        const request: ToolUpdateRequest = {
          action: 'replace',
          tools: initialTools,
        };

        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_tools',
          payload: JSON.stringify(request),
        });
      } catch (error) {
        console.error('Failed to sync initial tools with agent:', error);
      }
    }
  }, [agentParticipant, localParticipant, initialTools]);

  const addTool = useCallback(
    async (toolConfig: ToolConfig) => {
      if (!agentParticipant || !localParticipant) {
        throw new Error('No agent participant found');
      }

      if (registeredTools.has(toolConfig.name)) {
        throw new Error(`Tool ${toolConfig.name} is already registered`);
      }

      try {
        await room.registerRpcMethod(toolConfig.name, toolConfig.handler);

        const request: ToolUpdateRequest = {
          action: 'add',
          tools: [toolConfig],
        };

        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_tools',
          payload: JSON.stringify(request),
        });

        const newTools = new Map(registeredTools);
        newTools.set(toolConfig.name, toolConfig);
        setRegisteredTools(newTools);
        onToolsChange?.(Array.from(newTools.values()));
      } catch (error) {
        await room.unregisterRpcMethod(toolConfig.name);
        throw error;
      }
    },
    [agentParticipant, localParticipant, registeredTools, onToolsChange]
  );

  const updateTool = useCallback(
    async (toolConfig: ToolConfig) => {
      if (!agentParticipant || !localParticipant) {
        throw new Error('No agent participant found');
      }

      if (!registeredTools.has(toolConfig.name)) {
        throw new Error(`Tool ${toolConfig.name} is not registered`);
      }

      try {
        await room.unregisterRpcMethod(toolConfig.name);
        await room.registerRpcMethod(toolConfig.name, toolConfig.handler);

        const request: ToolUpdateRequest = {
          action: 'replace',
          tools: [toolConfig],
        };

        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_tools',
          payload: JSON.stringify(request),
        });

        const newTools = new Map(registeredTools);
        newTools.set(toolConfig.name, toolConfig);
        setRegisteredTools(newTools);
        onToolsChange?.(Array.from(newTools.values()));
      } catch (error) {
        throw error;
      }
    },
    [agentParticipant, localParticipant, registeredTools, onToolsChange]
  );

  const removeTool = useCallback(
    async (toolName: string) => {
      if (!agentParticipant || !localParticipant) {
        throw new Error('No agent participant found');
      }

      const tool = registeredTools.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} is not registered`);
      }

      try {
        const request: ToolUpdateRequest = {
          action: 'remove',
          tools: [{ ...tool, name: toolName }],
        };

        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_tools',
          payload: JSON.stringify(request),
        });

        await room.unregisterRpcMethod(toolName);

        const newTools = new Map(registeredTools);
        newTools.delete(toolName);
        setRegisteredTools(newTools);
        onToolsChange?.(Array.from(newTools.values()));
      } catch (error) {
        throw error;
      }
    },
    [agentParticipant, localParticipant, registeredTools, onToolsChange]
  );

  const upsertTools = useCallback(
    async (toolConfigs: ToolConfig[]) => {
      if (!agentParticipant || !localParticipant) {
        throw new Error('No agent participant found');
      }

      try {
        for (const oldTool of registeredTools.values()) {
          await room.unregisterRpcMethod(oldTool.name);
        }

        const newTools = new Map<string, ToolConfig>();
        for (const tool of toolConfigs) {
          await room.registerRpcMethod(tool.name, tool.handler);
          newTools.set(tool.name, tool);
        }

        const request: ToolUpdateRequest = {
          action: 'replace',
          tools: toolConfigs,
        };

        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_tools',
          payload: JSON.stringify(request),
        });

        setRegisteredTools(newTools);
        onToolsChange?.(toolConfigs);
      } catch (error) {
        throw error;
      }
    },
    [agentParticipant, localParticipant, registeredTools, onToolsChange]
  );

  const updateInstruction = useCallback(
    async (instruction: string) => {
      if (!agentParticipant || !localParticipant) {
        throw new Error('No agent participant found');
      }

      try {
        await localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'update_instructions',
          payload: JSON.stringify({ instructions: instruction }),
        });
      } catch (error) {
        throw error;
      }
    },
    [agentParticipant, localParticipant]
  );

  const value: UpliftAIRoomContextValue = {
    addTool,
    updateTool,
    removeTool,
    upsertTools,
    updateInstruction,
    isConnected,
    agentParticipant,
  };

  return <UpliftAIRoomContext.Provider value={value}>{children}</UpliftAIRoomContext.Provider>;
};