// src/types/index.ts

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  monthlyBudget: number;
  alertThreshold: number;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  isApproximate: boolean;
  item: string;
  categoryId: string;
  rawVoice?: string;
  date: string;
  createdAt: string;
}

export interface ParsedExpense {
  amount: number;
  isApproximate: boolean;
  item: string;
  category: string;
}

export type ExpenseCategory =
  | 'Food & Drinks'
  | 'Transport'
  | 'Groceries'
  | 'Health'
  | 'Shopping'
  | 'Bills';

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId'>[] = [
  { name: 'Food & Drinks', icon: 'restaurant', color: '#F59E0B', isCustom: false },
  { name: 'Transport', icon: 'directions-car', color: '#3B82F6', isCustom: false },
  { name: 'Groceries', icon: 'shopping-basket', color: '#10B981', isCustom: false },
  { name: 'Health', icon: 'favorite', color: '#EF4444', isCustom: false },
  { name: 'Shopping', icon: 'shopping-bag', color: '#8B5CF6', isCustom: false },
  { name: 'Bills', icon: 'receipt', color: '#6366F1', isCustom: false },
];
