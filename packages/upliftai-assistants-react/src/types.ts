export interface ToolInvocationData {
  requestId: string;
  callerIdentity: string;
  payload: string;
  responseTimeout: number;
}

export interface ParameterConfig {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: any[];
  items?: ParameterConfig;
  properties?: Record<string, ParameterConfig>;
  required?: string[];
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterConfig>;
    required?: string[];
  };
  timeout: number;
  handler: (data: ToolInvocationData) => Promise<string>;
}

export interface ToolUpdateRequest {
  action: 'add' | 'remove' | 'replace';
  tools: ToolConfig[];
}

export interface UpliftAIRoomContextValue {
  addTool: (toolConfig: ToolConfig) => Promise<void>;
  updateTool: (toolConfig: ToolConfig) => Promise<void>;
  removeTool: (toolName: string) => Promise<void>;
  upsertTools: (toolConfigs: ToolConfig[]) => Promise<void>;
  updateInstruction: (instruction: string) => Promise<void>;
  isConnected: boolean;
  agentParticipant: any | null;
}