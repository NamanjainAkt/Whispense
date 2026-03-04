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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Clerk user with Appwrite user
  useEffect(() => {
    if (!isLoaded) return;

    const syncUser = async () => {
      if (isSignedIn && clerkUser) {
        try {
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

  // Handle routing based on auth state
  useEffect(() => {
    if (!isLoaded || loading) return;

    if (isSignedIn) {
      // User is signed in, make sure they're not on login
      // The login screen handles this itself
    }
  }, [isLoaded, isSignedIn, loading]);

  const signInWithGoogle = async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();

      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        // The useEffect above will handle syncing with Appwrite
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
      await signOut();
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
