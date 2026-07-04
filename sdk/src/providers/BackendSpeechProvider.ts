/**
 * Talks to our FastAPI backend for the Amharic path - recording audio
 * via MediaRecorder, sending it to /api/v1/stt, and calling /api/v1/tts
 * for speech output. Mirrors WebSpeechProvider's shape (listen/stop/speak)
 * so VoiceSDK can treat both providers interchangeably.
 */
export class BackendSpeechProvider {
  private backendUrl: string;
  private apiKey: string;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(backendUrl: string, apiKey: string) {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
  }

  async listen(
    onResult: (text: string) => void,
    onError: (message: string) => void
  ): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          formData.append("language", "am");

          const response = await fetch(`${this.backendUrl}/api/v1/stt`, {
            method: "POST",
            headers: { "X-API-Key": this.apiKey },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
          }

          const data = await response.json();
          onResult(data.text);
        } catch (err: any) {
          onError(err.message || "Failed to transcribe audio");
        }
      };

      this.mediaRecorder.start();
    } catch (err: any) {
      onError(err.message || "Microphone access failed");
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  async speak(text: string, onDone: () => void): Promise<void> {
    const response = await fetch(`${this.backendUrl}/api/v1/tts`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, language: "am" }),
    });

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onended = onDone;
    audio.play();
  }
}