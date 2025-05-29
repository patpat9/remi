
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
  selectedContentIdByAi: z.string().optional().describe("If the AI used the selectContentTool to highlight an item, this is its ID."),
});
export type RemiChatOutput = z.infer<typeof RemiChatOutputSchema>;

// Define the tool for selecting content
const selectContentTool = ai.defineTool(
  {
    name: 'selectContentTool',
    description: 'Use this tool to select a specific content item for the user to view. Provide the "contentId" of the item you want to select from the available content list.',
    inputSchema: z.object({
      contentId: z.string().describe("The ID of the content item to select."),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({contentId}) => {
    // This server-side function is called when the LLM uses the tool.
    // It doesn't directly update UI, but confirms the tool was invoked.
    // The client will use 'selectedContentIdByAi' from the flow's output to update UI.
    console.log(`AI tool 'selectContentTool' called with contentId: ${contentId}`);
    return { success: true, message: `Selection of content item ${contentId} was acknowledged by the system.` };
  }
);

export async function remiChat(input: RemiChatInput): Promise<RemiChatOutput> {
  return remiChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remiChatPrompt',
  input: {schema: RemiChatInputSchema},
  output: {schema: RemiChatOutputSchema},
  tools: [selectContentTool], // Make the tool available to the prompt
  prompt: `You are Remi, a friendly and helpful AI content companion. Your main role is to discuss and answer questions based on the content the user has uploaded.

{{#if availableContent.length}}
You have access to the following uploaded content items. For items of type 'text', the full text is provided. For other types ('photo', 'youtube', 'audio'), a summary is provided.
Please use this information to answer the user's questions and engage in conversation about their content.

Available Content:
{{#each availableContent}}
  - Item ID: {{this.id}}
    Item Name: "{{this.name}}"
    Type: {{this.type}}
    Information: {{{this.information}}}
  ---
{{/each}}

Tool Available: 'selectContentTool'
- Description: Use this tool to select a specific content item for the user to view.
- Input: You must provide the 'Item ID' of the content item you wish to select. For example: { "contentId": "some-item-id" }

Instructions for using 'selectContentTool':
- If the user's query directly implies they want to see or focus on a specific content item (e.g., "show me the cat photo", "tell me more about item 'xyz'"), use the 'selectContentTool' with the corresponding 'Item ID'.
- When you decide to use the 'selectContentTool', you MUST also populate the 'selectedContentIdByAi' field in your JSON response (output) with the 'Item ID' of the content item you selected.
- Your main textual response in 'aiResponse' should still be natural and can mention that you've highlighted or selected an item if appropriate.
{{else}}
No content has been uploaded yet. You can chat with the user generally, or encourage them to upload some content to discuss.
{{/if}}

User's Message: {{{userMessage}}}

Based on the user's message and the available content, provide your 'aiResponse'. If you use the 'selectContentTool', ensure you also set 'selectedContentIdByAi' in your output.
Remi's JSON Output:`,
});


const remiChatFlow = ai.defineFlow(
  {
    name: 'remiChatFlow',
    inputSchema: RemiChatInputSchema,
    outputSchema: RemiChatOutputSchema,
  },
  async (input: RemiChatInput) => {
    const {output} = await prompt(input); // The 'output' will conform to RemiChatOutputSchema
                                        // Genkit handles tool execution based on the prompt config.
                                        // If the LLM decides to use the tool AND correctly populates
                                        // 'selectedContentIdByAi' as instructed, it will be in 'output'.
    return output!;
  }
);

    