// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { Client, Account, Models } from 'appwrite';
import { authorize } from 'react-native-app-auth';
import { CacheService } from '../services/cache';
import { AppwriteService } from '../services/appwrite';
import type { User } from '../types';

// Appwrite configuration
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';

interface AuthContextType {
  user: User | null;
  appwriteUser: Models.User<Models.Preferences> | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);

// react-native-app-auth configuration for Appwrite Google OAuth
const authConfig = {
  issuer: APPWRITE_ENDPOINT,
  clientId: APPWRITE_PROJECT_ID, // Appwrite uses project ID as client ID
  redirectUrl: 'whispense://callback',
  scopes: ['openid', 'profile', 'email'],
  // Appwrite OAuth2 endpoint
  authorizationEndpoint: `${APPWRITE_ENDPOINT}/account/sessions/oauth2/google`,
  tokenEndpoint: `${APPWRITE_ENDPOINT}/account/sessions/oauth2/callback/google/${APPWRITE_PROJECT_ID}`,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  
  const [user, setUser] = useState<User | null>(null);
  const [appwriteUser, setAppwriteUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, segments]);

  const checkAuthStatus = async () => {
    try {
      // Try to get current session
      const session = await account.get();
      setAppwriteUser(session);
      setIsAuthenticated(true);

      // Fetch or create user data in database
      await syncUserWithDatabase(session);
    } catch (error) {
      // No active session
      setAppwriteUser(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const syncUserWithDatabase = async (session: Models.User<Models.Preferences>) => {
    try {
      const userId = session.$id;
      
      // Try to get from cache first
      const cachedUser = await CacheService.getUser();
      if (cachedUser && cachedUser.id === userId) {
        setUser(cachedUser);
        return;
      }

      // Fetch from Appwrite database
      let appwriteUser = await AppwriteService.getUser(userId);

      if (!appwriteUser) {
        // Create new user document in database
        appwriteUser = await AppwriteService.createUser({
          id: userId,
          name: session.name || 'User',
          email: session.email || '',
          avatarUrl: undefined, // Appwrite doesn't provide avatar URL directly
        });
      }

      setUser(appwriteUser);
      await CacheService.setUser(appwriteUser);
    } catch (error) {
      console.error('Error syncing user with database:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google OAuth with react-native-app-auth...');
      console.log('Auth config:', authConfig);

      // Use react-native-app-auth to perform OAuth
      const result = await authorize(authConfig);

      console.log('OAuth result:', result);

      if (result.accessToken) {
        // The session should be created automatically by Appwrite
        // Just need to refresh the auth status
        await checkAuthStatus();
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Delete current session
      await account.deleteSession('current');
      
      // Clear cache
      await CacheService.clearAll();
      
      // Reset state
      setUser(null);
      setAppwriteUser(null);
      setIsAuthenticated(false);
      
      // Redirect to login
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        appwriteUser, 
        loading, 
        signInWithGoogle, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}