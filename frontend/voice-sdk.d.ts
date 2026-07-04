/**
 * Type definitions for voice-sdk.js
 *
 * This file describes the shape of the SDK for TypeScript users and
 * editors with IntelliSense. It does not change any runtime behavior —
 * voice-sdk.js remains plain JavaScript. Keep this file in sync manually
 * whenever a public method's signature changes in voice-sdk.js.
 */

/** A single param value captured from a {placeholder} in a command pattern. */
export type CommandParams = Record<string, string>;

/** Result returned by transcribe() and stopListening(). */
export interface TranscriptResult {
  text: string;
  language: string;
  confidence: number;
}

/** Result returned by matchCommand() when a registered command matches. */
export interface CommandMatch {
  pattern: string;
  params: CommandParams;
}

/** Configuration accepted by the VoiceSDK constructor. */
export interface VoiceSDKConfig {
  /** Matches BACKEND_API_KEY on the server. Sent as the x-api-key header. */
  apiKey: string;
  /** Backend base URL, no trailing slash. Defaults to 'http://127.0.0.1:8000'. */
  baseUrl?: string;
  /** Language code used when a method call doesn't specify one. Defaults to 'en'. */
  defaultLanguage?: string;
}

/**
 * Error thrown by every VoiceSDK method on failure. A normal Error with
 * an added `status` field when the failure came from the backend.
 */
export class VoiceSDKError extends Error {
  name: 'VoiceSDKError';
  /** HTTP status code, if the error came from the backend. undefined for client-side errors
   * (e.g. mic permission denied, calling stopListening() without startListening() first). */
  status?: number;
  constructor(message: string, status?: number);
}

/**
 * A minimal client SDK for the Voice SDK backend — real-time
 * speech-to-text, text-to-speech, and voice command matching.
 */
export class VoiceSDK {
  apiKey: string;
  baseUrl: string;
  defaultLanguage: string;

  constructor(config: VoiceSDKConfig);

  /**
   * Converts text into speech and plays it immediately.
   * @throws {VoiceSDKError} if text is empty or the request fails
   * @returns the audio element that is playing
   */
  speak(text: string, language?: string): Promise<HTMLAudioElement>;

  /**
   * Sends a pre-recorded audio Blob to the backend and returns the transcript.
   * @throws {VoiceSDKError} if audioBlob is not a Blob, or the request fails
   */
  transcribe(audioBlob: Blob, language?: string): Promise<TranscriptResult>;

  /**
   * Requests microphone access and starts recording.
   * @throws {VoiceSDKError} if already listening
   */
  startListening(language?: string): Promise<void>;

  /**
   * Stops the current recording, releases the microphone, and returns the transcript.
   * @throws {VoiceSDKError} if not currently listening
   */
  stopListening(): Promise<TranscriptResult>;

  /**
   * Returns the raw MediaStream currently being recorded, or null if not listening.
   * Useful for building a custom audio visualizer without requesting mic access twice.
   */
  getActiveStream(): MediaStream | null;

  /**
   * Registers a voice command. Patterns are matched whole-phrase,
   * case-insensitively. Use {name} to capture part of the phrase.
   * @throws {VoiceSDKError} if pattern is empty or handler is not a function
   * @returns an unregister function — call it to remove this command later
   */
  registerCommand(pattern: string, handler: (params: CommandParams) => void): () => void;

  /** Removes every registered command matching this exact pattern string. */
  unregisterCommand(pattern: string): void;

  /**
   * Checks text against every registered command, in registration order.
   * Calls the first matching command's handler automatically.
   * @throws {VoiceSDKError} if text is not a string
   * @returns match details, or null if nothing matched
   */
  matchCommand(text: string): CommandMatch | null;
}

export default VoiceSDK;
