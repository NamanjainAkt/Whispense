// app/login.tsx - Login Screen
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Text, Button, Spacer } from '../src/components/ui';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithGoogle, user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user && !loading) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="body" color="textSecondary">
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Logo placeholder */}
        <View
          style={[
            styles.logo,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text variant="h1" color="white">
            🎤
          </Text>
        </View>

        <Spacer size="xl" />

        <Text variant="h1" center>
          Whispense
        </Text>

        <Spacer size="sm" />

        <Text variant="body" color="textSecondary" center>
          Track your expenses with just your voice. No typing needed.
        </Text>

        <Spacer size="xxl" />

        <Button
          onPress={handleSignIn}
          loading={isSigningIn}
          style={styles.googleButton}
        >
          Sign in with Google
        </Button>

        <Spacer size="lg" />

        <Text variant="caption" color="textMuted" center>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>

      {/* Decorative elements */}
      <View
        style={[
          styles.decorativeCircle1,
          { backgroundColor: theme.colors.primaryLight },
        ]}
      />
      <View
        style={[
          styles.decorativeCircle2,
          { backgroundColor: theme.colors.primaryLight },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: {
    minWidth: 280,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -100,
    right: -100,
    opacity: 0.5,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: 50,
    left: -50,
    opacity: 0.3,
  },
});
