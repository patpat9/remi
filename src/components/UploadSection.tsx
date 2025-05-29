
"use client";

import React, { useState, ChangeEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon, YoutubeIcon, FileAudioIcon, FileTextIcon, UploadCloud } from 'lucide-react';
import AppLogo from './AppLogo';
import { useAppContext } from './AppProvider';
import type { ContentType, ContentItem } from '@/lib/types';
import { contentToText, SummarizeContentInput } from '@/ai/flows/summarize-content';
import { useToast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs-dist worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
}


const UploadSection = () => {
  const { dispatch } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState<Record<Extract<ContentType, 'youtube'>, boolean>>({
    youtube: false,
  });
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null); 
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const { toast } = useToast();

  const handleOpenChange = (type: Extract<ContentType, 'youtube'>, open: boolean) => {
    setDialogOpen(prev => ({ ...prev, [type]: open }));
    if (!open) {
      if (type === 'youtube') setYoutubeUrl('');
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  };

  const parsePdfToText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }
    let cleanedText = fullText.replace(/\s+/g, ' ').trim(); 
    return cleanedText;
  };


  const performUploadProcessing = async (type: ContentType, file?: File) => {
    const id = crypto.randomUUID();
    let newItemDataPartial: Omit<ContentItem, 'summary' | 'thumbnail' | 'id' | 'createdAt' | 'data' | 'originalData'> & { createdAt: string; id: string; data: string; originalData?: string; } | null = null;
    let aiInput: SummarizeContentInput | null = null;
    let thumbnail: string | undefined = undefined;
    let itemName: string = file?.name || 'Uploaded Content'; 

    try {
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: true } });
      const currentTimeISO = new Date().toISOString();

      if (type === 'photo' && file) {
        itemName = file.name;
        const dataUrl = await readFileAsDataURL(file);
        newItemDataPartial = { id, type, name: file.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'photo', contentData: dataUrl, contentName: itemName };
        thumbnail = dataUrl;
      } else if (type === 'youtube' && youtubeUrl) {
        let videoId: string | null = null;
        let playlistId: string | null = null;
        let actualVideoUrlForProcessing: string | null = null;
        itemName = 'YouTube Video'; 
        let processingShouldStop = false;

        try {
            const urlObj = new URL(youtubeUrl);
            const vParam = urlObj.searchParams.get('v');
            const listParam = urlObj.searchParams.get('list');

            if (listParam && !vParam) {
                toast({
                    title: "Playlist URL Detected",
                    description: "Please add individual videos from the playlist. Full playlist import is not currently supported.",
                    duration: 7000,
                });
                processingShouldStop = true;
            } else if (vParam) {
                videoId = vParam;
                playlistId = listParam; 
                actualVideoUrlForProcessing = `https://www.youtube.com/watch?v=${videoId}`;
                itemName = `YouTube Video: ${videoId}`;
                if (playlistId) {
                    itemName = `Video (from Playlist): ${videoId}`;
                    toast({
                        title: "Playlist Context Detected",
                        description: `Adding video '${videoId}'. Full playlist import is not supported.`,
                        duration: 7000,
                    });
                }
                thumbnail = `https://img.youtube.com/vi/${videoId}/0.jpg`;
            }
        } catch (e) {
            // URL parsing failed
        }

        if (!actualVideoUrlForProcessing && youtubeUrl.includes('youtu.be/')) {
            const shortVideoIdMatch = youtubeUrl.match(/youtu\.be\/([\w-]+)/);
            const shortVideoId = shortVideoIdMatch ? shortVideoIdMatch[1] : null;
            if (shortVideoId) {
                videoId = shortVideoId; 
                actualVideoUrlForProcessing = `https://www.youtube.com/watch?v=${shortVideoId}`;
                itemName = `YouTube Video: ${shortVideoId}`;
                thumbnail = `https://img.youtube.com/vi/${shortVideoId}/0.jpg`;
            }
        }
        
        const closeDialogAndClearInput = () => {
            handleOpenChange('youtube', false);
            setYoutubeUrl('');
        };

        if (processingShouldStop) {
            dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
            closeDialogAndClearInput();
            return;
        }

        if (actualVideoUrlForProcessing && videoId) {
            newItemDataPartial = { id, type, name: itemName, data: actualVideoUrlForProcessing, originalData: actualVideoUrlForProcessing, createdAt: currentTimeISO };
            aiInput = { contentType: 'youtube', contentData: actualVideoUrlForProcessing, contentName: itemName };
        } else {
             if (!(playlistId && !videoId)) { 
                toast({ title: "Invalid YouTube URL", description: "Please provide a valid YouTube video URL (e.g., watch?v=... or youtu.be/...)", variant: "destructive", duration: 7000 });
            }
            dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
            closeDialogAndClearInput();
            return; 
        }
      } else if (type === 'audio' && file) {
        itemName = file.name;
        const dataUrl = await readFileAsDataURL(file);
        newItemDataPartial = { id, type, name: file.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'audio', contentData: dataUrl, contentName: itemName };
      } else if (type === 'text' && file) {
        itemName = file.name;
        if (file.type === 'application/pdf') {
          const pdfDataUri = await readFileAsDataURL(file); 
          const extractedText = await parsePdfToText(file);
          newItemDataPartial = { id, type: 'text', name: file.name, data: extractedText, originalData: pdfDataUri, createdAt: currentTimeISO };
          aiInput = { contentType: 'text', contentData: extractedText, contentName: itemName };
        } else { 
          const rawText = await readFileAsText(file);
          newItemDataPartial = { id, type: 'text', name: file.name, data: rawText, originalData: rawText, createdAt: currentTimeISO };
          aiInput = { contentType: 'text', contentData: rawText, contentName: itemName };
        }
      }

      if (newItemDataPartial) {
        const contentItem: ContentItem = { 
          ...newItemDataPartial, 
          thumbnail 
        };
        dispatch({ type: 'ADD_CONTENT', payload: contentItem });
        dispatch({ type: 'SELECT_CONTENT', payload: id }); 

        if (aiInput) {
          const summaryResult = await contentToText(aiInput);
          dispatch({ type: 'UPDATE_CONTENT_SUMMARY', payload: { id, summary: summaryResult.summary } });
          toast({ title: "Content Added", description: `${itemName} added and summary generated.` });
        } else {
          dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
          toast({ title: "Content Added", description: `${itemName} added.` });
        }
        if (type === 'youtube') { 
            handleOpenChange('youtube', false);
            setYoutubeUrl('');
        }
      } else {
         if (!file && type !== 'youtube') { 
            dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
         }
      }
    } catch (error: any) {
      console.error(`Error processing ${itemName} (ID: ${id}):`, error);
      toast({ title: "Upload Error", description: error.message || `Could not process ${itemName || 'content'} or generate summary.`, variant: "destructive" });
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
      if (type === 'youtube') { 
        handleOpenChange('youtube', false);
        setYoutubeUrl('');
      }
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>, type: 'photo' | 'text' | 'audio') => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files); 
      
      const uploadPromises = files.map(file => performUploadProcessing(type, file));
      
      try {
        await Promise.all(uploadPromises);
      } catch (error) {
        // Individual errors are caught inside performUploadProcessing and shown as toasts.
        // This catch is for any unexpected errors from Promise.all itself.
        console.error("Error during parallel file processing setup:", error);
        toast({ title: "Processing Error", description: "An unexpected error occurred while processing multiple files.", variant: "destructive"});
      }

      if (event.target) {
        event.target.value = ""; 
      }
    }
  };
  
  const uploadOptions: Array<{
    type: ContentType;
    icon: JSX.Element;
    label: string;
    dialogContent?: JSX.Element;
    getIsDialogDisabled?: () => boolean;
    onClick?: () => void; 
    fileInputRef?: React.RefObject<HTMLInputElement>; 
    fileAccept?: string; 
    isMultiple?: boolean;
  }> = [
    { 
      type: 'photo', 
      icon: <ImageIcon className="mr-2 h-5 w-5" />, 
      label: 'Photo',
      onClick: () => photoInputRef.current?.click(),
      fileInputRef: photoInputRef,
      fileAccept: "image/*",
      isMultiple: true,
    },
    { 
      type: 'youtube', 
      icon: <YoutubeIcon className="mr-2 h-5 w-5" />, 
      label: 'YouTube', 
      dialogContent: (
        <Input type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
      ),
      getIsDialogDisabled: () => !youtubeUrl,
      isMultiple: false, 
    },
    { 
      type: 'audio', 
      icon: <FileAudioIcon className="mr-2 h-5 w-5" />, 
      label: 'Audio', 
      onClick: () => audioInputRef.current?.click(), 
      fileInputRef: audioInputRef,                 
      fileAccept: "audio/*",                        
      isMultiple: true,
    },
    { 
      type: 'text', 
      icon: <FileTextIcon className="mr-2 h-5 w-5" />, 
      label: 'Document', 
      onClick: () => documentInputRef.current?.click(),
      fileInputRef: documentInputRef,
      fileAccept: ".txt,.pdf,.md,.rtf,.doc,.docx,.odt,text/*,application/pdf",
      isMultiple: true,
    },
  ];

  return (
    <div className="p-4 border-b border-border space-y-4 bg-card shadow-sm rounded-b-lg">
      <AppLogo />
      <div className="grid grid-cols-2 gap-3">
        {uploadOptions.map(opt => {
          if (opt.onClick && opt.fileInputRef) { 
            return (
              <React.Fragment key={opt.type}>
                <Button
                  variant="outline"
                  className="flex items-center justify-start text-left w-full h-12 hover:bg-accent/50"
                  onClick={opt.onClick}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </Button>
                <input
                  type="file"
                  ref={opt.fileInputRef}
                  accept={opt.fileAccept}
                  multiple={opt.isMultiple} 
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelected(e, opt.type as 'photo' | 'text' | 'audio')}
                />
              </React.Fragment>
            );
          }
          
          return (
            <Dialog 
              key={opt.type} 
              open={dialogOpen[opt.type as Extract<ContentType, 'youtube'>]} 
              onOpenChange={(open) => handleOpenChange(opt.type as Extract<ContentType, 'youtube'>, open)}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center justify-start text-left w-full h-12 hover:bg-accent/50">
                  {opt.icon}
                  <span>{opt.label}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" /> Upload {opt.label}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor={opt.type} className="sr-only">Upload {opt.label}</Label>
                  {opt.dialogContent}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button 
                    onClick={() => performUploadProcessing(opt.type as ContentType)} 
                    disabled={opt.getIsDialogDisabled ? opt.getIsDialogDisabled() : false}
                  >
                    Add Content
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </div>
  );
};

export default UploadSection;
    

