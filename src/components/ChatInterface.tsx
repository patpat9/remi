
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, Send, Loader2, MessageSquareIcon } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { useAppContext } from './AppProvider';
import type { ChatMessage as ChatMessageType, ContentItem, SpeechRecognitionError } from '@/lib/types';
import { remiChat, RemiChatInput, RemiChatOutput } from '@/ai/flows/remi-chat-flow';
import { useToast } from '@/hooks/use-toast';
import useSpeechToText from '@/hooks/use-speech-to-text';

const ChatInterface = () => {
  const { state, dispatch } = useAppContext();
  const [inputText, setInputText] = useState('');
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const finalTranscriptRef = useRef<string>('');
  const spacebarIsControllingPttRef = useRef(false);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.5; 
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Browser does not support Speech Synthesis.");
    }
  };

  const handleSendMessage = useCallback(async (textOverride?: string) => {
    const messageText = (textOverride || inputText).trim();
    if (!messageText && !state.isChatLoading) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
    
    if (!textOverride) { 
        setInputText('');
    }

    dispatch({ type: 'SET_CHAT_LOADING', payload: true });

    try {
      const availableContentForAI = state.contentItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        information: item.type === 'text' ?
          (item.data || "No text content available for this item.") :
          (item.summary || `A summary for this ${item.type} content (name: ${item.name}) is not yet available or applicable.`)
      }));

      let currentSelectedItemInfoForAI: RemiChatInput['currentSelectedItemInfo'] = undefined;
      if (state.selectedContentId) {
        const selectedItem = state.contentItems.find(item => item.id === state.selectedContentId);
        if (selectedItem) {
          currentSelectedItemInfoForAI = {
            id: selectedItem.id,
            name: selectedItem.name,
            type: selectedItem.type,
            information: selectedItem.type === 'text' ?
              (selectedItem.data || "No text content available for this item.") :
              (selectedItem.summary || `A summary for this ${selectedItem.type} content (name: ${selectedItem.name}) is not yet available or applicable.`)
          };
        }
      }

      const aiInput: RemiChatInput = {
        userMessage: messageText,
        availableContent: availableContentForAI,
        currentSelectedItemInfo: currentSelectedItemInfoForAI,
      };

      const result: RemiChatOutput = await remiChat(aiInput);
      const aiResponseText = result.aiResponse;

      const aiMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: aiMessage });
      speakText(aiResponseText); 

      if (result.selectedContentIdByAi) {
        dispatch({ type: 'SELECT_CONTENT', payload: result.selectedContentIdByAi });
      }

      if (result.mediaCommandToExecute) {
        if (result.mediaCommandToExecute.contentId && result.mediaCommandToExecute.contentId !== state.selectedContentId) {
            if(!result.selectedContentIdByAi || result.selectedContentIdByAi !== result.mediaCommandToExecute.contentId) {
                 dispatch({ type: 'SELECT_CONTENT', payload: result.mediaCommandToExecute.contentId });
            }
        }
        dispatch({ type: 'SET_PENDING_MEDIA_COMMAND', payload: result.mediaCommandToExecute });
      }

    } catch (error) {
      console.error("Error with AI chat:", error);
      toast({ title: "AI Chat Error", description: "Could not get a response from AI.", variant: "destructive" });
      const errorMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: errorMessage });
      speakText("Sorry, I encountered an error. Please try again."); 
    } finally {
      dispatch({ type: 'SET_CHAT_LOADING', payload: false });
    }
  }, [dispatch, state.contentItems, state.selectedContentId, state.isChatLoading, toast, inputText]);

  const onSpeechResultCallback = useCallback((event: SpeechRecognitionEvent) => {
    let fullFinalTranscript = ""; 
    let currentInterimTranscript = "";

    // Iterate through all results in the event to reconstruct the full final transcript
    for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
            fullFinalTranscript += result[0].transcript + " "; // Add space for concatenation
        } else {
            currentInterimTranscript += result[0].transcript;
        }
    }
    fullFinalTranscript = fullFinalTranscript.trim(); // Trim trailing space

    // If there's any final transcript content from this event or previous, update the ref
    if (fullFinalTranscript) {
        finalTranscriptRef.current = fullFinalTranscript;
    } else if (event.results.length > 0 && event.results[event.results.length-1].isFinal === false && !finalTranscriptRef.current && !currentInterimTranscript) {
        // If only interim results and no final results yet, but speech has started, clear ref in case of stutter start.
        // This is less likely with continuous mode but covers edge cases.
        finalTranscriptRef.current = '';
    }
    
    // For display, use the latest full final transcript and append the current interim part.
    // If finalTranscriptRef is empty, it means no final parts yet, so just show interim.
    const displayTranscript = (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + currentInterimTranscript.trim();
    setInputText(displayTranscript.trim());

  }, []);


  const handleSpeechError = useCallback((event: SpeechRecognitionError) => {
    toast({ title: "Voice Input Error", description: event.error || "Could not process voice input.", variant: "destructive" });
    finalTranscriptRef.current = ''; 
    setInputText('');
  }, [toast]);
  
  const onSpeechEndCallback = useCallback(() => {
    // This callback is primarily for the hook to update its 'isListening' state.
    // The actual sending of message on button release is handled in handleMicMouseUp.
  }, []);
  
  const speechToTextOptions = useMemo(() => ({
    onResult: onSpeechResultCallback,
    onError: handleSpeechError,
    onEnd: onSpeechEndCallback,
  }), [onSpeechResultCallback, handleSpeechError, onSpeechEndCallback]);

  const {
    isListening,
    error: speechError,
    startListening,
    stopListening,
    hasRecognitionSupport,
  } = useSpeechToText(speechToTextOptions);

  const handleMicMouseDown = useCallback(() => {
    if (state.isChatLoading || !hasRecognitionSupport || isListening) return;
    finalTranscriptRef.current = ''; 
    setInputText(''); 
    startListening();
  }, [state.isChatLoading, hasRecognitionSupport, startListening, isListening]);

  const handleMicMouseUp = useCallback(() => {
    if (!hasRecognitionSupport) return; 
    
    stopListening(); 

    setTimeout(() => {
      const messageToSend = finalTranscriptRef.current.trim();
      if (messageToSend) {
        handleSendMessage(messageToSend);
      }
      finalTranscriptRef.current = ''; 
      setInputText(''); 
    }, 50); 

  }, [hasRecognitionSupport, stopListening, handleSendMessage]);


  useEffect(() => {
    if (speechError) {
      toast({ title: "Voice Recognition Error", description: speechError, variant: "destructive" });
    }
  }, [speechError, toast]);

  useEffect(() => {
    const div = chatContainerRef.current;
    if (div) {
      const timer = setTimeout(() => {
        div.scrollTop = div.scrollHeight;
      }, 50); // Slightly increased delay for scroll
      return () => clearTimeout(timer);
    }
  }, [state.chatMessages]);


  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === ' ' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !isListening && 
        !state.isChatLoading && 
        hasRecognitionSupport
      ) {
        event.preventDefault();
        handleMicMouseDown(); 
        spacebarIsControllingPttRef.current = true;
      }
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === ' ' &&
        spacebarIsControllingPttRef.current && 
        hasRecognitionSupport 
      ) {
        event.preventDefault();
        handleMicMouseUp(); 
        spacebarIsControllingPttRef.current = false;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [isListening, state.isChatLoading, hasRecognitionSupport, handleMicMouseDown, handleMicMouseUp]);

  useEffect(() => {
    return () => {
      if (spacebarIsControllingPttRef.current) {
        stopListening(); 
        spacebarIsControllingPttRef.current = false;
      }
    };
  }, [stopListening]);


  return (
    <div className="h-full flex flex-col bg-card shadow-sm rounded-t-lg overflow-hidden border-t border-border">
      <div className="p-3 border-b border-border bg-muted/50">
        <h3 className="text-md font-semibold text-foreground flex items-center">
          <MessageSquareIcon className="mr-2 h-5 w-5 text-primary" />
          Chat with Remi
        </h3>
      </div>
      <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto">
        {state.chatMessages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Chat with Remi about your uploaded content, or ask anything else!
            {hasRecognitionSupport && <p className="text-xs mt-1">(Try holding Spacebar or Mic button to talk)</p>}
          </div>
        )}
        {state.chatMessages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
      </div>
      <div className="p-3 border-t border-border bg-muted/30">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center space-x-2">
          {hasRecognitionSupport && (
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            onMouseDown={(e) => { e.preventDefault(); if (!spacebarIsControllingPttRef.current) handleMicMouseDown(); }}
            onMouseUp={(e) => { e.preventDefault(); if (!spacebarIsControllingPttRef.current) handleMicMouseUp(); }}
            onTouchStart={(e) => { e.preventDefault(); if (!spacebarIsControllingPttRef.current) handleMicMouseDown(); }}
            onTouchEnd={(e) => { e.preventDefault(); if (!spacebarIsControllingPttRef.current) handleMicMouseUp(); }}     
            disabled={state.isChatLoading}
            className={isListening && !spacebarIsControllingPttRef.current ? "bg-accent text-accent-foreground" : ""}
            aria-label="Record voice message (or hold Spacebar)"
          >
            <Mic className={isListening ? "text-destructive animate-pulse" : ""} />
          </Button>
          )}
          <Input
            type="text"
            placeholder={isListening ? "Listening..." : "Type or hold Space/Mic to talk..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={state.isChatLoading || (isListening && !spacebarIsControllingPttRef.current && document.activeElement?.tagName !== 'INPUT')}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={state.isChatLoading || (!inputText.trim() && !isListening)}>
            {state.isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
    
