
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from './AppProvider';
import { Loader2, InfoIcon, Edit3, Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const ContentDetailView = () => {
  const { state, dispatch } = useAppContext();
  const selectedContent = state.contentItems.find(item => item.id === state.selectedContentId);
  const isLoadingSummary = selectedContent && state.isSummaryLoading[selectedContent.id];
  const isDuckingActive = state.activeDuckingReasons.size > 0;
  const { toast } = useToast();

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editableSummaryText, setEditableSummaryText] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (state.pendingMediaCommand && selectedContent && state.pendingMediaCommand.contentId === selectedContent.id) {
      const commandDetails = { ...state.pendingMediaCommand };
      const { mediaType, command } = commandDetails;
      const youtubeOrigin = 'https://www.youtube.com';

      let commandProcessed = false;
      let commandIsAsync = false;

      if (mediaType === 'audio' && audioRef.current) {
        if (command === 'play') {
          audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        } else if (command === 'pause') {
          audioRef.current.pause();
        } else if (command === 'restart') {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.error("Error restarting audio:", e));
        }
        commandProcessed = true;
      } else if (mediaType === 'youtube' && youtubeIframeRef.current) {
        commandIsAsync = true;
        const postPlayCommand = () => {
          if (youtubeIframeRef.current && youtubeIframeRef.current.contentWindow) {
            youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', youtubeOrigin);
          }
        };

        if (command === 'play') {
          setTimeout(() => {
            postPlayCommand();
            if (state.pendingMediaCommand &&
                commandDetails.contentId === state.pendingMediaCommand.contentId &&
                commandDetails.command === state.pendingMediaCommand.command) {
                 dispatch({ type: 'CLEAR_PENDING_MEDIA_COMMAND' });
            }
          }, 250);
        } else if (command === 'pause') {
          if (youtubeIframeRef.current.contentWindow) {
            youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', youtubeOrigin);
          }
          commandProcessed = true;
          commandIsAsync = false;
        } else if (command === 'restart') {
           if (youtubeIframeRef.current.contentWindow) {
            youtubeIframeRef.current.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0,true]}', youtubeOrigin);
          }
          setTimeout(() => {
            postPlayCommand();
            if (state.pendingMediaCommand &&
                commandDetails.contentId === state.pendingMediaCommand.contentId &&
                commandDetails.command === state.pendingMediaCommand.command) {
                 dispatch({ type: 'CLEAR_PENDING_MEDIA_COMMAND' });
            }
          }, 300);
        }
      }

      if (commandProcessed && !commandIsAsync) {
        dispatch({ type: 'CLEAR_PENDING_MEDIA_COMMAND' });
      }
    }
  }, [state.pendingMediaCommand, selectedContent, dispatch, state.contentItems]);


  useEffect(() => {
    const audioEl = audioRef.current;
    const youtubeWin = youtubeIframeRef.current?.contentWindow;
    const youtubeOrigin = 'https://www.youtube.com';

    if (!selectedContent || (selectedContent.type !== 'audio' && selectedContent.type !== 'youtube')) {
      return;
    }

    if (selectedContent.type === 'audio' && audioEl) {
      audioEl.volume = isDuckingActive ? 0.2 : 1.0;
    } else if (selectedContent.type === 'youtube' && youtubeWin) {
      const targetVolume = isDuckingActive ? 20 : 100;
      youtubeWin.postMessage(`{"event":"command","func":"setVolume","args":[${targetVolume}]}`, youtubeOrigin);
    }
  }, [isDuckingActive, selectedContent?.id, selectedContent?.type]);

  // Reset edit mode if selected content changes
  useEffect(() => {
    setIsEditingSummary(false);
    if (selectedContent) {
      setEditableSummaryText(selectedContent.summary || '');
    }
  }, [selectedContent?.id, selectedContent?.summary]);


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
    embedUrl.searchParams.set('autoplay', '1'); 
    if (typeof window !== 'undefined') {
        embedUrl.searchParams.set('origin', window.location.origin);
    }
    return embedUrl.toString();
  };

  const handleEditSummary = () => {
    if (selectedContent) {
      setEditableSummaryText(selectedContent.summary || '');
      setIsEditingSummary(true);
    }
  };

  const handleSaveSummary = () => {
    if (selectedContent) {
      dispatch({
        type: 'UPDATE_CONTENT_SUMMARY',
        payload: { id: selectedContent.id, summary: editableSummaryText },
      });
      setIsEditingSummary(false);
      toast({ title: "Summary Updated", description: "The summary has been saved." });
    }
  };

  const handleCancelEditSummary = () => {
    setIsEditingSummary(false);
    if (selectedContent) {
      setEditableSummaryText(selectedContent.summary || ''); // Reset to original
    }
  };

  if (!selectedContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/30 rounded-lg">
        <InfoIcon className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">Select an item</p>
        <p className="text-sm text-center">Choose an item from the list on the left to see its details here.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Card className="m-4 shadow-lg border-none rounded-lg overflow-hidden">
        <CardHeader className="bg-card p-4">
          <CardTitle className="text-xl truncate" title={selectedContent.name}>{selectedContent.name}</CardTitle>
          <CardDescription>{new Date(selectedContent.createdAt).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="min-h-[150px] flex items-center justify-center bg-muted rounded-md overflow-hidden">
            {selectedContent.type === 'photo' && selectedContent.data && (
              <Image
                src={selectedContent.data}
                alt={selectedContent.name}
                width={500} height={300}
                className="object-contain max-w-full max-h-full"
                data-ai-hint="photo detail"
              />
            )}
            {selectedContent.type === 'youtube' && selectedContent.data && getYouTubeEmbedUrl(selectedContent.data) && (
              <iframe
                key={selectedContent.id}
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
              <audio ref={audioRef} controls src={selectedContent.data} className="w-full" autoPlay={state.pendingMediaCommand?.command === 'play' && state.pendingMediaCommand?.contentId === selectedContent.id}>
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
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-md font-semibold text-primary">Summary</h3>
              {!isEditingSummary && selectedContent.type !== 'text' && ( // Don't allow editing summary of raw text content
                <Button variant="ghost" size="sm" onClick={handleEditSummary} className="px-2 py-1 h-auto">
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
              )}
            </div>

            {isEditingSummary ? (
              <div className="space-y-2">
                <Textarea
                  value={editableSummaryText}
                  onChange={(e) => setEditableSummaryText(e.target.value)}
                  placeholder="Enter summary..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEditSummary}>
                    <XCircle className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveSummary}>
                    <Save className="mr-1 h-4 w-4" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {isLoadingSummary && !selectedContent.summary && (
                  <div className="flex items-center text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating summary...
                  </div>
                )}
                {selectedContent.summary || (!isLoadingSummary && selectedContent.type === 'text' && !selectedContent.summary) ? ( // Also show for text if no summary yet
                  <ScrollArea className="h-28 rounded-md bg-muted/50">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words p-3">
                      {selectedContent.summary}
                      {selectedContent.type === 'text' && !selectedContent.summary && (
                        <span className="italic text-muted-foreground">Raw text content shown above. AI summary can be generated via chat if needed.</span>
                      )}
                    </p>
                  </ScrollArea>
                ) : !isLoadingSummary && (
                  <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">No summary available or still generating.</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </ScrollArea>
  );
};

export default ContentDetailView;
