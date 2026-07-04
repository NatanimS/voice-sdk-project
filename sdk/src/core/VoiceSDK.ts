import { VoiceSDKConfig, RecognitionResult, ListenOptions, SpeakOptions, SDKState } from "../types";
import { StateMachine } from "./StateMachine";
import { WebSpeechProvider } from "../providers/WebSpeechProvider";
import { BackendSpeechProvider } from "../providers/BackendSpeechProvider";

interface RegisteredCommand {
  phrase: string;
  handler: (matchedText: string) => void;
}

export class VoiceSDK {
  private config: VoiceSDKConfig;
  private backendUrl: string;
  private stateMachine: StateMachine;
  private webSpeechProvider: WebSpeechProvider;
  private backendSpeechProvider: BackendSpeechProvider;
  private resultCallback: ((result: RecognitionResult) => void) | null = null;
  private errorCallback: ((error: { message: string; code: string }) => void) | null = null;
  private commands: RegisteredCommand[] = [];

  constructor(config: VoiceSDKConfig) {
    this.config = config;
    this.backendUrl = config.backendUrl || "http://127.0.0.1:8000";
    this.stateMachine = new StateMachine();
    this.webSpeechProvider = new WebSpeechProvider();
    this.backendSpeechProvider = new BackendSpeechProvider(this.backendUrl, config.apiKey);
  }

  private resolveLanguage(explicit?: "en" | "am"): "en" | "am" {
    if (explicit) return explicit;
    if (this.config.defaultLanguage && this.config.defaultLanguage !== "auto") {
      return this.config.defaultLanguage;
    }
    return "en";
  }

  private checkCommands(text: string): void {
    const lowerText = text.toLowerCase();
    for (const command of this.commands) {
      if (lowerText.includes(command.phrase.toLowerCase())) {
        command.handler(text);
      }
    }
  }

  /**
   * Calls our backend's intent recognition endpoint. This runs for BOTH
   * English and Amharic - intent recognition is always backend-side,
   * per our Phase 2 decision that it's a separate concern from speech
   * recognition itself. Fails gracefully (returns empty result) if the
   * backend is unreachable, so a developer's transcript still comes
   * through even if intent lookup fails.
   */
  private async fetchIntent(
    text: string,
    language: "en" | "am"
  ): Promise<{ intent?: string; entities?: Record<string, string> }> {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/intent`, {
        method: "POST",
        headers: {
          "X-API-Key": this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) return {};

      const data = await response.json();
      return { intent: data.intent, entities: data.entities };
    } catch {
      return {};
    }
  }

  registerCommand(phrase: string, handler: (matchedText: string) => void): void {
    this.commands.push({ phrase, handler });
  }

  startListening(options?: ListenOptions): Promise<void> {
    const language = this.resolveLanguage(options?.language);

    return new Promise((resolve, reject) => {
      this.stateMachine.setState("listening");

      const onResult = async (text: string) => {
        this.stateMachine.setState("processing");

        const { intent, entities } = await this.fetchIntent(text, language);

        const result: RecognitionResult = { text, language, intent, entities };

        if (this.resultCallback) {
          this.resultCallback(result);
        }

        this.checkCommands(text);
        this.stateMachine.setState("idle");
        resolve();
      };

      const onError = (errorMessage: string) => {
        this.stateMachine.setState("error");
        if (this.errorCallback) {
          this.errorCallback({ message: errorMessage, code: "RECOGNITION_ERROR" });
        }
        reject(errorMessage);
      };

      if (language === "am") {
        this.backendSpeechProvider.listen(onResult, onError);
      } else {
        this.webSpeechProvider.listen(onResult, onError);
      }
    });
  }

  stopListening(): void {
    this.webSpeechProvider.stop();
    this.backendSpeechProvider.stop();
    this.stateMachine.setState("idle");
  }

  speak(text: string, options?: SpeakOptions): Promise<void> {
    const language = this.resolveLanguage(options?.language);

    return new Promise((resolve) => {
      this.stateMachine.setState("speaking");

      const onDone = () => {
        this.stateMachine.setState("idle");
        resolve();
      };

      if (language === "am") {
        this.backendSpeechProvider.speak(text, onDone);
      } else {
        this.webSpeechProvider.speak(text, onDone);
      }
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

  assistant = {
    start: (language?: "en" | "am"): void => {
      this.startListening({ language }).catch(() => {});
    },
    stop: (): void => {
      this.stopListening();
    },
  };
}