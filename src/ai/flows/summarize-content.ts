
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
  summary: z.string().describe('A brief summary of the content.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

// This function is directly used by UploadSection.tsx
export async function contentToText(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
  let promptConfig: any = {
    prompt: [],
  };

  // For text and YouTube, contentData is a string (raw text or URL)
  if (input.contentType === 'text' || input.contentType === 'youtube') {
    promptConfig.prompt.push({ text: input.contentData });
  } 
  // For photos and audio, contentData is a data URI
  else if (input.contentType === 'photo' || input.contentType === 'audio') {
    promptConfig.prompt.push({ media: { url: input.contentData } });
  } else {
    // Should not happen with current enum, but good for safety
    console.error("Unsupported content type for summarization:", input.contentType);
    return { summary: "Unsupported content type." };
  }
  
  promptConfig.prompt.push({ text: "You are an AI assistant that specializes in summarizing content. You will be provided content of a specific type, and your task is to generate a concise summary of the content. Content Type: " + input.contentType });

  const response = await contentToTextAi.generate(promptConfig);
  return { summary: response.text };
}

// Example of how a full flow might be defined if needed later, not currently used by UploadSection.tsx for summarization.
const summarizeContentFlowInternal = ai.defineFlow(
  {
    name: 'summarizeContentFlow',
    inputSchema: SummarizeContentInputSchema,
    outputSchema: SummarizeContentOutputSchema,
  },
  async (input) => {
    // This demonstrates using a defined prompt within a flow.
    // For the current direct usage in UploadSection, contentToTextAi.generate is used.
    
    // If we were to use a defined prompt:
    // const prompt = ai.definePrompt({ ... });
    // const { output } = await prompt(input);
    // return output!;

    // Replicating current direct generation logic within a flow structure:
    let promptConfig: any = { prompt: [] };
    if (input.contentType === 'text' || input.contentType === 'youtube') {
      promptConfig.prompt.push({ text: input.contentData });
    } else if (input.contentType === 'photo' || input.contentType === 'audio') {
      promptConfig.prompt.push({ media: { url: input.contentData } });
    }
    promptConfig.prompt.push({ text: "You are an AI assistant that specializes in summarizing content. Content Type: " + input.contentType });
    
    const response = await contentToTextAi.generate(promptConfig); // Assuming contentToTextAi is suitable or use 'ai.generate'
    return { summary: response.text };
  }
);

// Exported wrapper if using the flow (not current path for UploadSection)
// export async function summarizeContent(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
//   return summarizeContentFlowInternal(input);
// }
