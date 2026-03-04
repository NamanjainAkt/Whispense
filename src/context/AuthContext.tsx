// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser, useOAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
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

// Token refresh interval: 30 minutes
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bridge Clerk JWT to Appwrite session
  const bridgeClerkToAppwrite = async (): Promise<void> => {
    if (!clerkUser) return;

    try {
      // Get default Clerk JWT (no template)
      const clerkJwt = await getToken();

      if (clerkJwt) {
        // Set Appwrite session with Clerk JWT
        await AppwriteService.setSession(clerkJwt);
        console.log('Clerk JWT bridged to Appwrite successfully');
      }
    } catch (error) {
      console.error('Failed to bridge Clerk to Appwrite:', error);
      throw error;
    }
  };

  // Sync Clerk user with Appwrite user and bridge sessions
  useEffect(() => {
    if (!isLoaded) return;

    const syncUser = async () => {
      if (isSignedIn && clerkUser) {
        try {
          // First, bridge Clerk session to Appwrite
          await bridgeClerkToAppwrite();

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
              // Create new user in Appwrite
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
      }

      setLoading(false);
    };

    syncUser();
  }, [isLoaded, isSignedIn, clerkUser]);

  // Automatic token refresh
  useEffect(() => {
    if (!isSignedIn || !clerkUser) return;

    // Initial bridge (handled in syncUser, but ensure session is fresh)
    bridgeClerkToAppwrite().catch(console.error);

    // Set up automatic refresh interval
    const refreshInterval = setInterval(async () => {
      try {
        console.log('Refreshing Appwrite session...');
        await bridgeClerkToAppwrite();
      } catch (error) {
        console.error('Failed to refresh Appwrite session:', error);
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(refreshInterval);
  }, [isSignedIn, clerkUser]);

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
      // Clear Appwrite session first
      await AppwriteService.clearSession();
      // Then sign out from Clerk
      await signOut();
      // Clear local cache
      CacheService.clearAll();
      setUser(null);
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
