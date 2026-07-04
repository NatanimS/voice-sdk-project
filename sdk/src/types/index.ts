/**
 * Shared type definitions for the Voice SDK.
 * Defining these once, in one place, means every other file can
 * import and reuse them - consistent shapes throughout the SDK.
 */

export interface VoiceSDKConfig {
  apiKey: string;
  backendUrl?: string;
  defaultLanguage?: "en" | "am" | "auto";
}

export type SDKState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface RecognitionResult {
  text: string;
  language: "en" | "am";
  intent?: string;
  entities?: Record<string, string>;
}

export interface ListenOptions {
  language?: "en" | "am";
}

export interface SpeakOptions {
  language?: "en" | "am";
}

export interface SDKError {
  message: string;
  code: string;
}