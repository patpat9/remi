
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Send, Loader2, MessageSquareIcon } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { useAppContext } from './AppProvider';
import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { generateStoriesFromContent } from '@/ai/flows/generate-stories-from-content';
import { useToast } from '@/hooks/use-toast';
import useSpeechToText from '@/hooks/use-speech-to-text';

const ChatInterface = () => {
  const { state, dispatch } = useAppContext();
  const [inputText, setInputText] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false); // New state for controlling scroll
  const { toast } = useToast();

  const selectedContent = state.contentItems.find(item => item.id === state.selectedContentId);

  const {
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    hasRecognitionSupport,
  } = useSpeechToText({
    onResult: (finalTranscript) => {
      setInputText(finalTranscript);
    },
    onError: (event) => {
      toast({ title: "Voice Input Error", description: event.error || "Could not process voice input.", variant: "destructive" });
    },
  });
  
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (speechError) {
      toast({ title: "Voice Recognition Error", description: speechError, variant: "destructive" });
    }
  }, [speechError, toast]);

  // Effect 1: Detect new messages and signal a scroll is needed
  useEffect(() => {
    if (state.chatMessages.length > 0) {
      // Check if the last message is new or if it's the initial load
      // This simple check assumes new messages are appended.
      // A more robust check might involve comparing message IDs or timestamps
      // if the message list could be reordered or messages pre-loaded.
      setNeedsScroll(true);
    }
  }, [state.chatMessages]);

  // Effect 2: Perform scroll when needsScroll is true
  useEffect(() => {
    if (needsScroll) {
      const attemptScroll = () => {
        if (scrollAreaRef.current) {
          const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
          if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
          }
        }
      };

      // Schedule the scroll attempt
      const timeoutId = setTimeout(attemptScroll, 0);
      
      // Reset the flag synchronously to prevent re-triggering this effect unnecessarily
      setNeedsScroll(false); 

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [needsScroll]); // Only depend on needsScroll.

  const handleSendMessage = async () => {
    if (!inputText.trim() && !state.isChatLoading) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date(),
      relatedContentId: selectedContent?.id,
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
    setInputText('');
    dispatch({ type: 'SET_CHAT_LOADING', payload: true });

    try {
      let aiResponseText: string;
      if (selectedContent?.summary) {
        const result = await generateStoriesFromContent({
          prompt: userMessage.text,
          contentSummary: selectedContent.summary,
        });
        aiResponseText = result.story;
      } else {
        aiResponseText = "I can help you best if you select some content. What would you like to talk about?";
        if (userMessage.text.toLowerCase().includes("story") || userMessage.text.toLowerCase().includes("tell me about")) {
          aiResponseText = "Please select an item from your content list first, then I can tell you a story or discuss it."
        }
      }
      
      const aiMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
        relatedContentId: selectedContent?.id,
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: aiMessage });
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
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="h-full flex flex-col bg-card shadow-sm rounded-t-lg overflow-hidden border-t border-border">
      <div className="p-3 border-b border-border bg-muted/50">
        <h3 className="text-md font-semibold text-foreground flex items-center">
          <MessageSquareIcon className="mr-2 h-5 w-5 text-primary" />
          Chat with Remi
        </h3>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {state.chatMessages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Ask about your selected content or tell Remi to create a story!
          </div>
        )}
        {state.chatMessages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
      </ScrollArea>
      <div className="p-3 border-t border-border bg-muted/30">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center space-x-2">
          {hasRecognitionSupport && (
          <Button type="button" variant="outline" size="icon" onClick={toggleListening} disabled={state.isChatLoading}>
            <Mic className={isListening ? "text-destructive animate-pulse" : ""} />
          </Button>
          )}
          <Input
            type="text"
            placeholder={isListening ? "Listening..." : "Type your message..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={state.isChatLoading || isListening}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={state.isChatLoading || !inputText.trim()}>
            {state.isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
