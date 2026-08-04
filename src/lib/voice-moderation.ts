/**
 * Live voice moderation using the device's built-in speech recognizer.
 * The transcript never leaves the device — only the verdict is acted on.
 */
import { useEffect, useRef, useState } from "react";
import { moderateText } from "@/lib/moderation";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

function getRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export interface VoiceModerationOptions {
  enabled: boolean;
  lang?: string;
  onViolation: (phrase: string, reason: string) => void;
}

export function useVoiceModeration({ enabled, lang = "en-IN", onViolation }: VoiceModerationOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const cbRef = useRef(onViolation);
  cbRef.current = onViolation;

  useEffect(() => {
    if (!enabled) return;
    const rec = getRecognizer();
    if (!rec) {
      setSupported(false);
      return;
    }
    setSupported(true);

    let stopped = false;
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: unknown) => {
      const ev = e as { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const phrase = ev.results[i]?.[0]?.transcript ?? "";
        if (!phrase.trim()) continue;
        const verdict = moderateText(phrase);
        if (!verdict.ok && verdict.severity >= 2) {
          cbRef.current(phrase, verdict.reason ?? "Abusive speech detected");
        }
      }
    };
    rec.onerror = () => { /* transient recognizer errors are ignored */ };
    rec.onend = () => {
      setListening(false);
      if (!stopped) {
        try { rec.start(); setListening(true); } catch { /* noop */ }
      }
    };

    try {
      rec.start();
      setListening(true);
    } catch { /* already started */ }

    return () => {
      stopped = true;
      try { rec.abort(); } catch { /* noop */ }
      setListening(false);
    };
  }, [enabled, lang]);

  return { supported, listening };
}
