
'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing uploaded content.
 *
 * - summarizeContent - A function that handles the content summarization process. (Note: This is the flow, contentToText is the exported helper)
 * - SummarizeContentInput - The input type for the summarizeContent function.
 * - SummarizeContentOutput - The return type for the summarizeContent function.
 * - contentToText - An exported helper function that calls the AI model directly for summarization.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeContentInputSchema = z.object({
  contentType: z.enum(['photo', 'youtube', 'audio', 'text']).describe('The type of the content being summarized.'),
  contentData: z.string().describe('The content data to be summarized. For photos, this should be a data URI. For YouTube, this should be the URL. For audio and text, this should be the content itself.'),
});
export type SummarizeContentInput = z.infer<typeof SummarizeContentInputSchema>;

const SummarizeContentOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the content.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

// This is the defined flow, but it's not directly exported or used by UploadSection.
// UploadSection uses contentToText.
const summarizeContentFlow = ai.defineFlow(
  {
    name: 'summarizeContentFlow',
    inputSchema: SummarizeContentInputSchema,
    outputSchema: SummarizeContentOutputSchema,
  },
  async input => {
    // For photo, audio, or youtube, the contentData is a URL or data URI
    // For text, contentData is the text itself.
    let promptParts: any[] = [];
    if (input.contentType === 'photo' || input.contentType === 'audio') { // Assuming 'youtube' also uses URL for media part
      promptParts.push({ media: { url: input.contentData } });
      promptParts.push({ text: `You are an AI assistant that specializes in summarizing content. You will be provided content of type '${input.contentType}'. Generate a concise summary.` });
    } else if (input.contentType === 'youtube') {
       // For YouTube, Gemini might not be able to directly process video URLs for summarization in this way.
       // The current `contentToText` function structure is more appropriate for this, which passes the URL.
       // However, to make summarizeContentFlow work, we'd ideally extract text/transcript first.
       // For now, we'll assume a text prompt based on the URL.
       promptParts.push({ text: `You are an AI assistant. Summarize the content of the YouTube video found at the following URL: ${input.contentData}`});
    }
     else { // text
      promptParts.push({ text: `You are an AI assistant that specializes in summarizing content. Summarize the following text:\n\n${input.contentData}` });
    }

    const response = await ai.generate({
      prompt: promptParts,
      // output: { schema: SummarizeContentOutputSchema } // Output schema can guide structured output if needed
    });
    return { summary: response.text() };
  }
);

// This function is directly used by UploadSection.tsx
export async function contentToText(type: string, data: string) {
  // The 'data' here is either a data URI (for photo/audio) or a URL (for youtube) or text content
  let promptConfig: any = {
    prompt: [],
  };
  let modelToUse = ai.getModel(); // Get default model from ai instance

  if (type === 'photo' || type === 'audio') {
    promptConfig.prompt.push({ media: { url: data } });
    promptConfig.prompt.push({ text: "You are an AI assistant that specializes in summarizing content. You will be provided content of a specific type, and your task is to generate a concise summary of the content. Content Type: " + type });
    // Potentially use a model that supports multimodal input if not the default
  } else if (type === 'youtube') {
    // For YouTube, we send the URL and ask for summarization.
    // It's up to the model if it can fetch/process this.
    promptConfig.prompt.push({ text: `Please summarize the content of the YouTube video found at this URL: ${data}` });
  } else { // text
    promptConfig.prompt.push({ text: `You are an AI assistant that specializes in summarizing content. Please summarize the following text: ${data}` });
  }
  
  return ai.generate(promptConfig);
}
