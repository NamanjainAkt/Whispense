// src/services/cache.ts
import { MMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '../constants';
import type { User, Category, Expense } from '../types';

const storage = new MMKV({ id: 'whispense-cache' });

export const CacheService = {
  // Generic methods
  set: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },

  get: <T>(key: string): T | null => {
    const value = storage.getString(key);
    return value ? JSON.parse(value) : null;
  },

  delete: (key: string): void => {
    storage.remove(key);
  },

  clearAll: (): void => {
    storage.clearAll();
  },

  // User methods
  setUser: (user: User): void => {
    CacheService.set(STORAGE_KEYS.USER_PROFILE, user);
  },

  getUser: (): User | null => {
    return CacheService.get<User>(STORAGE_KEYS.USER_PROFILE);
  },

  deleteUser: (): void => {
    CacheService.delete(STORAGE_KEYS.USER_PROFILE);
  },

  // Categories methods
  setCategories: (categories: Category[]): void => {
    CacheService.set(STORAGE_KEYS.CATEGORIES, categories);
  },

  getCategories: (): Category[] => {
    return CacheService.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
  },

  // Expenses methods
  setExpenses: (expenses: Expense[]): void => {
    CacheService.set(STORAGE_KEYS.EXPENSES_CURRENT_MONTH, expenses);
  },

  getExpenses: (): Expense[] => {
    return CacheService.get<Expense[]>(STORAGE_KEYS.EXPENSES_CURRENT_MONTH) || [];
  },

  addExpense: (expense: Expense): void => {
    const expenses = CacheService.getExpenses();
    expenses.unshift(expense);
    CacheService.setExpenses(expenses);
  },

  updateExpense: (id: string, updates: Partial<Expense>): void => {
    const expenses = CacheService.getExpenses();
    const index = expenses.findIndex((e) => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      CacheService.setExpenses(expenses);
    }
  },

  deleteExpense: (id: string): void => {
    const expenses = CacheService.getExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    CacheService.setExpenses(filtered);
  },

  // Sync methods
  setLastSync: (timestamp: number): void => {
    storage.set(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, timestamp);
  },

  getLastSync: (): number => {
    return storage.getNumber(STORAGE_KEYS.LAST_SYNC_TIMESTAMP) || 0;
  },

  // Pending sync queue
  addToPendingSync: (operation: PendingOperation): void => {
    const pending = CacheService.get<PendingOperation[]>(STORAGE_KEYS.PENDING_SYNC) || [];
    pending.push(operation);
    CacheService.set(STORAGE_KEYS.PENDING_SYNC, pending);
  },

  getPendingSync: (): PendingOperation[] => {
    return CacheService.get<PendingOperation[]>(STORAGE_KEYS.PENDING_SYNC) || [];
  },

  clearPendingSync: (): void => {
    CacheService.delete(STORAGE_KEYS.PENDING_SYNC);
  },

  // Auth token
  setAuthToken: (token: string): void => {
    storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  getAuthToken: (): string | undefined => {
    return storage.getString(STORAGE_KEYS.AUTH_TOKEN);
  },

  deleteAuthToken: (): void => {
    CacheService.delete(STORAGE_KEYS.AUTH_TOKEN);
  },

  // FCM token
  setFcmToken: (token: string): void => {
    storage.set(STORAGE_KEYS.FCM_TOKEN, token);
  },

  getFcmToken: (): string | undefined => {
    return storage.getString(STORAGE_KEYS.FCM_TOKEN);
  },

  // Insights cache
  setInsightsCache: (insights: unknown): void => {
    CacheService.set(STORAGE_KEYS.INSIGHTS_CACHE, {
      data: insights,
      timestamp: Date.now(),
    });
  },

  getInsightsCache: (): { data: unknown; timestamp: number } | null => {
    return CacheService.get(STORAGE_KEYS.INSIGHTS_CACHE);
  },
};

export interface PendingOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  id: string;
  data?: unknown;
  timestamp: number;
}
