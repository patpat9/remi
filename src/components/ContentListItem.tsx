"use client";

import React from 'react';
import Image from 'next/image';
import type { ContentItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageIcon, YoutubeIcon, FileAudioIcon, FileTextIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from './AppProvider';

interface ContentListItemProps {
  item: ContentItem;
}

const ContentListItemIcon = ({ type }: { type: ContentItem['type'] }) => {
  switch (type) {
    case 'photo': return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
    case 'youtube': return <YoutubeIcon className="h-6 w-6 text-muted-foreground" />;
    case 'audio': return <FileAudioIcon className="h-6 w-6 text-muted-foreground" />;
    case 'text': return <FileTextIcon className="h-6 w-6 text-muted-foreground" />;
    default: return <FileTextIcon className="h-6 w-6 text-muted-foreground" />;
  }
};

const ContentListItem = ({ item }: ContentListItemProps) => {
  const { state, dispatch } = useAppContext();
  const isSelected = state.selectedContentId === item.id;
  const isLoadingSummary = state.isSummaryLoading[item.id];

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md",
        isSelected ? "border-primary ring-2 ring-primary shadow-lg" : "border-border"
      )}
      onClick={() => dispatch({ type: 'SELECT_CONTENT', payload: item.id })}
      aria-current={isSelected ? "page" : undefined}
    >
      <CardHeader className="p-3">
        <div className="flex items-start space-x-3">
          {item.thumbnail ? (
            <Image 
              src={item.thumbnail} 
              alt={item.name} 
              width={64} 
              height={64} 
              className="rounded-md object-cover h-16 w-16 aspect-square" 
              data-ai-hint={item.type === 'photo' ? 'item preview' : `${item.type} content`}
            />
          ) : (
            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
              <ContentListItemIcon type={item.type} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate" title={item.name}>
              {item.name}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {(item.summary || isLoadingSummary) && (
        <CardContent className="p-3 pt-0">
           {isLoadingSummary && !item.summary && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Generating summary...
            </div>
          )}
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.summary}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ContentListItem;
