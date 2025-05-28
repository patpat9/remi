
'use server';
/**
 * @fileOverview A conversational AI flow for Remi, the content companion.
 *
 * - remiChat - A function that handles the conversational chat logic.
 * - RemiChatInput - The input type for the remiChat function.
 * - RemiChatOutput - The return type for the remiChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UploadedContentInfoSchema = z.object({
  id: z.string(),
  name: z.string().describe("The name or title of the content item."),
  type: z.enum(['photo', 'youtube', 'audio', 'text']).describe("The type of the content item."),
  information: z.string().describe("For 'text' type, this is the full text content. For 'photo', 'youtube', and 'audio' types, this is an AI-generated summary of the content. If a summary is not available for non-text types, this might be a placeholder message.")
});

const RemiChatInputSchema = z.object({
  userMessage: z.string().describe("The user's message."),
  availableContent: z.array(UploadedContentInfoSchema).optional().describe('An array of all available content items, including their name, type, and text/summary.'),
});
export type RemiChatInput = z.infer<typeof RemiChatInputSchema>;

const RemiChatOutputSchema = z.object({
  aiResponse: z.string().describe("Remi's response to the user."),
});
export type RemiChatOutput = z.infer<typeof RemiChatOutputSchema>;

export async function remiChat(input: RemiChatInput): Promise<RemiChatOutput> {
  return remiChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remiChatPrompt',
  input: {schema: RemiChatInputSchema},
  output: {schema: RemiChatOutputSchema},
  prompt: `You are Remi, a friendly and helpful AI content companion. Your main role is to discuss and answer questions based on the content the user has uploaded.

{{#if availableContent.length}}
You have access to the following uploaded content items.
For items of type 'text', the full text is provided. For other types ('photo', 'youtube', 'audio'), a summary is provided.
Please use this information to answer the user's questions and engage in conversation about their content. If the user asks a general question, try to see if it relates to any of the uploaded content. If it's unrelated, you can chat generally.

Available Content:
{{#each availableContent}}
  - Item ID: {{this.id}}
    Item Name: "{{this.name}}"
    Type: {{this.type}}
    Information: {{{this.information}}}
  ---
{{/each}}
{{else}}
No content has been uploaded yet. You can chat with the user generally, or encourage them to upload some content to discuss.
{{/if}}

User's Message: {{{userMessage}}}
Remi:`,
});


const remiChatFlow = ai.defineFlow(
  {
    name: 'remiChatFlow',
    inputSchema: RemiChatInputSchema,
    outputSchema: RemiChatOutputSchema,
  },
  async (input: RemiChatInput) => {
    const {output} = await prompt(input);
    return output!;
  }
);
