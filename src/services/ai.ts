// src/services/ai.ts
import NetInfo from '@react-native-community/netinfo';
import { parseLocalExpense } from './localParser';
import type { Expense, ParsedExpense } from '../types';

export interface HybridParsedExpense extends ParsedExpense {
  parsedBy: 'local' | 'google-ai' | 'offline-fallback';
}

// ⚠️ WARNING: EXPO_PUBLIC_* variables are embedded in the client bundle.
// For production, proxy AI calls through your own backend to protect this key.
const GOOGLE_AI_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY || '';
const AI_MODEL = 'gemma-4-31b-it';
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`;

export const AIService = {
  parseExpense: async (
    transcript: string,
    availableCategories: string[]
  ): Promise<HybridParsedExpense | null> => {
    // Convert string categories to Category mock structure for localParser
    const categoriesAsObjects = availableCategories.map((name) => ({
      id: name,
      userId: '',
      name,
      icon: '',
      color: '',
      isCustom: false,
    }));

    // 1. Try local parsing first
    const localResult = parseLocalExpense(transcript, categoriesAsObjects);

    if (localResult && localResult.confidence === 'high') {
      console.log('[AIService] parsed locally (high confidence):', localResult);
      return {
        amount: localResult.amount,
        isApproximate: localResult.isApproximate,
        item: localResult.item,
        category: localResult.category,
        parsedBy: 'local',
      };
    }

    // 2. Check internet connectivity if local parsing is low confidence
    let isOnline = false;
    try {
      const netState = await NetInfo.fetch();
      isOnline = !!netState.isConnected;
    } catch (e) {
      console.warn('[AIService] Failed to check NetInfo:', e);
    }

    if (isOnline) {
      console.log('[AIService] falling back to Google AI API (low confidence local parsing / online)');
      let timeoutId: any;
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

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${AI_API_URL}?key=${GOOGLE_AI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 },
          }),
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('Google AI API error:', response.status, await response.text());
          // If AI API fails, fallback to localResult if we got a valid amount
          if (localResult && localResult.amount > 0) {
            console.log('[AIService] Google AI API error. Falling back to local parsed result.');
            return {
              amount: localResult.amount,
              isApproximate: localResult.isApproximate,
              item: localResult.item,
              category: localResult.category,
              parsedBy: 'offline-fallback',
            };
          }
          return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          if (localResult && localResult.amount > 0) {
            return {
              amount: localResult.amount,
              isApproximate: localResult.isApproximate,
              item: localResult.item,
              category: localResult.category,
              parsedBy: 'offline-fallback',
            };
          }
          return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.amount) {
          if (localResult && localResult.amount > 0) {
            return {
              amount: localResult.amount,
              isApproximate: localResult.isApproximate,
              item: localResult.item,
              category: localResult.category,
              parsedBy: 'offline-fallback',
            };
          }
          return null;
        }

        return {
          amount: parsed.amount as number,
          isApproximate: parsed.is_approximate || false,
          item: parsed.item || 'Unknown',
          category: parsed.category || availableCategories[0] || 'Other',
          parsedBy: 'google-ai',
        };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Google AI parse error:', error);
        if (localResult && localResult.amount > 0) {
          return {
            amount: localResult.amount,
            isApproximate: localResult.isApproximate,
            item: localResult.item,
            category: localResult.category,
            parsedBy: 'offline-fallback',
          };
        }
        return null;
      }
    } else {
      // Offline fallback: Use the local parser's result, even if it is low confidence
      console.log('[AIService] Offline. Using local parser fallback:', localResult);
      if (localResult && localResult.amount > 0) {
        return {
          amount: localResult.amount,
          isApproximate: localResult.isApproximate,
          item: localResult.item,
          category: localResult.category,
          parsedBy: 'offline-fallback',
        };
      }
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
    let timeoutId: any;
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

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${AI_API_URL}?key=${GOOGLE_AI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Google AI API error: ${response.status}`);

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
      clearTimeout(timeoutId);
      console.error('Google AI insights error:', error);
      return {
        healthScore: 50,
        suggestions: ['Log more expenses for AI insights'],
        patterns: { peakDays: [], timeOfDay: {}, frequency: {} },
      };
    }
  },
};
