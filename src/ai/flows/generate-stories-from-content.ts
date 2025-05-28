'use server';

/**
 * @fileOverview Generates stories from uploaded content based on a user prompt.
 *
 * - generateStoriesFromContent - A function that generates stories based on the uploaded content and user prompt.
 * - GenerateStoriesFromContentInput - The input type for the generateStoriesFromContent function.
 * - GenerateStoriesFromContentOutput - The return type for the generateStoriesFromContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStoriesFromContentInputSchema = z.object({
  prompt: z.string().describe('The prompt to guide the story generation.'),
  contentSummary: z.string().describe('A summary of the uploaded content.'),
});
export type GenerateStoriesFromContentInput = z.infer<
  typeof GenerateStoriesFromContentInputSchema
>;

const GenerateStoriesFromContentOutputSchema = z.object({
  story: z.string().describe('The generated story based on the content and prompt.'),
});
export type GenerateStoriesFromContentOutput = z.infer<
  typeof GenerateStoriesFromContentOutputSchema
>;

export async function generateStoriesFromContent(
  input: GenerateStoriesFromContentInput
): Promise<GenerateStoriesFromContentOutput> {
  return generateStoriesFromContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStoriesFromContentPrompt',
  input: {schema: GenerateStoriesFromContentInputSchema},
  output: {schema: GenerateStoriesFromContentOutputSchema},
  prompt: `You are a creative story writer. Generate a story based on the following content summary and user prompt.\n\nContent Summary: {{{contentSummary}}}\n\nPrompt: {{{prompt}}}\n\nStory:`,
});

const generateStoriesFromContentFlow = ai.defineFlow(
  {
    name: 'generateStoriesFromContentFlow',
    inputSchema: GenerateStoriesFromContentInputSchema,
    outputSchema: GenerateStoriesFromContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
