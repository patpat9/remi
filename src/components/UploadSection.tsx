
"use client";

import React, { useState, ChangeEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageIcon, YoutubeIcon, FileAudioIcon, FileTextIcon, UploadCloud } from 'lucide-react';
import AppLogo from './AppLogo';
import { useAppContext } from './AppProvider';
import type { ContentType, ContentItem } from '@/lib/types';
import { contentToText, SummarizeContentInput } from '@/ai/flows/summarize-content'; // Removed summarizeContent as it's unused
import { useToast } from '@/hooks/use-toast';

const UploadSection = () => {
  const { dispatch } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState<Record<Exclude<ContentType, 'photo'>, boolean>>({
    youtube: false,
    audio: false,
    text: false,
  });
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const { toast } = useToast();

  const handleOpenChange = (type: Exclude<ContentType, 'photo'>, open: boolean) => {
    setDialogOpen(prev => ({ ...prev, [type]: open }));
    if (!open) { // Reset states on dialog close
      setYoutubeUrl('');
      setAudioFile(null);
      setTextContent('');
      setTextTitle('');
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

  const performUploadProcessing = async (type: ContentType, fileForPhoto?: File) => {
    const id = crypto.randomUUID();
    let newItemData: Omit<ContentItem, 'summary' | 'thumbnail' | 'id' | 'createdAt'> & { createdAt: string; id: string } | null = null;
    let aiInput: SummarizeContentInput | null = null;
    let thumbnail: string | undefined = undefined;
    let itemName: string = 'Uploaded Content';

    try {
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: true } });

      const currentTimeISO = new Date().toISOString();

      if (type === 'photo' && fileForPhoto) {
        itemName = fileForPhoto.name;
        const dataUrl = await readFileAsDataURL(fileForPhoto);
        newItemData = { id, type, name: fileForPhoto.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'photo', contentData: dataUrl };
        thumbnail = dataUrl;
      } else if (type === 'youtube' && youtubeUrl) {
        if (!youtubeUrl.match(/^(https|http):\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/)) {
          toast({ title: "Invalid YouTube URL", description: "Please enter a valid YouTube video URL.", variant: "destructive" });
          dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
          return;
        }
        itemName = 'YouTube Video';
        const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|watch\?v=)([\w-]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/0.jpg` : undefined;
        newItemData = { id, type, name: itemName, data: youtubeUrl, originalData: youtubeUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'youtube', contentData: youtubeUrl };
      } else if (type === 'audio' && audioFile) {
        itemName = audioFile.name;
        const dataUrl = await readFileAsDataURL(audioFile);
        newItemData = { id, type, name: audioFile.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'audio', contentData: dataUrl }; // Potentially large, be mindful
      } else if (type === 'text' && textContent) {
        itemName = textTitle || 'Untitled Text';
        newItemData = { id, type, name: itemName, data: textContent, originalData: textContent, createdAt: currentTimeISO };
        aiInput = { contentType: 'text', contentData: textContent };
      }

      if (newItemData) {
        const contentItem: ContentItem = { ...newItemData, thumbnail };
        dispatch({ type: 'ADD_CONTENT', payload: contentItem });
        dispatch({ type: 'SELECT_CONTENT', payload: id }); 

        if (type !== 'photo') {
           handleOpenChange(type as Exclude<ContentType, 'photo'>, false); // Close dialog for non-photo types
        }

        if (aiInput) {
          // Assuming contentToText is preferred over summarizeContent based on previous implementations
          const summaryResult = await contentToText(aiInput);
          dispatch({ type: 'UPDATE_CONTENT_SUMMARY', payload: { id, summary: summaryResult.summary } });
          toast({ title: "Content Added", description: `${itemName} added and summary generated.` });
        } else {
          // This branch might not be typical if all uploads trigger summarization
          dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
          toast({ title: "Content Added", description: `${itemName} added.` });
        }
      } else {
         dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
      }
    } catch (error) {
      console.error("Error processing upload or summary:", error);
      toast({ title: "Upload Error", description: "Could not process content or generate summary.", variant: "destructive" });
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
    }
  };

  const handlePhotoFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      await performUploadProcessing('photo', file);
      if (event.target) {
        event.target.value = ""; // Reset file input to allow selecting the same file again
      }
    }
  };
  
  const uploadOptions: Array<{
    type: ContentType;
    icon: JSX.Element;
    label: string;
    dialogContent?: JSX.Element;
    getIsDialogDisabled?: () => boolean;
  }> = [
    { type: 'photo', icon: <ImageIcon className="mr-2 h-5 w-5" />, label: 'Photo' },
    { 
      type: 'youtube' as ContentType, 
      icon: <YoutubeIcon className="mr-2 h-5 w-5" />, 
      label: 'YouTube', 
      dialogContent: (
        <Input type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
      ),
      getIsDialogDisabled: () => !youtubeUrl,
    },
    { 
      type: 'audio' as ContentType, 
      icon: <FileAudioIcon className="mr-2 h-5 w-5" />, 
      label: 'Audio', 
      dialogContent: (
        <Input type="file" accept="audio/*" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && setAudioFile(e.target.files[0])} />
      ),
      getIsDialogDisabled: () => !audioFile,
    },
    { 
      type: 'text' as ContentType, 
      icon: <FileTextIcon className="mr-2 h-5 w-5" />, 
      label: 'Text', 
      dialogContent: (
        <div className="space-y-2">
          <Input placeholder="Title (optional)" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
          <Textarea placeholder="Paste your text here..." value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={5} />
        </div>
      ),
      getIsDialogDisabled: () => !textContent,
    },
  ];

  return (
    <div className="p-4 border-b border-border space-y-4 bg-card shadow-sm rounded-b-lg">
      <AppLogo />
      <div className="grid grid-cols-2 gap-3">
        {uploadOptions.map(opt => {
          if (opt.type === 'photo') {
            return (
              <React.Fragment key={opt.type}>
                <Button
                  variant="outline"
                  className="flex items-center justify-start text-left w-full h-12 hover:bg-accent/50"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </Button>
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoFileSelected}
                />
              </React.Fragment>
            );
          }
          // For other types, use Dialog
          return (
            <Dialog 
              key={opt.type} 
              open={dialogOpen[opt.type as Exclude<ContentType, 'photo'>]} 
              onOpenChange={(open) => handleOpenChange(opt.type as Exclude<ContentType, 'photo'>, open)}
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
                    onClick={() => performUploadProcessing(opt.type)} 
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
