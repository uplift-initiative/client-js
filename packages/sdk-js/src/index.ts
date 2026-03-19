import { UpliftAI } from './client';

export { UpliftAI } from './client';
export { UpliftAIError, UpliftAIAuthError, UpliftAIInsufficientBalanceError, UpliftAIRateLimitError } from './errors';
export type {
  UpliftAIOptions,
  OutputFormat,
  TTSRequest,
  AudioMetadata,
  AudioResponse,
  StreamResponse,
  EnqueueResponse,
  WSAudioStart,
  WSAudio,
  WSAudioEnd,
  WSError,
  TTSStreamEvent,
  TranscriptionRequest,
  TranscriptionRequestFromPath,
  TranscriptionRequestFromBuffer,
  TranscriptionResponse,
  PhraseReplacement,
  PhraseReplacementConfig,
  TTSStream,
  TTSWebSocket,
  WSReadyState,
} from './types';

export default UpliftAI;
