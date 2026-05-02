// src/services/ai.ts
import type { Expense, ParsedExpense } from '../types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const AIService = {
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

Respond ONLY in valid JSON format:
{
  "amount": 50,
  "is_approximate": false,
  "item": "chai and snacks",
  "category": "Food & Drinks"
}
`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });

      if (!response.ok) {
        console.error('Gemini API error:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.amount) return null;

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
      const recentExpenses = expenses.slice(0, 50).map(e => ({
        amount: e.amount,
        item: e.item,
        category: e.categoryId,
        date: new Date(e.date).toLocaleDateString('en-US', { weekday: 'long' }),
      }));

      const prompt = `
Analyze these expenses and return a JSON object with:
- health_score (0-100)
- suggestions (array of strings with ₹ savings)
- patterns (peak_days, time_of_day, frequency)

Data: ${JSON.stringify(recentExpenses)}
Total: ₹${totalSpent}
`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

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
        suggestions: ['Log more expenses for AI insights'],
        patterns: { peakDays: [], timeOfDay: {}, frequency: {} },
      };
    }
  },
};
