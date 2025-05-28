"use client";

import { AppProvider } from '@/components/AppProvider';
import UploadSection from '@/components/UploadSection';
import ContentList from '@/components/ContentList';
import ContentDetailView from '@/components/ContentDetailView';
import ChatInterface from '@/components/ChatInterface';

export default function HomePage() {
  return (
    <AppProvider>
      <div className="flex h-screen max-h-screen overflow-hidden bg-background text-foreground">
        {/* Left Panel */}
        <div className="w-[320px] min-w-[280px] max-w-[400px] flex flex-col border-r border-border">
          <UploadSection />
          <div className="flex-1 overflow-y-auto"> {/* Ensure ContentList can scroll if it overflows */}
            <ContentList />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden"> {/* This column will also manage overflow */}
          {/* Content Detail View (takes up remaining space, scrollable internally) */}
          <div className="flex-1 overflow-y-auto"> {/* Allows ContentDetailView to scroll if its content is too long */}
             <ContentDetailView />
          </div>
          {/* Chat Interface (fixed height at the bottom) */}
          <div className="h-[300px] min-h-[250px] border-t border-border"> {/* Fixed height for chat */}
            <ChatInterface />
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
