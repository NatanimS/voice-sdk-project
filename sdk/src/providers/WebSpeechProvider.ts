/**
 * Wraps the browser's native Web Speech API (SpeechRecognition +
 * SpeechSynthesis) for the English path - no backend involved.
 *
 * Isolating browser-specific code here means the rest of the SDK
 * never touches these APIs directly - matches our Phase 2 Adapter
 * pattern, just applied on the frontend side.
 */
export class WebSpeechProvider {
  private recognition: any;

  constructor() {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      throw new Error("Web Speech API is not supported in this browser.");
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.lang = "en-US";
    this.recognition.interimResults = false;
  }

  listen(onResult: (text: string) => void, onError: (message: string) => void): void {
    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    this.recognition.start();
  }

  stop(): void {
    this.recognition.stop();
  }

  speak(text: string, onDone: () => void): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onend = onDone;
    window.speechSynthesis.speak(utterance);
  }
}