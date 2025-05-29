
"use client";

import React from 'react';
import Image from 'next/image';
import type { ContentItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageIcon, YoutubeIcon, FileAudioIcon, FileTextIcon, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from './AppProvider';
import { useToast } from '@/hooks/use-toast';

interface ContentListItemProps {
  item: ContentItem;
}

const ContentListItemIcon = ({ type }: { type: ContentItem['type'] }) => {
  switch (type) {
    case 'photo': return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    case 'youtube': return <YoutubeIcon className="h-5 w-5 text-muted-foreground" />;
    case 'audio': return <FileAudioIcon className="h-5 w-5 text-muted-foreground" />;
    case 'text': return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
    default: return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
  }
};

const ContentListItem = ({ item }: ContentListItemProps) => {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const isSelected = state.selectedContentId === item.id;
  const isLoadingSummary = state.isSummaryLoading[item.id];

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent Card onClick from firing
    dispatch({ type: 'DELETE_CONTENT', payload: item.id });
    toast({
      title: "Content Deleted",
      description: `"${item.name}" has been removed.`,
    });
  };

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md w-full overflow-hidden",
        isSelected ? "border-primary ring-2 ring-primary shadow-lg" : "border-border"
      )}
      onClick={() => dispatch({ type: 'SELECT_CONTENT', payload: item.id })}
      aria-current={isSelected ? "page" : undefined}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 z-10 h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 size={16} />
      </Button>

      <CardHeader className="p-2">
        <div className="flex items-start space-x-2">
          {item.thumbnail ? (
            <Image 
              src={item.thumbnail} 
              alt={item.name} 
              width={40}
              height={40}
              className="rounded-md object-cover h-10 w-10 aspect-square shrink-0"
              data-ai-hint={item.type === 'photo' ? 'item preview' : `${item.type} content`}
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <ContentListItemIcon type={item.type} />
            </div>
          )}
          {/* Added overflow-hidden to this div */}
          <div className="flex-1 min-w-0 pr-8 overflow-hidden"> 
            <CardTitle className="text-sm font-semibold truncate leading-tight" title={item.name}>
              {item.name}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-tight pt-0.5">
              {new Date(item.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {(item.summary || isLoadingSummary) && (
        <CardContent className="px-2 pb-2 pt-0">
           {isLoadingSummary && !item.summary && (
            <div className="flex items-center text-xs text-muted-foreground pr-8">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Generating summary...
            </div>
          )}
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug pr-8 break-words">
              {item.summary}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ContentListItem;
