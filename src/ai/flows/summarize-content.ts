
'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing uploaded content.
 *
 * - summarizeContent - A function that handles the content summarization process. (Note: This is the flow, contentToText is the exported helper)
 * - SummarizeContentInput - The input type for the summarizeContent function.
 * - SummarizeContentOutput - The return type for the summarizeContent function.
 * - contentToText - An exported helper function that calls the AI model directly for summarization.
 */

import {ai, contentToTextAi} from '@/ai/genkit'; // Ensure ai is imported if you plan to use defineFlow/definePrompt
import {z} from 'genkit';

const SummarizeContentInputSchema = z.object({
  contentType: z.enum(['photo', 'youtube', 'audio', 'text']).describe('The type of the content being summarized.'),
  contentData: z.string().describe('The content data. For photos/audio: data URI. For YouTube: URL. For text: raw text content (extracted from PDF or read from file).'),
});
export type SummarizeContentInput = z.infer<typeof SummarizeContentInputSchema>;

const SummarizeContentOutputSchema = z.object({
  summary: z.string().describe('A summary of the content. For YouTube, this will be a more detailed overview.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

// This function is directly used by UploadSection.tsx
export async function contentToText(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
  let promptParts: Array<{ text: string } | { media: { url: string, contentType?: string } }> = [];
  let summarizationInstruction: string;

  if (input.contentType === 'youtube') {
    // Pass the YouTube URL as a media part for the model to process the video content
    promptParts.push({ media: { url: input.contentData } });
    summarizationInstruction = `You are an AI assistant. For the provided YouTube video, describe its content in detail. What are the main topics, key takeaways, and overall narrative or purpose of the video? This detailed description will be used by another AI to discuss the video with a user. Focus on extracting factual information and key points.`;
  } else if (input.contentType === 'text') {
    promptParts.push({ text: input.contentData }); // Pass the raw text
    summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with text content. Your task is to generate a concise summary of this text. Content Type: ${input.contentType}`;
  } else if (input.contentType === 'photo' || input.contentType === 'audio') {
    const dataUri = input.contentData;
    // Extract MIME type from data URI, e.g., "data:image/jpeg;base64,..." -> "image/jpeg"
    const mimeTypeMatch = dataUri.match(/^data:([A-Za-z-+\/]+);/);
    if (!mimeTypeMatch || !mimeTypeMatch[1]) {
      console.error("Invalid data URI or missing MIME type for photo/audio content:", dataUri.substring(0, 100));
      return { summary: "Error: Could not process media content due to invalid data format. MIME type missing." };
    }
    const mimeType = mimeTypeMatch[1];
    promptParts.push({ media: { url: dataUri, contentType: mimeType } });
    summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with ${input.contentType} content (MIME type: ${mimeType}). Your task is to generate a concise summary of the content.`;
  } else {
    // Should not happen with current enum, but good for safety
    console.error("Unsupported content type for summarization:", input.contentType);
    return { summary: "Unsupported content type." };
  }
  
  promptParts.push({ text: summarizationInstruction });

  try {
    const response = await contentToTextAi.generate({ prompt: promptParts });
    return { summary: response.text };
  } catch (error) {
    console.error(`Error generating summary for ${input.contentType}:`, error);
    return { summary: `Error generating summary. Details: ${error instanceof Error ? error.message : String(error)}`};
  }
}

// Example of how a full flow might be defined if needed later, not currently used by UploadSection.tsx for summarization.
const summarizeContentFlowInternal = ai.defineFlow(
  {
    name: 'summarizeContentFlow',
    inputSchema: SummarizeContentInputSchema,
    outputSchema: SummarizeContentOutputSchema,
  },
  async (input) => {
    let promptParts: Array<{ text: string } | { media: { url: string, contentType?: string } }> = [];
    let summarizationInstruction: string;

    if (input.contentType === 'youtube') {
      promptParts.push({ media: { url:input.contentData } });
      summarizationInstruction = `You are an AI assistant. For the provided YouTube video, describe its content in detail. What are the main topics, key takeaways, and overall narrative or purpose of the video? This detailed description will be used by another AI to discuss the video with a user. Focus on extracting factual information and key points.`;
    } else if (input.contentType === 'text') {
      promptParts.push({ text: input.contentData });
      summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with text content. Your task is to generate a concise summary of this text. Content Type: ${input.contentType}`;
    } else if (input.contentType === 'photo' || input.contentType === 'audio') {
      const dataUri = input.contentData;
      const mimeTypeMatch = dataUri.match(/^data:([A-Za-z-+\/]+);/);
      if (!mimeTypeMatch || !mimeTypeMatch[1]) {
        console.error("Invalid data URI or missing MIME type for photo/audio content in flow:", dataUri.substring(0, 100));
        return { summary: "Error: Could not process media content due to invalid data format in flow. MIME type missing." };
      }
      const mimeType = mimeTypeMatch[1];
      promptParts.push({ media: { url: dataUri, contentType: mimeType } });
      summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with ${input.contentType} content (MIME type: ${mimeType}). Your task is to generate a concise summary of the content.`;
    } else {
      return { summary: "Unsupported content type for summarization flow." };
    }
    
    promptParts.push({ text: summarizationInstruction });
    
    try {
        // Using ai.generate within a flow context, assuming 'ai' is configured with a suitable model.
        const response = await ai.generate({ prompt: promptParts }); 
        return { summary: response.text };
    } catch (error) {
        console.error(`Error generating summary in flow for ${input.contentType}:`, error);
        return { summary: `Error generating summary in flow. Details: ${error instanceof Error ? error.message : String(error)}`};
    }
  }
);

// Exported wrapper if using the flow (not current path for UploadSection)
// export async function summarizeContent(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
//   return summarizeContentFlowInternal(input);
// }

