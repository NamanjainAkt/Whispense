// src/services/gemini.ts
import type { Expense, ParsedExpense } from '../types';

// Gemini API configuration - Replace with your actual API key
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export const GeminiService = {
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

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.amount) {
        return null;
      }

      return {
        amount: parsed.amount,
        isApproximate: parsed.is_approximate || false,
        item: parsed.item || 'Unknown',
        category: parsed.category || availableCategories[0] || 'Other',
      };
    } catch (error) {
      console.error('Gemini parse error:', error);
      return null;
    }
  },

  generateInsights: async (expenses: Expense[]): Promise<{
    healthScore: number;
    suggestions: string[];
    patterns: {
      peakDays: string[];
      timeOfDay: { [key: string]: number };
      frequency: { [key: string]: number };
    };
  }> => {
    try {
      // Calculate basic stats first for context
      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const dailyAverage = expenses.length > 0 ? totalSpent / 30 : 0;
      const categories: { [key: string]: number } = {};

      expenses.forEach((expense) => {
        categories[expense.categoryId] = (categories[expense.categoryId] || 0) + 1;
      });

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

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';

      // Extract JSON from response
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
      // Return default insights on error
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
