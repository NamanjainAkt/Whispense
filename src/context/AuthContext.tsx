// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser, useOAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Client, Functions, Account } from 'appwrite';
import { CacheService } from '../services/cache';
import { AppwriteService } from '../services/appwrite';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  clerkUser: ReturnType<typeof useUser>['user'];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Appwrite client for function calls (no session needed initially)
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const functions = new Functions(client);
const account = new Account(client);

// Function ID for clerk-auth (you'll get this after deploying)
const CLERK_AUTH_FUNCTION_ID = 'clerk-auth'; // Update this after deployment

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appwriteSessionCreated, setAppwriteSessionCreated] = useState(false);

  // Bridge Clerk to Appwrite via Function
  const bridgeClerkToAppwrite = async (): Promise<void> => {
    if (!clerkUser) return;

    try {
      console.log('Calling clerk-auth function...');

      // Call the clerk-auth function
      const execution = await functions.createExecution(
        CLERK_AUTH_FUNCTION_ID,
        JSON.stringify({
          userId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          name: clerkUser.fullName || clerkUser.firstName,
        }),
        false, // async = false (wait for result)
        '/',   // path
        'POST' // method
      );

      const response = JSON.parse(execution.responseBody);
      console.log('Function response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Function failed');
      }

      // Create Appwrite session using the token secret
      await account.createSession(
        response.userId,
        response.tokenSecret
      );

      console.log('Appwrite session created successfully');
      setAppwriteSessionCreated(true);

    } catch (error) {
      console.error('Failed to bridge Clerk to Appwrite:', error);
      throw error;
    }
  };

  // Sync Clerk user with Appwrite user
  useEffect(() => {
    if (!isLoaded) return;

    const syncUser = async () => {
      if (isSignedIn && clerkUser) {
        try {
          // Bridge Clerk to Appwrite first
          if (!appwriteSessionCreated) {
            await bridgeClerkToAppwrite();
          }

          // Try to get user from cache first
          const cachedUser = CacheService.getUser();
          const clerkUserId = clerkUser.id;

          if (cachedUser && cachedUser.id === clerkUserId) {
            setUser(cachedUser);
          } else {
            // Fetch from Appwrite
            const appwriteUser = await AppwriteService.getUser(clerkUserId);

            if (appwriteUser) {
              setUser(appwriteUser);
              CacheService.setUser(appwriteUser);
            } else {
              // Create new user in Appwrite database (not auth)
              const newUser = await AppwriteService.createUser({
                id: clerkUserId,
                name: clerkUser.fullName || clerkUser.firstName || 'User',
                email: clerkUser.primaryEmailAddress?.emailAddress || '',
                avatarUrl: clerkUser.imageUrl || undefined,
              });
              setUser(newUser);
              CacheService.setUser(newUser);
            }
          }
        } catch (error) {
          console.error('Error syncing user:', error);
        }
      } else {
        setUser(null);
        CacheService.deleteUser();
        setAppwriteSessionCreated(false);
      }

      setLoading(false);
    };

    syncUser();
  }, [isLoaded, isSignedIn, clerkUser, appwriteSessionCreated]);

  const signInWithGoogle = async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();

      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        // The useEffect above will handle bridging and syncing with Appwrite
      } else {
        throw new Error('No session created during OAuth flow');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear Appwrite session
      try {
        await account.deleteSessions();
      } catch (e) {
        console.log('No Appwrite session to clear');
      }

      // Sign out from Clerk
      await signOut();

      // Clear local cache
      CacheService.clearAll();
      setUser(null);
      setAppwriteSessionCreated(false);
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, clerkUser, loading: loading || !isLoaded, signInWithGoogle, logout }}
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
