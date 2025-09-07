import { useState, useCallback } from 'react';
import {
  UpliftAIRoom,
  useUpliftAIRoom,
  useVoiceAssistant,
  BarVisualizer,
  DisconnectButton,
  TrackToggle,
  useTracks,
  AudioTrack,
  ToolConfig,
} from '@upliftai/assistants-react';
import { Track } from 'livekit-client';
import './App.css';

const SAMPLE_TOOLS: ToolConfig[] = [
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
    timeout: 10,
    handler: async (data) => {
      const payload = JSON.parse(data.payload);
      console.log('get_weather_tool called: ' + data.payload)

      const { location } = payload.arguments.raw_arguments as { location: string };
      
      const weatherData = {
        location,
        temperature: Math.floor(Math.random() * 30 + 50),
        condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
      };
      
      const resposne = JSON.stringify({
        result: weatherData,
        presentationInstructions: `The weather in ${location} is ${weatherData.temperature}°F and ${weatherData.condition}`,
      });
      console.log('sending get_weather resposne: ' + resposne);
      return resposne;
    },
  },
  {
  name: 'random_joke_maker',
    description: 'Get a random kid-friendly joke',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional joke category (animal, school, food)',
        },
      },
      required: [],
    },
    timeout: 5,
    handler: async (data) => {
      const payload = JSON.parse(data.payload);
      console.log('random_joke_maker called: ' + data.payload)


      const { category } = payload.arguments.raw_arguments as { category?: string };
      
      const jokes = [
        {
          setup: "Why don't scientists trust atoms?",
          punchline: "Because they make up everything!",
          category: "science"
        },
        {
          setup: "What do you call a bear with no teeth?",
          punchline: "A gummy bear!",
          category: "animal"
        },
        {
          setup: "Why did the math book look so sad?",
          punchline: "Because it had too many problems!",
          category: "school"
        },
        {
          setup: "What do you call cheese that isn't yours?",
          punchline: "Nacho cheese!",
          category: "food"
        },
        {
          setup: "Why can't a bicycle stand up by itself?",
          punchline: "It's two tired!",
          category: "general"
        }
      ];
      
      const availableJokes = category 
        ? jokes.filter(j => j.category === category)
        : jokes;
      
      if (availableJokes.length === 0) {
        return JSON.stringify({
          error: 'No jokes found for that category',
          presentationInstructions: 'No jokes available in that category. Try: animal, school, or food. Relay the message in the preferred language.',
        });
      }
      
      // Select random joke
      const randomJoke = availableJokes[Math.floor(Math.random() * availableJokes.length)];
      
      const response = JSON.stringify({
        joke: randomJoke,
        presentationInstructions: `${randomJoke.setup}\n\n${randomJoke.punchline} 😄`,
      });
      console.log('sending response for random_joke_maker: ' + response);
      return response;

    },
  },
];

function AssistantView() {
  const { updateInstruction, addTool, removeTool, isConnected, agentParticipant } = useUpliftAIRoom();
  const { state: agentState } = useVoiceAssistant();
  const [instructions, setInstructions] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });
  
  const agentTrack = tracks.find((t) => !t.participant.isLocal);

  const handleUpdateInstructions = useCallback(async () => {
    if (!instructions.trim()) return;
    
    try {
      await updateInstruction(instructions);
      alert('Instructions updated successfully');
    } catch (error) {
      console.error('Failed to update instructions:', error);
      alert('Failed to update instructions');
    }
  }, [instructions, updateInstruction]);

  const handleToggleTool = useCallback(
    async (tool: ToolConfig) => {
      try {
        if (activeTools.includes(tool.name)) {
          await removeTool(tool.name);
          setActiveTools(activeTools.filter((name) => name !== tool.name));
        } else {
          await addTool(tool);
          setActiveTools([...activeTools, tool.name]);
        }
      } catch (error) {
        console.error('Failed to toggle tool:', error);
        alert(`Failed to ${activeTools.includes(tool.name) ? 'remove' : 'add'} tool`);
      }
    },
    [activeTools, addTool, removeTool]
  );

  return (
    <div className="assistant-container">
      <div className="status-bar">
        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {agentParticipant && (
          <span className="agent-info">Agent: {agentParticipant.identity}</span>
        )}
      </div>

      <div className="visualizer">
        {agentTrack && (
          <>
            <AudioTrack trackRef={agentTrack} />
            <BarVisualizer
              state={agentState}
              trackRef={agentTrack}
              className="bar-visualizer"
            />
          </>
        )}
        <div className="agent-state">
          {agentState === 'speaking' && 'Speaking...'}
          {agentState === 'thinking' && 'Thinking...'}
          {agentState === 'listening' && 'Listening...'}
        </div>
      </div>

      <div className="controls">
        <div className="instructions-section">
          <h3>Instructions</h3>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter custom instructions for the assistant..."
            rows={4}
          />
          <button onClick={handleUpdateInstructions} disabled={!isConnected}>
            Update Instructions
          </button>
        </div>

        <div className="tools-section">
          <h3>Available Tools</h3>
          <div className="tools-list">
            {SAMPLE_TOOLS.map((tool) => (
              <div key={tool.name} className="tool-item">
                <label>
                  <input
                    type="checkbox"
                    checked={activeTools.includes(tool.name)}
                    onChange={() => handleToggleTool(tool)}
                    disabled={!isConnected}
                  />
                  <span className="tool-name">{tool.name}</span>
                  <span className="tool-description">{tool.description}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="audio-controls">
          <TrackToggle source={Track.Source.Microphone} />
          <DisconnectButton>
            End Call
          </DisconnectButton>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [sessionData, setSessionData] = useState<{
    token: string;
    wsUrl: string;
  } | null>(null);
  const [assistantId, setAssistantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    if (!assistantId.trim()) {
      setError('Please enter an Assistant ID');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // if you are not using a public assistant this call will be through your backend and with your 
      // api key, on the endpoint `https://api.upliftai.org/v1/realtime-assistants/${assistantId}/createSession`

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

      if (!response.ok) {
        if (response.status === 404) {
          setError('Assistant not found. Please check your Assistant ID.');
        } else if (response.status === 403) {
          setError('This assistant is not public. If this is your assistant, please ensure public access is enabled before using it here.');
        } else {
          setError(`Failed to create session (Error ${response.status}). Please try again.`);
        }
        return;
      }

      const data = await response.json();
      setSessionData({
        token: data.token,
        wsUrl: data.wsUrl,
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionData) {
    return (
      <div className="connect-screen">
        <h1>UpliftAI Assistant Demo</h1>
        <div className="connect-form">
          <input
            type="text"
            placeholder="Enter Assistant ID"
            value={assistantId}
            onChange={(e) => {
              setAssistantId(e.target.value);
              setError(null);
            }}
          />
          <button onClick={createSession} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
        {error && (
          <div style={{
            color: '#dc3545',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '12px',
            margin: '10px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        <p className="hint">
          Enter your UpliftAI Assistant ID to connect. Make sure your assistant is configured for public access.

          <br/>
          <br/>
          You can create your assistant at <a href='https://upliftai.org'>Uplift AI Platform</a> for free to try out.
        </p>
      </div>
    );
  }

  return (
    <UpliftAIRoom
      token={sessionData.token}
      serverUrl={sessionData.wsUrl}
      connect={true}
      audio={true}
      video={false}
      tools={[]}
      onConnectionChange={(connected, agentIdentity) => {
        console.log('Connection changed:', connected, agentIdentity);
      }}
    >
      <AssistantView />
    </UpliftAIRoom>
  );
}

export default App;