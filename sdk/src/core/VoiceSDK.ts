import { VoiceSDKConfig, RecognitionResult, ListenOptions, SpeakOptions, SDKState } from "../types";
import { StateMachine } from "./StateMachine";
import { WebSpeechProvider } from "../providers/WebSpeechProvider";

export class VoiceSDK {
  private config: VoiceSDKConfig;
  private stateMachine: StateMachine;
  private webSpeechProvider: WebSpeechProvider;
  private resultCallback: ((result: RecognitionResult) => void) | null = null;
  private errorCallback: ((error: { message: string; code: string }) => void) | null = null;

  constructor(config: VoiceSDKConfig) {
    this.config = config;
    this.stateMachine = new StateMachine();
    this.webSpeechProvider = new WebSpeechProvider();
  }

  startListening(options?: ListenOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stateMachine.setState("listening");

      this.webSpeechProvider.listen(
        (text: string) => {
          this.stateMachine.setState("processing");

          const result: RecognitionResult = {
            text,
            language: "en",
          };

          if (this.resultCallback) {
            this.resultCallback(result);
          }

          this.stateMachine.setState("idle");
          resolve();
        },
        (errorMessage: string) => {
          this.stateMachine.setState("error");
          if (this.errorCallback) {
            this.errorCallback({ message: errorMessage, code: "RECOGNITION_ERROR" });
          }
          reject(errorMessage);
        }
      );
    });
  }

  stopListening(): void {
    this.webSpeechProvider.stop();
    this.stateMachine.setState("idle");
  }

  speak(text: string, options?: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      this.stateMachine.setState("speaking");
      this.webSpeechProvider.speak(text, () => {
        this.stateMachine.setState("idle");
        resolve();
      });
    });
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.resultCallback = callback;
  }

  onStateChange(callback: (state: SDKState) => void): void {
    this.stateMachine.onChange(callback);
  }

  onError(callback: (error: { message: string; code: string }) => void): void {
    this.errorCallback = callback;
  }
}