// src/services/appwrite.ts
import { Client, Databases, Account, ID, Query } from 'appwrite';
import type { User, Category, Expense } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import { DEFAULT_MONTHLY_BUDGET, DEFAULT_ALERT_THRESHOLD } from '../constants';

// Appwrite configuration - Replace with your actual credentials
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const DATABASE_ID = 'whispense_db';

export const COLLECTIONS = {
  USERS: 'users',
  EXPENSES: 'expenses',
  CATEGORIES: 'categories',
} as const;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const account = new Account(client);

export const AppwriteService = {
  // Account
  getCurrentUser: async () => {
    return await account.get();
  },

  // Users
  createUser: async (userData: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  }): Promise<User> => {
    const user = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.USERS,
      userData.id,
      {
        name: userData.name,
        email: userData.email,
        avatar_url: userData.avatarUrl,
        monthly_budget: DEFAULT_MONTHLY_BUDGET,
        alert_threshold: DEFAULT_ALERT_THRESHOLD,
        created_at: new Date().toISOString(),
      }
    );

    // Seed default categories
    await AppwriteService.seedDefaultCategories(user.$id);

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      monthlyBudget: user.monthly_budget,
      alertThreshold: user.alert_threshold,
      createdAt: user.created_at,
    };
  },

  getUser: async (userId: string): Promise<User | null> => {
    try {
      const user = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.USERS,
        userId
      );
      return {
        id: user.$id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        monthlyBudget: user.monthly_budget,
        alertThreshold: user.alert_threshold,
        createdAt: user.created_at,
      };
    } catch {
      return null;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    const user = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.USERS,
      userId,
      {
        name: updates.name,
        avatar_url: updates.avatarUrl,
        monthly_budget: updates.monthlyBudget,
        alert_threshold: updates.alertThreshold,
      }
    );
    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      monthlyBudget: user.monthly_budget,
      alertThreshold: user.alert_threshold,
      createdAt: user.created_at,
    };
  },

  // Categories
  seedDefaultCategories: async (userId: string): Promise<void> => {
    for (const category of DEFAULT_CATEGORIES) {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.CATEGORIES,
        ID.unique(),
        {
          user_id: userId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          is_custom: category.isCustom,
        }
      );
    }
  },

  getCategories: async (userId: string): Promise<Category[]> => {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CATEGORIES,
      [Query.equal('user_id', userId)]
    );
    return response.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.user_id,
      name: doc.name,
      icon: doc.icon,
      color: doc.color,
      isCustom: doc.is_custom,
    }));
  },

  createCategory: async (category: Omit<Category, 'id'>): Promise<Category> => {
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CATEGORIES,
      ID.unique(),
      {
        user_id: category.userId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        is_custom: category.isCustom,
      }
    );
    return {
      id: doc.$id,
      userId: doc.user_id,
      name: doc.name,
      icon: doc.icon,
      color: doc.color,
      isCustom: doc.is_custom,
    };
  },

  // Expenses
  getExpenses: async (userId: string, startDate?: string, endDate?: string): Promise<Expense[]> => {
    const queries = [Query.equal('user_id', userId), Query.orderDesc('date')];

    if (startDate) {
      queries.push(Query.greaterThanEqual('date', startDate));
    }
    if (endDate) {
      queries.push(Query.lessThanEqual('date', endDate));
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EXPENSES,
      queries
    );

    return response.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.user_id,
      amount: doc.amount,
      isApproximate: doc.is_approximate,
      item: doc.item,
      categoryId: doc.category_id,
      rawVoice: doc.raw_voice,
      date: doc.date,
      createdAt: doc.created_at,
    }));
  },

  createExpense: async (expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> => {
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.EXPENSES,
      ID.unique(),
      {
        user_id: expense.userId,
        amount: expense.amount,
        is_approximate: expense.isApproximate,
        item: expense.item,
        category_id: expense.categoryId,
        raw_voice: expense.rawVoice,
        date: expense.date,
        created_at: new Date().toISOString(),
      }
    );
    return {
      id: doc.$id,
      userId: doc.user_id,
      amount: doc.amount,
      isApproximate: doc.is_approximate,
      item: doc.item,
      categoryId: doc.category_id,
      rawVoice: doc.raw_voice,
      date: doc.date,
      createdAt: doc.created_at,
    };
  },

  updateExpense: async (expenseId: string, updates: Partial<Expense>): Promise<Expense> => {
    const doc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.EXPENSES,
      expenseId,
      {
        amount: updates.amount,
        is_approximate: updates.isApproximate,
        item: updates.item,
        category_id: updates.categoryId,
        date: updates.date,
      }
    );
    return {
      id: doc.$id,
      userId: doc.user_id,
      amount: doc.amount,
      isApproximate: doc.is_approximate,
      item: doc.item,
      categoryId: doc.category_id,
      rawVoice: doc.raw_voice,
      date: doc.date,
      createdAt: doc.created_at,
    };
  },

  deleteExpense: async (expenseId: string): Promise<void> => {
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EXPENSES, expenseId);
  },
};
