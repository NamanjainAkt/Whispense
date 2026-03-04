# Whispense - Complete Setup Guide

This guide walks you through setting up Clerk Authentication, Appwrite Backend, and Gemini AI for Whispense.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clerk Setup](#clerk-setup)
3. [Google OAuth Setup](#google-oauth-setup)
4. [Appwrite Setup](#appwrite-setup)
5. [Gemini AI Setup](#gemini-ai-setup)
6. [Environment Variables](#environment-variables)
7. [Testing Your Setup](#testing-your-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ installed
- **Expo CLI** installed (`npm install -g @expo/cli`)
- **Android Studio** (for Android emulator) or physical Android device
- A **Google Account** (for Clerk and Gemini)
- **Git** installed

---

## Clerk Setup

### Step 1: Create Clerk Account

1. Go to [Clerk Dashboard](https://dashboard.clerk.dev/)
2. Sign up with your email or GitHub
3. Create a new application:
   - Name: `Whispense`
   - Select "React Native (Expo)" as the framework (or skip this step)

### Step 2: Get Your Publishable Key

1. In Clerk Dashboard, go to **Configure** → **API Keys**
2. Find your **Publishable key** (starts with `pk_test_` for development)
3. Copy this value for your `.env` file: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Step 3: Configure Redirect URL

1. Go to **Configure** → **Authentication** → **Social Connections**
2. Click **Google**
3. In the **Authorized redirect URLs** section, add:
   - `whispense://oauth-native-callback`
4. Click **Save**

---

## Google OAuth Setup

### Step 1: Get Google OAuth Client ID

You have two options:

**Option A: Use Clerk's Hosted OAuth (Easiest)**
- No additional setup required
- Clerk handles the OAuth flow
- Skip to [Appwrite Setup](#appwrite-setup)

**Option B: Use Your Own Google OAuth (More Control)**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - `https://clerk.your-app.com/v1/oauth_callback` (if using custom domain)
7. Copy the **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
8. This goes in `EXPO_PUBLIC_GOOGLE_CLIENT_ID`

### Step 2: Enable Google Sign-In in Clerk

1. Go back to Clerk Dashboard
2. Go to **Configure** → **Authentication** → **Social Connections**
3. Toggle **Google** to ON
4. Choose your setup:
   - **Use shared credentials** (easiest - Clerk handles it)
   - **Use custom credentials** (paste your Google Client ID and Secret)
5. Click **Save**

---

## Appwrite Setup

### Step 1: Deploy Appwrite on Railway

**Option A: Railway (Recommended - Free tier available)**

1. Go to [Railway](https://railway.app/)
2. Sign up/login with GitHub
3. Click **"New Project"**
4. Click **"Deploy from GitHub repo"**
5. Search for and select `appwrite/appwrite`
6. Click **"Deploy"**
7. Wait for deployment to complete (2-3 minutes)

**Option B: Self-hosted (Docker)**

```bash
# Create appwrite directory
mkdir appwrite && cd appwrite

# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/appwrite/appwrite/main/docker-compose.yml

# Start Appwrite
docker compose up -d
```

### Step 2: Get Appwrite Endpoint & Project ID

1. Once deployed, Railway will give you a public URL
2. Your endpoint will be: `https://your-app-name.up.railway.app/v1`
3. Go to the Appwrite Console (your endpoint without `/v1`)
4. Create a new project:
   - Name: `Whispense`
   - Copy the **Project ID** (looks like: `648a1b2c3d4e5f6789abcdef`)

### Step 3: Create Database

1. In Appwrite Console, go to **Databases**
2. Click **"Create database"**
3. Name: `whispense_db`
4. Database ID: `whispense_db`
5. Click **Create**

### Step 4: Create Collections

#### Collection 1: Users

1. Click **"Create collection"**
2. Database: `whispense_db`
3. Collection ID: `users`
4. Name: `Users`
5. Click **Create**

**Add Attributes:**

| Attribute ID | Type | Size | Required | Default |
|-------------|------|------|----------|---------|
| name | string | 255 | Yes | - |
| email | string | 255 | Yes | - |
| avatar_url | string | 1000 | No | - |
| monthly_budget | integer | - | Yes | 30000 |
| alert_threshold | integer | - | Yes | 80 |
| created_at | datetime | - | Yes | - |

**Add Index:**
- Index Key: `email`
- Type: `key`
- Attributes: `email`

#### Collection 2: Expenses

1. Click **"Create collection"**
2. Collection ID: `expenses`
3. Name: `Expenses`
4. Click **Create**

**Add Attributes:**

| Attribute ID | Type | Required | Default |
|-------------|------|----------|---------|
| user_id | string | Yes | - |
| amount | double | Yes | - |
| is_approximate | boolean | Yes | false |
| item | string | Yes | - |
| category_id | string | Yes | - |
| raw_voice | string | No | - |
| date | datetime | Yes | - |
| created_at | datetime | Yes | - |

**Add Indexes:**

1. Index Key: `user_id_date`
   - Type: `key`
   - Attributes: `user_id`, `date`
   - Orders: `ASC`, `DESC`

2. Index Key: `user_id`
   - Type: `key`
   - Attributes: `user_id`

#### Collection 3: Categories

1. Click **"Create collection"**
2. Collection ID: `categories`
3. Name: `Categories`
4. Click **Create**

**Add Attributes:**

| Attribute ID | Type | Size | Required | Default |
|-------------|------|------|----------|---------|
| user_id | string | - | Yes | - |
| name | string | 100 | Yes | - |
| icon | string | 50 | Yes | - |
| color | string | 7 | Yes | - |
| is_custom | boolean | - | Yes | false |

**Add Index:**
- Index Key: `user_id`
- Type: `key`
- Attributes: `user_id`

### Step 5: Set Permissions

For each collection, you need to set permissions:

1. Go to collection → **Settings** → **Permissions**
2. Add these permissions:
   - `users` collection: `users` → `read`, `update` (own documents only)
   - `expenses` collection: `users` → `create`, `read`, `update`, `delete` (own documents only)
   - `categories` collection: `users` → `create`, `read`, `update`, `delete` (own documents only)

To restrict to own documents only, use:
- `user_id = {{user.$id}}` in the permission filters

### Step 6: Create API Key (for server-side operations)

1. Go to **Overview** → **API Keys**
2. Click **"Create API Key"**
3. Name: `Whispense Server`
4. Scopes: Select `databases.write`, `users.read`, `users.write`
5. Copy the API key (starts with `standard_`)

---

## Gemini AI Setup

### Step 1: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select your Google Cloud project
5. Click **"Create API key in existing project"**
6. Copy the API key (looks like: `AIzaSy...`)

### Step 2: Verify API Access

The Gemini 1.5 Flash model is available in the free tier with:
- 1,500 requests per day
- 1 million tokens per minute

Test your API key:

```bash
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [{
      "parts":[{"text": "Say hello"}]
    }]
  }'
```

---

## Environment Variables

Create a `.env` file in your project root:

```env
# ============================================
# Clerk Authentication
# ============================================
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# ============================================
# Google OAuth (Optional - only if using custom credentials)
# ============================================
# EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com

# ============================================
# Appwrite Configuration
# ============================================
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite-url.up.railway.app/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id

# ============================================
# Gemini AI
# ============================================
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### Where to find each value:

| Variable | Where to find |
|----------|---------------|
| `CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → Configure → API Keys → Publishable key |
| `GOOGLE_CLIENT_ID` | (Optional) Google Cloud Console → APIs & Services → Credentials → Web client |
| `APPWRITE_ENDPOINT` | Your Railway URL + `/v1` |
| `APPWRITE_PROJECT_ID` | Appwrite Console → Settings → Project ID |
| `GEMINI_API_KEY` | Google AI Studio → API Keys |

---

## Testing Your Setup

### Step 1: Verify Environment Variables

```bash
cd whispense

# Check all required variables are set
grep -E "^EXPO_PUBLIC_" .env | wc -l
# Should output: 4 (or 5 if using custom Google Client ID)
```

### Step 2: Test Clerk Auth

1. Run the app: `npx expo start`
2. Press `a` for Android
3. You should see the login screen with "Sign in with Google" button
4. Tap it - should open Google sign-in flow
5. After signing in, check Clerk Dashboard → Users
   - Your email should appear here

### Step 3: Test Appwrite Connection

1. After signing in, check Appwrite Console → Database → Users
   - A new document should be created with your user data
   - Default categories should be seeded automatically

### Step 4: Test Voice Logging

1. Go to Voice tab (center mic button)
2. Tap to record
3. Say: "I spent 50 rupees on chai"
4. You should see parsed result with amount, item, and category
5. Check Appwrite Console → Database → Expenses
   - New expense document should appear

### Step 5: Test Gemini Integration

1. Go to Insights tab
2. You should see:
   - Financial Health Score
   - Category Breakdown
   - AI Saving Suggestions

---

## Troubleshooting

### Clerk Issues

**Error: "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"**
- Ensure your `.env` file exists and contains the key
- Restart Expo: `npx expo start -c` (clear cache)
- Check that the key starts with `pk_test_` (dev) or `pk_live_` (prod)

**Error: "Google Sign-In failed" or OAuth flow doesn't complete**
- Verify Google OAuth is enabled in Clerk Dashboard
- Check that `whispense://oauth-native-callback` is in authorized redirect URLs
- Ensure your app.json has the correct scheme: `"scheme": "whispense"`
- Try using Clerk's shared credentials instead of custom

**Error: "Unable to process callback"**
- Check that the redirect URL in Clerk matches your app scheme
- Verify you're testing on a physical device or emulator with Play Services
- Check that `expo-secure-store` is properly installed

**Error: "Session not found" after sign-in**
- Check that `tokenCache` is properly configured in `_layout.tsx`
- Verify `expo-secure-store` has proper permissions
- Check Clerk Dashboard for session logs

### Appwrite Issues

**Error: "Project not found"**
- Check `EXPO_PUBLIC_APPWRITE_ENDPOINT` ends with `/v1`
- Verify `EXPO_PUBLIC_APPWRITE_PROJECT_ID` is correct
- Ensure your Appwrite instance is running

**Error: "Permission denied"**
- Check collection permissions in Appwrite Console
- Ensure user is authenticated before making requests
- Verify indexes are created correctly

**Error: "Document not found"**
- Check database and collection IDs match exactly
- Verify user document was created in Clerk auth callback

### Gemini Issues

**Error: "API key not valid"**
- Regenerate key in Google AI Studio
- Ensure key has access to Gemini 1.5 Flash model
- Check quota limits (1,500 requests/day on free tier)

**Error: "Model not found"**
- Verify API endpoint is correct: `gemini-1.5-flash`
- Check API key has generative language API access

### General Issues

**TypeScript errors after setup**
```bash
npx tsc --noEmit
```
Fix any reported errors.

**Metro bundler cache issues**
```bash
npx expo start -c
```

**Android build fails**
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

**iOS build issues**
```bash
cd ios
pod install
cd ..
npx expo run:ios
```

---

## Security Checklist

Before deploying to production:

- [ ] Switch to Clerk production instance (pk_live_ key)
- [ ] Regenerate all API keys
- [ ] Set up Appwrite collection permissions correctly
- [ ] Add rate limiting to Gemini calls (already in code)
- [ ] Review and limit API key scopes
- [ ] Enable Clerk's bot protection
- [ ] Set up backup for Appwrite database

---

## Next Steps

After setup is complete:

1. **Test the full flow**: Voice → Parse → Save → View in Dashboard
2. **Set up notifications**: Uncomment notification code in `app/_layout.tsx`
3. **Customize theme**: Edit `src/theme/theme.ts`
4. **Add animations**: Implement Reanimated animations for polish
5. **Build for production**: Follow EAS Build guide in README.md

---

## Migration from Firebase (If Applicable)

If you're migrating from Firebase Auth:

1. Remove Firebase environment variables from `.env`
2. Delete `google-services.json`
3. Uninstall Firebase: `npm uninstall firebase`
4. Update any components referencing `firebaseUser` to use `clerkUser`
5. User data in Appwrite remains compatible (same ID structure)

---

## Support

If you encounter issues:

1. Check logs: `npx expo start` shows errors in terminal
2. Enable debug mode: Add `console.log()` statements
3. Check network requests: Use React Native Debugger or Flipper
4. Verify environment: Run `npx expo doctor`
5. Clear caches: `npx expo start -c`
6. Clerk docs: [clerk.dev/docs](https://clerk.dev/docs)
7. Appwrite docs: [appwrite.io/docs](https://appwrite.io/docs)

---

**You are now ready to use Whispense!** 🎤
