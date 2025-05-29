
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

const MediaCommandSchema = z.object({
  contentId: z.string().describe("The ID of the content item to control."),
  mediaType: z.enum(['audio', 'youtube']).describe("The type of media to control."),
  command: z.enum(['play', 'pause', 'restart']).describe("The playback command to execute."),
});

const RemiChatOutputSchema = z.object({
  aiResponse: z.string().describe("Remi's response to the user."),
  selectedContentIdByAi: z.string().optional().describe("If the AI used the selectContentTool or controlMediaPlayback tool to highlight an item, this is its ID."),
  mediaCommandToExecute: MediaCommandSchema.optional().describe("If the AI used the controlMediaPlayback tool, this object contains the command details."),
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
    console.log(`AI tool 'selectContentTool' called with contentId: ${contentId}`);
    return { success: true, message: `Selection of content item ${contentId} was acknowledged by the system.` };
  }
);

// Define the tool for controlling media playback
const controlMediaPlaybackTool = ai.defineTool(
  {
    name: 'controlMediaPlayback',
    description: 'Use this tool to control media playback (audio or YouTube videos). Provide the "contentId", "mediaType" (\'audio\' or \'youtube\'), and "command" (\'play\', \'pause\', or \'restart\').',
    inputSchema: MediaCommandSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ contentId, mediaType, command }) => {
    console.log(`AI tool 'controlMediaPlayback' called for contentId: ${contentId}, type: ${mediaType}, command: ${command}`);
    return { success: true, message: `Media control command '${command}' for ${mediaType} item ${contentId} was acknowledged.` };
  }
);

export async function remiChat(input: RemiChatInput): Promise<RemiChatOutput> {
  return remiChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remiChatPrompt',
  input: {schema: RemiChatInputSchema},
  output: {schema: RemiChatOutputSchema},
  tools: [selectContentTool, controlMediaPlaybackTool], // Make tools available
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

Tools Available:
1. 'selectContentTool':
   - Description: Use this tool to select a specific content item for the user to view.
   - Input: { "contentId": "some-item-id" }
   - Instructions: If the user's query implies they want to see or focus on a specific content item, use this tool. When you use it, you MUST also populate 'selectedContentIdByAi' in your JSON output with the 'Item ID'.

2. 'controlMediaPlayback':
   - Description: Use this tool to control audio or YouTube video playback.
   - Input: { "contentId": "some-item-id", "mediaType": "audio"_or_"youtube", "command": "play"_or_"pause"_or_"restart" }
   - Instructions: If the user asks to play, pause, or restart an audio or YouTube video, use this tool with the corresponding 'Item ID', 'mediaType', and 'command'.
     When you use this tool, you MUST:
     1. Populate 'mediaCommandToExecute' in your JSON output with the exact details you sent to the tool.
     2. Populate 'selectedContentIdByAi' in your JSON output with the 'Item ID' of the media you are controlling. This ensures the correct item is displayed when the media command is issued.
     Only use this tool for 'audio' or 'youtube' type content.

Your main textual response in 'aiResponse' should still be natural.
{{else}}
No content has been uploaded yet. You can chat with the user generally, or encourage them to upload some content to discuss.
{{/if}}

User's Message: {{{userMessage}}}

Based on the user's message and the available content, provide your 'aiResponse'. If you use any tools, ensure you also set the corresponding fields ('selectedContentIdByAi' and/or 'mediaCommandToExecute') in your output.
Remi's JSON Output:`,
});


const remiChatFlow = ai.defineFlow(
  {
    name: 'remiChatFlow',
    inputSchema: RemiChatInputSchema,
    outputSchema: RemiChatOutputSchema,
  },
  async (input: RemiChatInput): Promise<RemiChatOutput> => {
    try {
      const {output: llmOutput} = await prompt(input); 
    
      if (llmOutput) {
        return llmOutput;
      } else {
        // Fallback if LLM output is null after parsing (e.g. didn't match schema)
        console.error("Remi Chat Flow: LLM did not produce valid output matching schema (llmOutput is null/undefined after parsing). Returning fallback response.");
        return {
          aiResponse: "I'm sorry, I had a little trouble understanding that or formulating a response in the expected format. Could you try rephrasing your message?",
        };
      }
    } catch (error) {
        // Fallback if the prompt(input) call itself throws an error
        console.error("Remi Chat Flow: Error during AI prompt execution. Returning fallback response.", error);
        return {
          aiResponse: "My apologies, an unexpected error occurred while I was trying to process your request. Please try again.",
        };
    }
  }
);

