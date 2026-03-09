// src/auth/googleAuth.ts
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { account } from '../services/appwrite';

export async function signInWithGoogle(): Promise<void> {
  try {
    // Create redirect URI using expo-linking
    const redirectUri = Linking.createURL('auth');
    
    console.log('Redirect URI:', redirectUri);

    // Get the OAuth URL from Appwrite
    const loginUrl = account.createOAuth2Session(
      'google',
      redirectUri,
      redirectUri
    );

    console.log('OAuth URL:', loginUrl.toString());

    // Open the OAuth flow in a browser
    const result = await WebBrowser.openAuthSessionAsync(
      loginUrl.toString(),
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
