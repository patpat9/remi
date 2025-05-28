
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
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}


const UploadSection = () => {
  const { dispatch } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState<Record<Exclude<ContentType, 'photo' | 'text'>, boolean>>({
    youtube: false,
    audio: false,
  });
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleOpenChange = (type: Exclude<ContentType, 'photo' | 'text' | 'document'>, open: boolean) => {
    setDialogOpen(prev => ({ ...prev, [type]: open }));
    if (!open) {
      setYoutubeUrl('');
      setAudioFile(null);
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
    return fullText;
  };


  const performUploadProcessing = async (type: ContentType, file?: File) => {
    const id = crypto.randomUUID();
    let newItemDataPartial: Omit<ContentItem, 'summary' | 'thumbnail' | 'id' | 'createdAt' | 'data' | 'originalData'> & { createdAt: string; id: string; data?: string; originalData?: string; } | null = null;
    let aiInput: SummarizeContentInput | null = null;
    let thumbnail: string | undefined = undefined;
    let itemName: string = 'Uploaded Content';

    try {
      dispatch({ type: 'SET_SUMMARY_LOADING', payload: { id, isLoading: true } });
      const currentTimeISO = new Date().toISOString();

      if (type === 'photo' && file) {
        itemName = file.name;
        const dataUrl = await readFileAsDataURL(file);
        newItemDataPartial = { id, type, name: file.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
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
        newItemDataPartial = { id, type, name: itemName, data: youtubeUrl, originalData: youtubeUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'youtube', contentData: youtubeUrl };
      } else if (type === 'audio' && audioFile) {
        itemName = audioFile.name;
        const dataUrl = await readFileAsDataURL(audioFile);
        newItemDataPartial = { id, type, name: audioFile.name, data: dataUrl, originalData: dataUrl, createdAt: currentTimeISO };
        aiInput = { contentType: 'audio', contentData: dataUrl };
      } else if (type === 'text' && file) {
        itemName = file.name;
        if (file.type === 'application/pdf') {
          const pdfDataUri = await readFileAsDataURL(file);
          const extractedText = await parsePdfToText(file);
          newItemDataPartial = { id, type: 'text', name: file.name, data: extractedText, originalData: pdfDataUri, createdAt: currentTimeISO };
          aiInput = { contentType: 'text', contentData: extractedText };
        } else {
          const rawText = await readFileAsText(file);
          newItemDataPartial = { id, type: 'text', name: file.name, data: rawText, originalData: rawText, createdAt: currentTimeISO };
          aiInput = { contentType: 'text', contentData: rawText };
        }
      }

      if (newItemDataPartial && newItemDataPartial.data !== undefined) {
        const contentItem: ContentItem = { 
          ...newItemDataPartial, 
          data: newItemDataPartial.data, // Ensure data is not undefined
          originalData: newItemDataPartial.originalData,
          thumbnail 
        };
        dispatch({ type: 'ADD_CONTENT', payload: contentItem });
        dispatch({ type: 'SELECT_CONTENT', payload: id }); 

        if (type === 'youtube' || type === 'audio') {
           handleOpenChange(type as Exclude<ContentType, 'photo' | 'text'>, false);
        }

        if (aiInput) {
          const summaryResult = await contentToText(aiInput);
          dispatch({ type: 'UPDATE_CONTENT_SUMMARY', payload: { id, summary: summaryResult.summary } });
          toast({ title: "Content Added", description: `${itemName} added and summary generated.` });
        } else {
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

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>, type: 'photo' | 'text') => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      await performUploadProcessing(type, file);
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
    onFileChange?: (event: ChangeEvent<HTMLInputElement>) => void; 
  }> = [
    { 
      type: 'photo', 
      icon: <ImageIcon className="mr-2 h-5 w-5" />, 
      label: 'Photo',
      onClick: () => photoInputRef.current?.click(),
      fileInputRef: photoInputRef,
      fileAccept: "image/*",
      onFileChange: (e) => handleFileSelected(e, 'photo'),
    },
    { 
      type: 'youtube', 
      icon: <YoutubeIcon className="mr-2 h-5 w-5" />, 
      label: 'YouTube', 
      dialogContent: (
        <Input type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
      ),
      getIsDialogDisabled: () => !youtubeUrl,
    },
    { 
      type: 'audio', 
      icon: <FileAudioIcon className="mr-2 h-5 w-5" />, 
      label: 'Audio', 
      dialogContent: (
        <Input type="file" accept="audio/*" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && setAudioFile(e.target.files[0])} />
      ),
      getIsDialogDisabled: () => !audioFile,
    },
    { 
      type: 'text', 
      icon: <FileTextIcon className="mr-2 h-5 w-5" />, 
      label: 'Document', 
      onClick: () => documentInputRef.current?.click(),
      fileInputRef: documentInputRef,
      fileAccept: ".txt,.pdf,.md,.rtf,.doc,.docx,.odt,text/*,application/pdf",
      onFileChange: (e) => handleFileSelected(e, 'text'),
    },
  ];

  return (
    <div className="p-4 border-b border-border space-y-4 bg-card shadow-sm rounded-b-lg">
      <AppLogo />
      <div className="grid grid-cols-2 gap-3">
        {uploadOptions.map(opt => {
          if (opt.onClick && opt.fileInputRef && opt.onFileChange) { 
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
                  style={{ display: 'none' }}
                  onChange={opt.onFileChange}
                />
              </React.Fragment>
            );
          }
          
          return (
            <Dialog 
              key={opt.type} 
              open={dialogOpen[opt.type as Exclude<ContentType, 'photo' | 'text'>]} 
              onOpenChange={(open) => handleOpenChange(opt.type as Exclude<ContentType, 'photo' | 'text'>, open)}
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
                    onClick={() => performUploadProcessing(opt.type, opt.type === 'audio' ? audioFile : undefined)} 
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
