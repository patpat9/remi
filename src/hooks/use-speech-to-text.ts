
"use client";

import { useState, useEffect, useCallback } from 'react';

interface SpeechToTextOptions {
  onResult?: (event: SpeechRecognitionEvent) => void; // Changed to pass the full event
  onError?: (error: SpeechRecognitionError) => void;
  onEnd?: () => void;
}

const useSpeechToText = (options?: SpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); // Internal transcript state
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const recogInstance = new SpeechRecognitionAPI();
    recogInstance.continuous = false; // Important for push-to-talk: get result on pause/stop
    recogInstance.interimResults = true;
    recogInstance.lang = 'en-US';

    recogInstance.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterimTranscript = '';
      let currentFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinalTranscript += event.results[i][0].transcript;
        } else {
          currentInterimTranscript += event.results[i][0].transcript;
        }
      }
      // Update internal transcript state for consumers that just want the latest string
      setTranscript(currentFinalTranscript || currentInterimTranscript);

      // Pass the raw event to the callback
      if (options?.onResult) {
        options.onResult(event);
      }
    };

    recogInstance.onerror = (event: SpeechRecognitionError) => {
      setError(event.error);
      setIsListening(false);
      if (options?.onError) {
        options.onError(event);
      }
    };

    recogInstance.onend = () => {
      setIsListening(false);
      if (options?.onEnd) {
        options.onEnd();
      }
    };
    
    setRecognition(recogInstance);

    return () => {
      recogInstance.stop();
    };
  }, [options]); // options is the dependency

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      try {
        setTranscript(''); // Clear internal transcript
        setError(null);
        recognition.start();
        setIsListening(true);
      } catch (e: any) {
        setError(e.message || 'Failed to start recognition');
        setIsListening(false);
      }
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
      // isListening will be set to false by the onend handler
    }
  }, [recognition, isListening]);

  return {
    isListening,
    transcript, // Consumers can still use this for live updates if needed
    error,
    startListening,
    stopListening,
    hasRecognitionSupport: !!recognition,
  };
};

export default useSpeechToText;
