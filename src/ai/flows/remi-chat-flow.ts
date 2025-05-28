
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

const RemiChatInputSchema = z.object({
  userMessage: z.string().describe("The user's message."),
  contentSummary: z.string().optional().describe('A summary of the currently selected content, if any.'),
  userName: z.string().optional().describe("The user's name, defaults to 'User'."),
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
  prompt: `You are Remi, a friendly and helpful AI content companion. Your goal is to chat with the user and assist them.
User's name is {{#if userName}}{{userName}}{{else}}User{{/if}}.

{{#if contentSummary}}
The user has selected some content. Here's a summary of it:
---
{{{contentSummary}}}
---
- If the user asks questions like "What is this about?", "Tell me about this content", "What's this selection?", or asks for a summary of the selected item, use the provided content summary to answer.
- If the user asks you to "tell a story about this" or "create a story based on this", you can use the summary to weave a creative narrative.
- For other questions or general chat, respond naturally. You don't need to always refer to the content unless it's relevant.
{{else}}
The user has not selected any content.
- You can chat about general topics.
- If they ask about specific content or stories related to content, gently guide them to select an item from their list first.
{{/if}}

Engage in a helpful and conversational manner. If you are unsure how to respond or if the request is ambiguous, you can ask for clarification.
Keep your responses concise and friendly.

User: {{{userMessage}}}
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
