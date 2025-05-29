
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
  contentName: z.string().optional().describe('The name of the content item, for logging purposes.'),
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
  // Initialize summarizationInstruction to prevent undefined if no branches match
  let summarizationInstruction: string = `Summarize the provided content.`; 

  if (input.contentType === 'youtube') {
    promptParts.push({ media: { url: input.contentData, contentType: 'video/mp4' } });
    summarizationInstruction = `You are an AI assistant. For the provided YouTube video, describe its content in detail. What are the main topics, key takeaways, and overall narrative or purpose of the video? This detailed description will be used by another AI to discuss the video with a user. Focus on extracting factual information and key points.`;
  } else if (input.contentType === 'text') {
    promptParts.push({ text: input.contentData }); // Pass the raw text
    summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with text content. Your task is to generate a concise summary of this text. Content Type: ${input.contentType}`;
  } else if (input.contentType === 'photo' || input.contentType === 'audio') {
    const dataUri = input.contentData;

    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
      console.error(`Invalid data URI format for ${input.contentType} content (Name: ${input.contentName || 'N/A'}):`, dataUri ? String(dataUri).substring(0,100) : "undefined/null dataUri");
      return { summary: "Error: Media data provided for photo/audio is not a valid data URI." };
    }

    const mimeTypeMatch = dataUri.match(/^data:([A-Za-z-+\/]+);/);
    if (!mimeTypeMatch || !mimeTypeMatch[1] || mimeTypeMatch[1].trim() === '') {
      console.error(`Invalid data URI or missing/empty MIME type for ${input.contentType} content (Name: ${input.contentName || 'N/A'}). URI starts with:`, dataUri.substring(0, 100));
      return { summary: "Error: Could not process media content due to invalid data format. MIME type missing or empty." };
    }
    const mimeType = mimeTypeMatch[1].trim();

    promptParts.push({ media: { url: dataUri, contentType: mimeType } });
    summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with ${input.contentType} content (MIME type: ${mimeType}). Your task is to generate a concise summary of the content.`;
  } else {
    console.error(`Unsupported content type for summarization (Name: ${input.contentName || 'N/A'}):`, input.contentType);
    return { summary: `Unsupported content type: ${input.contentType}. Cannot generate summary.` };
  }
  
  promptParts.push({ text: summarizationInstruction });

  try {
    const response = await contentToTextAi.generate({ prompt: promptParts });
    return { summary: response.text || "Summary could not be generated (empty response)." };
  } catch (error) {
    console.error(`Error generating summary for ${input.contentType} (Name: ${input.contentName || 'N/A'}):`, error);
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
    let summarizationInstruction: string = `Summarize the provided content.`;

    if (input.contentType === 'youtube') {
      console.log('!!!video');
      promptParts.push({ media: { url: input.contentData, contentType: 'video/mp4' } });
      summarizationInstruction = `You are an AI assistant. For the provided YouTube video, describe its content in detail. What are the main topics, key takeaways, and overall narrative or purpose of the video? This detailed description will be used by another AI to discuss the video with a user. Focus on extracting factual information and key points.`;
    } else if (input.contentType === 'text') {
      promptParts.push({ text: input.contentData });
      summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with text content. Your task is to generate a concise summary of this text. Content Type: ${input.contentType}`;
    } else if (input.contentType === 'photo' || input.contentType === 'audio') {
      const dataUri = input.contentData;
      if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
        console.error(`Flow: Invalid data URI format for ${input.contentType} (Name: ${input.contentName || 'N/A'}):`, dataUri ? String(dataUri).substring(0,100) : "undefined/null dataUri");
        return { summary: "Error in flow: Media data is not a valid data URI." };
      }
      const mimeTypeMatch = dataUri.match(/^data:([A-Za-z-+\/]+);/);
      if (!mimeTypeMatch || !mimeTypeMatch[1] || mimeTypeMatch[1].trim() === '') {
        console.error(`Flow: Invalid data URI or missing/empty MIME type for ${input.contentType} (Name: ${input.contentName || 'N/A'}). URI starts with:`, dataUri.substring(0, 100));
        return { summary: "Error in flow: Could not process media content due to invalid data format. MIME type missing or empty." };
      }
      const mimeType = mimeTypeMatch[1].trim();
      promptParts.push({ media: { url: dataUri, contentType: mimeType } });
      summarizationInstruction = `You are an AI assistant that specializes in summarizing content. You will be provided with ${input.contentType} content (MIME type: ${mimeType}). Your task is to generate a concise summary of the content.`;
    } else {
      console.error(`Flow: Unsupported content type for summarization (Name: ${input.contentName || 'N/A'}):`, input.contentType);
      return { summary: `Unsupported content type in flow: ${input.contentType}.` };
    }
    
    promptParts.push({ text: summarizationInstruction });
    
    try {
        const response = await ai.generate({ prompt: promptParts }); 
        return { summary: response.text || "Summary could not be generated in flow (empty response)." };
    } catch (error) {
        console.error(`Error generating summary in flow for ${input.contentType} (Name: ${input.contentName || 'N/A'}):`, error);
        return { summary: `Error generating summary in flow. Details: ${error instanceof Error ? error.message : String(error)}`};
    }
  }
);

// Exported wrapper if using the flow (not current path for UploadSection)
// export async function summarizeContent(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
//   return summarizeContentFlowInternal(input);
// }

