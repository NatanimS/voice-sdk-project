/**
 * Shared type definitions for the Voice SDK.
 * Defining these once, in one place, means every other file can
 * import and reuse them - consistent shapes throughout the SDK.
 */
interface VoiceSDKConfig {
    apiKey: string;
    backendUrl?: string;
    defaultLanguage?: "en" | "am" | "auto";
}
type SDKState = "idle" | "listening" | "processing" | "speaking" | "error";
interface RecognitionResult {
    text: string;
    language: "en" | "am";
    intent?: string;
    entities?: Record<string, string>;
}
interface ListenOptions {
    language?: "en" | "am";
}
interface SpeakOptions {
    language?: "en" | "am";
}
interface SDKError {
    message: string;
    code: string;
}

declare class VoiceSDK {
    private config;
    private stateMachine;
    private webSpeechProvider;
    private resultCallback;
    private errorCallback;
    constructor(config: VoiceSDKConfig);
    startListening(options?: ListenOptions): Promise<void>;
    stopListening(): void;
    speak(text: string, options?: SpeakOptions): Promise<void>;
    onResult(callback: (result: RecognitionResult) => void): void;
    onStateChange(callback: (state: SDKState) => void): void;
    onError(callback: (error: {
        message: string;
        code: string;
    }) => void): void;
}

export { type ListenOptions, type RecognitionResult, type SDKError, type SDKState, type SpeakOptions, VoiceSDK, type VoiceSDKConfig };
