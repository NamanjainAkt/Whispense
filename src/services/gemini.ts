// src/services/gemini.ts
import type { Expense, ParsedExpense } from '../types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

const callGemini = async (
  prompt: string,
  temperature: number,
  maxOutputTokens: number,
  audioBase64?: string
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key is not set. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.'
    );
  }

  const parts: any[] = [{ text: prompt }];
  if (audioBase64) {
    parts.push({
      inline_data: {
        mime_type: 'audio/m4a', // Default for expo-av HIGH_QUALITY on iOS/Android
        data: audioBase64,
      },
    });
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature, maxOutputTokens },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini API error body:', errorData);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();

  // Guard against empty candidates array
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned no candidates');
  }

  return data.candidates[0]?.content?.parts[0]?.text ?? '';
};

export const GeminiService = {
  transcribeAudio: async (audioBase64: string): Promise<string> => {
    try {
      const prompt = `
        Transcribe this audio recording of a person logging an expense.
        The user might be speaking in English or a mix of Hindi and English (Hinglish).
        Only return the transcription text, nothing else.
        If the audio is silent or unclear, return "Could not transcribe".
      `;
      const transcript = await callGemini(prompt, 0.1, 256, audioBase64);
      return transcript.trim();
    } catch (error) {
      console.error('Gemini transcription error:', error);
      throw error;
    }
  },

  parseExpense: async (
    transcript: string,
    availableCategories: string[]
  ): Promise<ParsedExpense | null> => {
    try {
      const prompt = `
You are an expense parser for a voice-based expense tracking app.
Extract the following information from this voice transcript:

Transcript: "${transcript}"

Available categories: ${availableCategories.join(', ')}

Extract:
1. amount (number only, no currency symbols)
2. is_approximate (boolean - true if user said words like "around", "about", "like", "roughly", "approximately")
3. item (what was purchased, short phrase, max 5 words)
4. category (one of the available categories, or suggest a new one if none match)

Handle:
- Broken speech, slang, Hinglish (mix of Hindi and English)
- Multiple ways of saying amounts ("fifty rupees", "50", "one hundred")
- Unclear items - make your best guess

Respond ONLY in valid JSON format like this:
{
  "amount": 50,
  "is_approximate": false,
  "item": "chai and snacks",
  "category": "Food & Drinks"
}

If you cannot determine the amount, respond with:
{
  "amount": null,
  "is_approximate": false,
  "item": "",
  "category": ""
}
`;

      const text = await callGemini(prompt, 0.1, 256);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Fix: use explicit null check — amount of 0 is still valid
      if (parsed.amount === null || parsed.amount === undefined) {
        return null;
      }

      return {
        amount: parsed.amount as number,
        isApproximate: parsed.is_approximate || false,
        item: parsed.item || 'Unknown',
        category: parsed.category || availableCategories[0] || 'Other',
      };
    } catch (error) {
      console.error('Gemini parse error:', error);
      return null;
    }
  },

  generateInsights: async (
    expenses: Expense[]
  ): Promise<{
    healthScore: number;
    suggestions: string[];
    patterns: {
      peakDays: string[];
      timeOfDay: { [key: string]: number };
      frequency: { [key: string]: number };
    };
  }> => {
    try {
      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const dailyAverage = expenses.length > 0 ? totalSpent / 30 : 0;

      const prompt = `
You are a financial advisor AI. Analyze these expenses and provide insights.

Total spent this month: ₹${totalSpent}
Daily average: ₹${dailyAverage.toFixed(0)}
Number of transactions: ${expenses.length}

Calculate and return ONLY a JSON object with this structure:
{
  "health_score": 75,
  "suggestions": [
    "Cooking at home 2x/week instead of ordering could save ~₹2,400/month"
  ],
  "patterns": {
    "peak_days": ["Saturday", "Sunday"],
    "time_of_day": {
      "morning": 10,
      "afternoon": 20,
      "evening": 50,
      "night": 20
    },
    "frequency": {
      "Food & Drinks": 4.2,
      "Transport": 2.1
    }
  }
}

Rules for health_score (0-100):
- 70-100: Good budget management, consistent logging
- 40-69: Moderate, some areas for improvement  
- 0-39: Needs attention, overspending or inconsistent logging

Suggestions should be actionable and include estimated savings in rupees (₹).
Keep suggestions to 2-3 items max.
`;

      const text = await callGemini(prompt, 0.3, 512);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        healthScore: parsed.health_score || 50,
        suggestions: parsed.suggestions || [],
        patterns: {
          peakDays: parsed.patterns?.peak_days || [],
          timeOfDay: parsed.patterns?.time_of_day || {},
          frequency: parsed.patterns?.frequency || {},
        },
      };
    } catch (error) {
      console.error('Gemini insights error:', error);
      return {
        healthScore: 50,
        suggestions: [
          'Continue logging expenses regularly to get personalized insights',
          'Try to review your spending weekly to stay on budget',
        ],
        patterns: {
          peakDays: [],
          timeOfDay: {},
          frequency: {},
        },
      };
    }
  },
};
