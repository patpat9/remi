import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-preview-05-20',
});

export const contentToTextAi = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-preview-05-20',
});
