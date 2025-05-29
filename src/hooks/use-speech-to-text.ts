
"use client";

import { useState, useEffect, useCallback } from 'react';

interface SpeechToTextOptions {
  onResult?: (event: SpeechRecognitionEvent) => void;
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

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const recogInstance = new SpeechRecognitionAPI();
    recogInstance.continuous = true; 
    recogInstance.interimResults = true;
    recogInstance.lang = 'en-US';

    recogInstance.onstart = () => { // Explicitly set isListening on API start
      setIsListening(true);
    };

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
      setTranscript(currentFinalTranscript || currentInterimTranscript);
      if (options?.onResult) {
        options.onResult(event);
      }
    };

    recogInstance.onerror = (event: SpeechRecognitionError) => {
      setError(event.error);
      setIsListening(false); // Ensure isListening is false on error
      if (options?.onError) {
        options.onError(event);
      }
    };

    recogInstance.onend = () => {
      setIsListening(false); // Ensure isListening is false when API ends
      if (options?.onEnd) {
        options.onEnd();
      }
    };
    
    setRecognition(recogInstance);

    return () => {
      if (recogInstance) { // Ensure recogInstance exists before trying to stop
        recogInstance.stop();
      }
    };
  }, [options]);

  const startListening = useCallback(() => {
    if (recognition && !isListening) { // Guard with hook's isListening
      try {
        setTranscript('');
        setError(null);
        recognition.start();
        // isListening will be set to true by recogInstance.onstart
      } catch (e: any) {
        setError(e.message || 'Failed to start recognition');
        setIsListening(false); // Ensure state consistency if start fails
      }
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition) {
      // Always attempt to stop the recognition if the instance exists.
      // The onend event will handle setting isListening to false.
      recognition.stop();
    }
  }, [recognition]); // Removed isListening from dependencies

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
