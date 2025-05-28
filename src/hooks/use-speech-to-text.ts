"use client";

import { useState, useEffect, useCallback } from 'react';

interface SpeechToTextOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: SpeechRecognitionError) => void;
  onEnd?: () => void;
}

const useSpeechToText = (options?: SpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const recogInstance = new SpeechRecognition();
    recogInstance.continuous = false;
    recogInstance.interimResults = true;
    recogInstance.lang = 'en-US';

    recogInstance.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
      if (options?.onResult && finalTranscript) {
        options.onResult(finalTranscript);
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
  }, [options]);

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      try {
        setTranscript('');
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
      setIsListening(false);
    }
  }, [recognition, isListening]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    hasRecognitionSupport: !!recognition,
  };
};

export default useSpeechToText;
