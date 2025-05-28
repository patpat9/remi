"use client";

import React, { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageIcon, YoutubeIcon, FileAudioIcon, FileTextIcon, UploadCloud } from 'lucide-react';
import AppLogo from './AppLogo';
import { useAppContext } from './AppProvider';
import type { ContentType, ContentItem } from '@/lib/types';
import { summarizeContent, SummarizeContentInput } from '@/ai/flows/summarize-content';
import { useToast } from '@/hooks/use-toast';

const UploadSection = () => {
  const { dispatch } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState<Record<ContentType, boolean>>({
    photo: false,
    youtube: false,
    audio: false,
    text: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const { toast } = useToast();

  const handleOpenChange = (type: ContentType, open: boolean) => {
    setDialogOpen(prev => ({ ...prev, [type]: open }));
    if (!open) { // Reset states on dialog close
      setPhotoFile(null);
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
  
  const handleFileUpload = async (type: ContentType) => {
    const id = crypto.randomUUID();
    let newItem: Omit<ContentItem, 'summary' | 'thumbnail'> | null = null;
    let aiInput: SummarizeContentInput | null = null;
    let thumbnail: string | undefined = undefined;

    try {
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: true } });

      if (type === 'photo' && photoFile) {
        const dataUrl = await readFileAsDataURL(photoFile);
        newItem = { id, type, name: photoFile.name, data: dataUrl, originalData: photoFile, createdAt: new Date() };
        aiInput = { contentType: 'photo', contentData: dataUrl };
        thumbnail = dataUrl;
      } else if (type === 'youtube' && youtubeUrl) {
        if (!youtubeUrl.match(/^(https|http):\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/)) {
          toast({ title: "Invalid YouTube URL", description: "Please enter a valid YouTube video URL.", variant: "destructive" });
          dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
          return;
        }
        const videoId = youtubeUrl.includes('youtu.be') ? youtubeUrl.split('/').pop()?.split('?')[0] : new URL(youtubeUrl).searchParams.get('v');
        thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/0.jpg` : undefined;
        newItem = { id, type, name: 'YouTube Video', data: youtubeUrl, originalData: youtubeUrl, createdAt: new Date() };
        aiInput = { contentType: 'youtube', contentData: youtubeUrl };
      } else if (type === 'audio' && audioFile) {
        const dataUrl = await readFileAsDataURL(audioFile);
        newItem = { id, type, name: audioFile.name, data: dataUrl, originalData: audioFile, createdAt: new Date() };
        aiInput = { contentType: 'audio', contentData: dataUrl }; // Potentially large, be mindful
      } else if (type === 'text' && textContent) {
        const name = textTitle || 'Untitled Text';
        newItem = { id, type, name, data: textContent, originalData: textContent, createdAt: new Date() };
        aiInput = { contentType: 'text', contentData: textContent };
      }

      if (newItem) {
        const contentItem: ContentItem = { ...newItem, thumbnail };
        dispatch({ type: 'ADD_CONTENT', payload: contentItem });
        dispatch({ type: 'SELECT_CONTENT', payload: id }); // Select the new content
        handleOpenChange(type, false); // Close dialog

        if (aiInput) {
          const summaryResult = await summarizeContent(aiInput);
          dispatch({ type: 'UPDATE_CONTENT_SUMMARY', payload: { id, summary: summaryResult.summary } });
          toast({ title: "Content Added", description: `${newItem.name} added and summary generated.` });
        } else {
          dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: false } });
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
  
  const uploadOptions = [
    { type: 'photo' as ContentType, icon: <ImageIcon className="mr-2 h-5 w-5" />, label: 'Photo', content: (
      <Input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && setPhotoFile(e.target.files[0])} />
    )},
    { type: 'youtube' as ContentType, icon: <YoutubeIcon className="mr-2 h-5 w-5" />, label: 'YouTube', content: (
      <Input type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
    )},
    { type: 'audio' as ContentType, icon: <FileAudioIcon className="mr-2 h-5 w-5" />, label: 'Audio', content: (
      <Input type="file" accept="audio/*" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && setAudioFile(e.target.files[0])} />
    )},
    { type: 'text' as ContentType, icon: <FileTextIcon className="mr-2 h-5 w-5" />, label: 'Text', content: (
      <div className="space-y-2">
        <Input placeholder="Title (optional)" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
        <Textarea placeholder="Paste your text here..." value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={5} />
      </div>
    )},
  ];

  return (
    <div className="p-4 border-b border-border space-y-4 bg-card shadow-sm rounded-b-lg">
      <AppLogo />
      <div className="grid grid-cols-2 gap-3">
        {uploadOptions.map(opt => (
          <Dialog key={opt.type} open={dialogOpen[opt.type]} onOpenChange={(open) => handleOpenChange(opt.type, open)}>
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
                {opt.content}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={() => handleFileUpload(opt.type)} disabled={
                  (opt.type === 'photo' && !photoFile) ||
                  (opt.type === 'youtube' && !youtubeUrl) ||
                  (opt.type === 'audio' && !audioFile) ||
                  (opt.type === 'text' && !textContent)
                }>Add Content</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
};

export default UploadSection;
