// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { Client, Account, OAuthProvider, Models } from 'appwrite';
import * as WebBrowser from 'expo-web-browser';
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
      // Get OAuth2 URL from Appwrite
      const redirectUri = 'whispense://callback';
      
      // Create OAuth2 session
      const response = await account.createOAuth2Session(
        OAuthProvider.Google,
        redirectUri,  // Success URL
        redirectUri,  // Failure URL
        []            // Scopes (empty = default)
      );

      // The response will be handled by deep linking
      // After successful OAuth, checkAuthStatus will be called
      
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  // Handle OAuth callback
  const handleOAuthCallback = async (url: string) => {
    try {
      // Extract session from URL if needed
      // Appwrite handles this automatically via cookies
      await checkAuthStatus();
    } catch (error) {
      console.error('OAuth callback error:', error);
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
