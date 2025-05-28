
'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing uploaded content.
 *
 * - summarizeContent - A function that handles the content summarization process. (Note: This is the flow, contentToText is the exported helper)
 * - SummarizeContentInput - The input type for the summarizeContent function.
 * - SummarizeContentOutput - The return type for the summarizeContent function.
 * - contentToText - An exported helper function that calls the AI model directly for summarization.
 */

import {contentToTextAi} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeContentInputSchema = z.object({
  contentType: z.enum(['photo', 'youtube', 'audio', 'text']).describe('The type of the content being summarized.'),
  contentData: z.string().describe('The content data to be summarized. For photos, audio, and text (from file upload), this should be a data URI. For YouTube, this should be the URL. For text (if ever raw), this would be the content itself.'),
});
export type SummarizeContentInput = z.infer<typeof SummarizeContentInputSchema>;

const SummarizeContentOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the content.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

// This function is directly used by UploadSection.tsx
export async function contentToText(input: SummarizeContentInput) {
  // The 'data' here is either a data URI (for photo/audio/text file) or a URL (for youtube)
  let promptConfig: any = {
    prompt: [],
  };

  if (input.contentType === 'youtube' || (input.contentType === 'text' && !input.contentData.startsWith('data:'))) {
    // For YouTube URLs or raw text (if we were to support it directly, not primary path now)
    promptConfig.prompt.push({ text: input.contentData });
  } else {
    // For photos, audio files, and text files (as data URIs)
    promptConfig.prompt.push({ media: { url: input.contentData } });
  }
  
  promptConfig.prompt.push({ text: "You are an AI assistant that specializes in summarizing content. You will be provided content of a specific type, and your task is to generate a concise summary of the content. Content Type: " + input.contentType });

  
  const response = await contentToTextAi.generate(promptConfig);
  console.log("Response: ", response);
  return { summary: response.text };
}
