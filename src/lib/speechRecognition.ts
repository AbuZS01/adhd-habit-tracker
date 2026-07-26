/**
 * Minimal typing for the (non-standard, not in TS's DOM lib) Web Speech API,
 * just the surface LogEntryForm's dictation button uses. Browser support is
 * Chromium-only in practice, so this is always used behind a feature check.
 */

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultItem {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getConstructor() !== null;
}

/** Creates a recognition instance configured for short dictation in en-GB, or null if unsupported. */
export function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-GB';
  return recognition;
}

/** Concatenates only the finalised alternatives from a result event, space-separated. */
export function extractFinalTranscript(event: { resultIndex: number; results: SpeechRecognitionResultList }): string {
  const parts: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (result?.isFinal && result[0]) {
      parts.push(result[0].transcript.trim());
    }
  }
  return parts.join(' ');
}
