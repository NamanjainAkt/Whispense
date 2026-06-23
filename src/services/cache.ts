// src/services/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import type { User, Category, Expense } from '../types';

// All app-specific storage keys (used for scoped clearAll)
const ALL_APP_KEYS = Object.values(STORAGE_KEYS) as string[];

export const CacheService = {
  // Generic methods
  set: async <T>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  get: async <T>(key: string): Promise<T | null> => {
    const value = await AsyncStorage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      // Corrupted cache entry — remove it and return null
      await AsyncStorage.removeItem(key);
      return null;
    }
  },

  delete: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },

  // Only clears app-specific keys, not third-party library storage
  clearAll: async (): Promise<void> => {
    for (const key of ALL_APP_KEYS) {
      await AsyncStorage.removeItem(key);
    }
  },

  // User methods
  setUser: async (user: User): Promise<void> => {
    await CacheService.set(STORAGE_KEYS.USER_PROFILE, user);
  },

  getUser: async (): Promise<User | null> => {
    return await CacheService.get<User>(STORAGE_KEYS.USER_PROFILE);
  },

  deleteUser: async (): Promise<void> => {
    await CacheService.delete(STORAGE_KEYS.USER_PROFILE);
  },

  // Categories methods
  setCategories: async (categories: Category[]): Promise<void> => {
    await CacheService.set(STORAGE_KEYS.CATEGORIES, categories);
  },

  getCategories: async (): Promise<Category[]> => {
    return (await CacheService.get<Category[]>(STORAGE_KEYS.CATEGORIES)) || [];
  },

  // Expenses methods
  setExpenses: async (expenses: Expense[]): Promise<void> => {
    await CacheService.set(STORAGE_KEYS.EXPENSES_CURRENT_MONTH, expenses);
  },

  getExpenses: async (): Promise<Expense[]> => {
    return (await CacheService.get<Expense[]>(STORAGE_KEYS.EXPENSES_CURRENT_MONTH)) || [];
  },

  addExpense: async (expense: Expense): Promise<void> => {
    const expenses = await CacheService.getExpenses();
    expenses.unshift(expense);
    await CacheService.setExpenses(expenses);
  },

  updateExpense: async (id: string, updates: Partial<Expense>): Promise<void> => {
    const expenses = await CacheService.getExpenses();
    const index = expenses.findIndex((e) => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      await CacheService.setExpenses(expenses);
    }
  },

  deleteExpense: async (id: string): Promise<void> => {
    const expenses = await CacheService.getExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    await CacheService.setExpenses(filtered);
  },

  // Sync methods
  setLastSync: async (timestamp: number): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, String(timestamp));
  },

  getLastSync: async (): Promise<number> => {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP);
    return value ? Number(value) : 0;
  },

  // Pending sync queue
  addToPendingSync: async (operation: PendingOperation): Promise<void> => {
    const pending = (await CacheService.get<PendingOperation[]>(STORAGE_KEYS.PENDING_SYNC)) || [];
    pending.push(operation);
    await CacheService.set(STORAGE_KEYS.PENDING_SYNC, pending);
  },

  getPendingSync: async (): Promise<PendingOperation[]> => {
    return (await CacheService.get<PendingOperation[]>(STORAGE_KEYS.PENDING_SYNC)) || [];
  },

  clearPendingSync: async (): Promise<void> => {
    await CacheService.delete(STORAGE_KEYS.PENDING_SYNC);
  },

  // Auth token
  setAuthToken: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  getAuthToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  deleteAuthToken: async (): Promise<void> => {
    await CacheService.delete(STORAGE_KEYS.AUTH_TOKEN);
  },

  // FCM token
  setFcmToken: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);
  },

  getFcmToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
  },

  // Insights cache
  setInsightsCache: async (insights: unknown): Promise<void> => {
    await CacheService.set(STORAGE_KEYS.INSIGHTS_CACHE, {
      data: insights,
      timestamp: Date.now(),
    });
  },

  getInsightsCache: async (): Promise<{ data: unknown; timestamp: number } | null> => {
    return await CacheService.get(STORAGE_KEYS.INSIGHTS_CACHE);
  },

  // User preferences
  setPreferences: async (prefs: { voiceConfirmation: boolean; quickConfirm: boolean }): Promise<void> => {
    await CacheService.set(STORAGE_KEYS.USER_PREFERENCES, prefs);
  },

  getPreferences: async (): Promise<{ voiceConfirmation: boolean; quickConfirm: boolean }> => {
    const cached = await CacheService.get<{ voiceConfirmation: boolean; quickConfirm: boolean }>(STORAGE_KEYS.USER_PREFERENCES);
    return cached || { voiceConfirmation: true, quickConfirm: false };
  },
};

export interface PendingOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  id: string;
  data?: unknown;
  timestamp: number;
}
