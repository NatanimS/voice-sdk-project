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
    private backendUrl;
    private stateMachine;
    private webSpeechProvider;
    private backendSpeechProvider;
    private resultCallback;
    private errorCallback;
    private commands;
    constructor(config: VoiceSDKConfig);
    private resolveLanguage;
    private checkCommands;
    /**
     * Calls our backend's intent recognition endpoint. This runs for BOTH
     * English and Amharic - intent recognition is always backend-side,
     * per our Phase 2 decision that it's a separate concern from speech
     * recognition itself. Fails gracefully (returns empty result) if the
     * backend is unreachable, so a developer's transcript still comes
     * through even if intent lookup fails.
     */
    private fetchIntent;
    registerCommand(phrase: string, handler: (matchedText: string) => void): void;
    startListening(options?: ListenOptions): Promise<void>;
    stopListening(): void;
    speak(text: string, options?: SpeakOptions): Promise<void>;
    onResult(callback: (result: RecognitionResult) => void): void;
    onStateChange(callback: (state: SDKState) => void): void;
    onError(callback: (error: {
        message: string;
        code: string;
    }) => void): void;
    assistant: {
        start: (language?: "en" | "am") => void;
        stop: () => void;
    };
}

export { type ListenOptions, type RecognitionResult, type SDKError, type SDKState, type SpeakOptions, VoiceSDK, type VoiceSDKConfig };
