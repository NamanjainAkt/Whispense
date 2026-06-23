// src/auth/googleAuth.ts
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { account } from '../services/appwrite';

const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';

export async function signInWithGoogle(): Promise<void> {
  try {
    // Create redirect URI using expo-linking
    const redirectUri = Linking.createURL('auth');
    
    console.log('Redirect URI:', redirectUri);

    // Manually build OAuth URL (bypasses location.href issue)
    const oauthUrl = 
      `${APPWRITE_ENDPOINT}/account/sessions/oauth2/google` +
      `?project=${APPWRITE_PROJECT_ID}` +
      `&success=${encodeURIComponent(redirectUri)}` +
      `&failure=${encodeURIComponent(redirectUri)}`;

    console.log('OAuth URL:', oauthUrl);

    // Open the OAuth flow in a browser
    const result = await WebBrowser.openAuthSessionAsync(
      oauthUrl,
      redirectUri
    );

    console.log('WebBrowser result:', result);

    if (result.type === 'success') {
      // The session should be created automatically
      // User will be redirected back to the app
      console.log('OAuth successful!');
    } else if (result.type === 'cancel') {
      console.log('User cancelled OAuth');
    } else {
      console.log('OAuth result:', result);
    }

  } catch (error) {
    console.error('Google login failed:', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await account.deleteSession('current');
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
}
