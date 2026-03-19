// src/context/AuthContext.tsx
import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { CacheService } from '../services/cache';
import { AppwriteService } from '../services/appwrite';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const mounted = useRef(false);
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Track mount status
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const syncUserWithDatabase = useCallback(
    async (clerkId: string, email: string, name: string) => {
      if (!mounted.current) return;
      
      try {
        const cachedUser = await CacheService.getUser();
        if (cachedUser && cachedUser.id === clerkId) {
          setUser(cachedUser);
          return;
        }

        let dbUser = await AppwriteService.getUser(clerkId);

        if (!dbUser) {
          dbUser = await AppwriteService.createUser({
            id: clerkId,
            name: name || 'User',
            email: email || '',
          });
        }

        if (mounted.current) {
          setUser(dbUser);
          await CacheService.setUser(dbUser);
        }
      } catch (error) {
        console.error('Error syncing user with database:', error);
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && clerkUser) {
      syncUserWithDatabase(
        clerkUser.id,
        clerkUser.primaryEmailAddress?.emailAddress || '',
        clerkUser.fullName || clerkUser.username || 'User'
      );
    } else {
      if (mounted.current) {
        setUser(null);
        setLoading(false);
      }
    }
  }, [isLoaded, isSignedIn, clerkUser, syncUserWithDatabase]);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading || !isLoaded || !mounted.current) return;

    const inAuthGroup = segments[0] === 'login';

    const timeoutId = setTimeout(() => {
      if (!mounted.current) return;

      if (!isSignedIn && !inAuthGroup) {
        router.replace('/login');
      } else if (isSignedIn && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isSignedIn, loading, isLoaded, segments, router]);

  const handleLogout = async () => {
    try {
      await signOut();
      await CacheService.clearAll();
      if (mounted.current) {
        setUser(null);
      }
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
        loading: loading || !isLoaded,
        logout: handleLogout,
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
