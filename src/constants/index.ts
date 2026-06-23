// src/constants/index.ts
export const APP_NAME = 'Whispense';
export const DEFAULT_MONTHLY_BUDGET = 30000;
export const DEFAULT_ALERT_THRESHOLD = 80;
export const DEFAULT_CURRENCY = '₹';

export const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  CATEGORIES: 'categories',
  EXPENSES_CURRENT_MONTH: 'expenses_current_month',
  LAST_SYNC_TIMESTAMP: 'last_sync_timestamp',
  PENDING_SYNC: 'pending_sync',
  AUTH_TOKEN: 'auth_token',
  FCM_TOKEN: 'fcm_token',
  INSIGHTS_CACHE: 'insights_cache',
  USER_PREFERENCES: 'user_preferences',
} as const;
