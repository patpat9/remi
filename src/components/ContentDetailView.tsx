
"use client";

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from './AppProvider';
import { Loader2, InfoIcon } from 'lucide-react';

const ContentDetailView = () => {
  const { state, dispatch } = useAppContext();
  const selectedContent = state.contentItems.find(item => item.id === state.selectedContentId);
  const isLoadingSummary = selectedContent && state.isSummaryLoading[selectedContent.id];

  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (state.pendingMediaCommand && selectedContent && state.pendingMediaCommand.contentId === selectedContent.id) {
      const { mediaType, command } = state.pendingMediaCommand;

      if (mediaType === 'audio' && audioRef.current) {
        if (command === 'play') {
          audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        } else if (command === 'pause') {
          audioRef.current.pause();
        } else if (command === 'restart') {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.error("Error restarting audio:", e));
        }
      } else if (mediaType === 'youtube' && youtubeIframeRef.current && youtubeIframeRef.current.contentWindow) {
        const youtubeOrigin = 'https://www.youtube.com'; // Target origin for postMessage
        if (command === 'play') {
          youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', youtubeOrigin);
        } else if (command === 'pause') {
          youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', youtubeOrigin);
        } else if (command === 'restart') {
          // For restart, seek to 0 then play.
          youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0,true]}', youtubeOrigin);
          // A small delay might be needed before play, but postMessage is async anyway.
          setTimeout(() => {
             if (youtubeIframeRef.current && youtubeIframeRef.current.contentWindow) { // Re-check ref
                youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', youtubeOrigin);
             }
          }, 100); // 100ms delay
        }
      }
      dispatch({ type: 'CLEAR_PENDING_MEDIA_COMMAND' });
    }
  }, [state.pendingMediaCommand, selectedContent, dispatch]);


  if (!selectedContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/30 rounded-lg">
        <InfoIcon className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">Select an item</p>
        <p className="text-sm text-center">Choose an item from the list on the left to see its details here.</p>
      </div>
    );
  }

  const getYouTubeEmbedUrl = (url: string) => {
    let videoId;
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/watch?v=')) {
      videoId = new URL(url).searchParams.get('v');
    }
    
    if (!videoId) return null;

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set('enablejsapi', '1');
    // Set the origin parameter for JavaScript API control, crucial for postMessage.
    if (typeof window !== 'undefined') {
        embedUrl.searchParams.set('origin', window.location.origin);
    }
    return embedUrl.toString();
  };

  return (
    <ScrollArea className="h-full">
      <Card className="m-4 shadow-lg border-none rounded-lg overflow-hidden">
        <CardHeader className="bg-card p-4">
          <CardTitle className="text-xl truncate" title={selectedContent.name}>{selectedContent.name}</CardTitle>
          <CardDescription>{new Date(selectedContent.createdAt).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="max-h-[300px] min-h-[150px] flex items-center justify-center bg-muted rounded-md overflow-hidden">
            {selectedContent.type === 'photo' && selectedContent.data && (
              <Image 
                src={selectedContent.data} 
                alt={selectedContent.name} 
                width={500} height={300} 
                className="object-contain max-w-full max-h-[300px]"
                data-ai-hint="photo detail"
              />
            )}
            {selectedContent.type === 'youtube' && selectedContent.data && getYouTubeEmbedUrl(selectedContent.data) && (
              <iframe
                ref={youtubeIframeRef}
                className="w-full aspect-video rounded-md"
                src={getYouTubeEmbedUrl(selectedContent.data)!}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            )}
            {selectedContent.type === 'audio' && selectedContent.data && (
              <audio ref={audioRef} controls src={selectedContent.data} className="w-full">
                Your browser does not support the audio element.
              </audio>
            )}
            {selectedContent.type === 'text' && (
              <ScrollArea className="w-full h-[200px] p-3 border rounded-md bg-background">
                <pre className="text-sm whitespace-pre-wrap break-words">{selectedContent.data}</pre>
              </ScrollArea>
            )}
          </div>
          
          <div>
            <h3 className="text-md font-semibold mb-1 text-primary">Summary</h3>
            {isLoadingSummary && !selectedContent.summary && (
              <div className="flex items-center text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating summary...
              </div>
            )}
            {selectedContent.summary ? (
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                {selectedContent.summary}
              </p>
            ) : !isLoadingSummary && (
              <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">No summary available or still generating.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </ScrollArea>
  );
};

export default ContentDetailView;
