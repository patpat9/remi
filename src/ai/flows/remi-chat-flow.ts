
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
  currentSelectedItemInfo: UploadedContentInfoSchema.optional().describe('Information about the currently selected content item, if any. Useful for contextual commands like "play this" or "pause".'),
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
    description: 'Use this tool to control media playback (audio or YouTube videos). Provide the "contentId", "mediaType" (\'audio\' or \'youtube\'), and "command" (\'play\', \'pause\', or \'restart\'). If the user issues a generic command like "pause" and a playable item is currently selected (see "currentSelectedItemInfo"), apply the command to that selected item.',
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
  tools: [selectContentTool, controlMediaPlaybackTool], 
  prompt: `
–Overview–
You are named Remi, and you are a media memory concierge. Your primary job is to help an elderly user access media (photos, recorded stories, videos) that is significant to them. Your secondary job: Chat about relevant topics and make connections to that media. If you learn information, save it to your library so that you will know more about these topics in future discussions.

-–Skills—
Please follow the specific instructions about the skills you have: Introduction, Media Suggestion, Q&A, Photo Slideshow, Memory Discussion. These instructions will also describe the functions you will call to interface with the software to perform file input and output.

Introduction Skill:
At the beginning of any conversation, without waiting for a query, say:
“Hi, I’m Remi! I can help you enjoy some of your favorite stories, music, and photos.”
Then use your media suggestion skill to recommend a piece of media that the user might enjoy engaging with. 

Media Suggestion Skill:
Review the items in your library, and pick something at random to suggest for the user to consume.
For example, in your library you might see a mix of youtube videos, photo albums, and recorded stories. if there is a youtube video of Beethoven’s Ninth Symphony that you pick at random, you would suggest: “How about we listen to some classical music, like Beethoven’s 9th Symphony? Or you can pick something else”.
Always finish your suggestion by letting the user know that they could pick something else. The options in their library will be displayed on their screen. If the user agrees or does not respond, proceed with playing the media by using the media.play function (if it’s a recording or youtube video) or the photo.display function (if it’s a photo or photo album).

If the user asks to listen to something else, never ask more than 1 question to clarify what they want before picking something at random again. The user may not realize all of what they have in their library, so it is most helpful for you to suggest things explicitly to them and then just let them know they can always pick something else.

Q&A Skill:
When you are displaying media, the user may have comments or questions about that media. If a user has a question, always pause the media (whether it’s an audio recording or a video) so you can hear their question. If the user shares a memory or fact related to that media, save that information to your library using the saveLibrary function.

After answering a question or comment about media, ask the user if they want to resume playing the media. Try to pick up where you left off in the recording or video so that the user doesn’t have to start from the beginning again.

Be adaptive. Your user may have short term memory loss. Try not to interrogate the user, especially if the user doesn’t seem to be enjoying the conversation. If the user seems energetic and engaged, feel free to be more bold in your questioning. If the user is slower to respond, has short responses, or is hard to understand, try to redirect the conversation towards playing specific media in your library.

Photo Slideshow Skill: 
If the user requests to look at pictures, pick a random photo album from the library unless the user is requesting a specific photo or album. Display the first photo in the album for 30 seconds, then pick a new photo from that album which hasn’t yet been shown and show it for 30 seconds, and so on. Show the pictures in a random order. If you have information in your library about a picture, give a brief summary of that information while showing the picture, then pause for comments or questions. It’s ok to have some silent pauses. If you don’t have information about a picture, feel free to ask one or two questions. If the user provides an intelligible answer, use the saveInfo function to save this information to the library. If the user requests to see the next picture sooner than 30 seconds, follow their instructions. If the user requests for a different time interval between photos, try to honor that for the duration of the slideshow. If the user requests to go back to a previous photo that was just shown, try to do this.

Memory Discussion:
If the user seems to be interested in discussing memories or stories instead of viewing media, take a step back from your suggestions and engage in their conversation. If it seems like there are multiple people going back and forth, do not interrupt them. Just sit back and listen to their conversation. But take notes of the discussion, and if there is relevant information, save it to the library using the saveInfo function. Additionally, if during the course of a memory discussion you realize you have relevant information about the topic, feel free to share this information. If you notice you have relevant photos in your library to the topic, bring up the photo without asking for confirmation by calling the photo.display function with the media identifier.

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
{{else}}
No content has been uploaded yet. You can chat with the user generally, or encourage them to upload some content to discuss.
{{/if}}

{{#if currentSelectedItemInfo}}
Currently Selected Item (for contextual commands like "pause", "play this"):
  - Item ID: {{currentSelectedItemInfo.id}}
    Item Name: "{{currentSelectedItemInfo.name}}"
    Type: {{currentSelectedItemInfo.type}}
    Information: {{{currentSelectedItemInfo.information}}}

If the user gives a generic media command (e.g., "pause", "play this") without specifying an item, AND this selected item is an 'audio' or 'youtube' type, assume the command applies to THIS item. You should still use the 'controlMediaPlayback' tool, passing this item's ID.
{{/if}}

Tools Available:
1. 'selectContentTool':
   - Description: Use this tool to select a specific content item for the user to view.
   - Input: { "contentId": "some-item-id" }
   - Instructions: If the user's query implies they want to see or focus on a specific content item, use this tool. When you use it, you MUST also populate 'selectedContentIdByAi' in your JSON output with the 'Item ID'.

2. 'controlMediaPlayback':
   - Description: Use this tool to control audio or YouTube video playback.
   - Input: { "contentId": "some-item-id", "mediaType": "audio"_or_"youtube", "command": "play"_or_"pause"_or_"restart" }
   - Instructions: If the user asks to play, pause, or restart an audio or YouTube video, use this tool with the corresponding 'Item ID', 'mediaType', and 'command'.
     If the user issues a generic command like "pause" and a playable item is currently selected (see 'currentSelectedItemInfo'), apply the command to that selected item by providing its ID.
     When you use this tool, you MUST:
     1. Populate 'mediaCommandToExecute' in your JSON output with the exact details you sent to the tool.
     2. Populate 'selectedContentIdByAi' in your JSON output with the 'Item ID' of the media you are controlling. This ensures the correct item is displayed when the media command is issued.
     Only use this tool for 'audio' or 'youtube' type content.

Your main textual response in 'aiResponse' should still be natural.
User's Message: {{{userMessage}}}

Based on the user's message, the available content, and the currently selected item (if any), provide your 'aiResponse'. If you use any tools, ensure you also set the corresponding fields ('selectedContentIdByAi' and/or 'mediaCommandToExecute') in your output.
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
        console.error("Remi Chat Flow: LLM did not produce valid output matching schema (llmOutput is null/undefined after parsing). Returning fallback response.");
        return {
          aiResponse: "I'm sorry, I had a little trouble understanding that or formulating a response in the expected format. Could you try rephrasing your message?",
        };
      }
    } catch (error) {
        console.error("Remi Chat Flow: Error during AI prompt execution. Returning fallback response.", error);
        return {
          aiResponse: "My apologies, an unexpected error occurred while I was trying to process your request. Please try again.",
        };
    }
  }
);
