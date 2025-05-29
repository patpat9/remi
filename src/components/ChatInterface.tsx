
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
    
    if (!textOverride) { // Clear input text only if it was a typed message
        setInputText('');
    }
    // For speech, inputText will be cleared by onSpeechEnd or onMicMouseDown

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
    } finally {
      dispatch({ type: 'SET_CHAT_LOADING', payload: false });
    }
  }, [dispatch, state.contentItems, state.selectedContentId, state.isChatLoading, toast, inputText]);


  const onSpeechResultCallback = useCallback((event: SpeechRecognitionEvent) => {
    let accumulatedFinalTranscript = '';
    let currentInterimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptSegment = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        accumulatedFinalTranscript += transcriptSegment;
      } else {
        currentInterimTranscript += transcriptSegment;
      }
    }
    setInputText(accumulatedFinalTranscript + currentInterimTranscript); // Show live updates
    if (accumulatedFinalTranscript) {
      finalTranscriptRef.current = accumulatedFinalTranscript;
    }
  }, []);

  const handleSpeechError = useCallback((event: SpeechRecognitionError) => {
    toast({ title: "Voice Input Error", description: event.error || "Could not process voice input.", variant: "destructive" });
    finalTranscriptRef.current = ''; // Clear any partial transcript on error
    setInputText('');
  }, [toast]);

  const onSpeechEndCallback = useCallback(() => {
    if (finalTranscriptRef.current && finalTranscriptRef.current.trim() !== '') {
      handleSendMessage(finalTranscriptRef.current.trim());
    }
    finalTranscriptRef.current = '';
    // setInputText(''); // Cleared by handleSendMessage or onMicMouseDown
  }, [handleSendMessage]);
  
  const speechToTextOptions = useMemo(() => ({
    onResult: onSpeechResultCallback,
    onError: handleSpeechError,
    onEnd: onSpeechEndCallback,
  }), [onSpeechResultCallback, handleSpeechError, onSpeechEndCallback]);

  const {
    isListening,
    // transcript, // We are using inputText for visual and finalTranscriptRef for sending
    error: speechError,
    startListening,
    stopListening,
    hasRecognitionSupport,
  } = useSpeechToText(speechToTextOptions);

  useEffect(() => {
    if (speechError) {
      toast({ title: "Voice Recognition Error", description: speechError, variant: "destructive" });
    }
  }, [speechError, toast]);

  useEffect(() => {
    if (chatContainerRef.current) {
      const element = chatContainerRef.current;
      setTimeout(() => {
        element.scrollTop = element.scrollHeight;
      }, 0);
    }
  }, [state.chatMessages]);

  const handleMicMouseDown = () => {
    if (state.isChatLoading || !hasRecognitionSupport) return;
    finalTranscriptRef.current = '';
    setInputText('');
    startListening();
  };

  const handleMicMouseUp = () => {
    if (!hasRecognitionSupport) return;
    stopListening();
  };

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
            onMouseDown={handleMicMouseDown}
            onMouseUp={handleMicMouseUp}
            onTouchStart={handleMicMouseDown} // Basic touch support
            onTouchEnd={handleMicMouseUp}     // Basic touch support
            disabled={state.isChatLoading}
            className={isListening ? "bg-accent text-accent-foreground" : ""}
          >
            <Mic className={isListening ? "text-destructive animate-pulse" : ""} />
          </Button>
          )}
          <Input
            type="text"
            placeholder={isListening ? "Listening..." : "Type your message..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={state.isChatLoading || isListening} // Disable typing while listening
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
