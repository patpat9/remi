
export type ContentType = 'photo' | 'youtube' | 'audio' | 'text';

export interface ContentItem {
  id: string;
  type: ContentType;
  name: string;
  data: string; // URL for photo/youtube/audio (or data URI for uploaded), text content for text
  originalData?: File | string; // To store original file or youtube URL
  thumbnail?: string; // Data URI or URL
  summary?: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  relatedContentId?: string; // Optionally link message to a piece of content
}
