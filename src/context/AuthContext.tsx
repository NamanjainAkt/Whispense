// src/context/AuthContext.tsx
import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { Models } from 'appwrite';
import { account } from '../services/appwrite';
import { CacheService } from '../services/cache';
import { AppwriteService } from '../services/appwrite';
import { signInWithGoogle, signOut as googleSignOut } from '../auth/googleAuth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  appwriteUser: Models.User<Models.Preferences> | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const mounted = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [appwriteUser, setAppwriteUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Track mount status
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const syncUserWithDatabase = useCallback(
    async (session: Models.User<Models.Preferences>) => {
      if (!mounted.current) return;
      
      try {
        const userId = session.$id;

        const cachedUser = await CacheService.getUser();
        if (cachedUser && cachedUser.id === userId) {
          setUser(cachedUser);
          return;
        }

        let dbUser = await AppwriteService.getUser(userId);

        if (!dbUser) {
          dbUser = await AppwriteService.createUser({
            id: userId,
            name: session.name || 'User',
            email: session.email || '',
          });
        }

        if (mounted.current) {
          setUser(dbUser);
          await CacheService.setUser(dbUser);
        }
      } catch (error) {
        console.error('Error syncing user with database:', error);
      }
    },
    []
  );

  const checkAuthStatus = useCallback(async () => {
    if (!mounted.current) return;
    
    try {
      const session = await account.get();
      if (!mounted.current) return;
      
      setAppwriteUser(session);
      setIsAuthenticated(true);
      await syncUserWithDatabase(session);
    } catch {
      if (!mounted.current) return;
      
      // No active session
      setAppwriteUser(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [syncUserWithDatabase]);

  // Check for existing session on mount only
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, segments, router]);

  const handleSignInWithGoogle = async () => {
    try {
      await signInWithGoogle();
      // After OAuth completes, check auth status
      await checkAuthStatus();
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await googleSignOut();
      await CacheService.clearAll();
      if (mounted.current) {
        setUser(null);
        setAppwriteUser(null);
        setIsAuthenticated(false);
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
        appwriteUser,
        loading,
        signInWithGoogle: handleSignInWithGoogle,
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
