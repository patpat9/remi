"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ContentListItem from './ContentListItem';
import { useAppContext } from './AppProvider';

const ContentList = () => {
  const { state } = useAppContext();

  if (state.contentItems.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
        <p className="text-sm">No content uploaded yet.</p>
        <p className="text-xs">Use the buttons above to add photos, videos, audio, or text.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-3">
        {state.contentItems.map(item => (
          <ContentListItem key={item.id} item={item} />
        ))}
      </div>
    </ScrollArea>
  );
};

export default ContentList;
