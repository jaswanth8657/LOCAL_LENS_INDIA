import { useState, useRef, useCallback } from 'react';

// Web Speech API interface declarations for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface SpeechRecognitionState {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
}

export function useChatSpeechRecognition(onResultCallback: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
  const isSupported = Boolean(win && (win.SpeechRecognition || win.webkitSpeechRecognition));

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((lang: string = 'en-IN') => {
    setError(null);

    if (!isSupported || !win) {
      setError('Speech recognition is not supported in this browser. Please type your message, or use Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang; // Defaults to Indian English ('en-IN'), can also accept 'hi-IN'

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        const text = (finalTranscript || interim).trim();
        if (text) {
          // Deliver text to the editable chat input box
          // strictly WITHOUT automatically submitting!
          onResultCallback(text);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Microphone permission was denied. Please allow microphone permissions in your browser bar to speak, or simply type your message.');
        } else if (event.error === 'no-speech') {
          setError('No speech was detected. You can click the microphone to try again or type directly.');
        } else if (event.error === 'network') {
          setError('Speech network error. Please verify network access or use keyboard typing.');
        } else {
          setError(`Speech input error: ${event.error || 'Unable to recognize audio'}.`);
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setError(`Failed to initialize microphone: ${err?.message || 'Access error'}`);
      setIsListening(false);
    }
  }, [isSupported, win, onResultCallback]);

  return {
    isSupported,
    isListening,
    error,
    clearError: () => setError(null),
    startListening,
    stopListening,
  };
}

