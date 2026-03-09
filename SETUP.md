# Whispense - Complete Setup Guide

This guide walks you through setting up Appwrite Authentication, Backend, and Gemini AI for Whispense.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Appwrite Setup](#appwrite-setup)
3. [Google OAuth Setup](#google-oauth-setup)
4. [Gemini AI Setup](#gemini-ai-setup)
5. [Environment Variables](#environment-variables)
6. [Testing Your Setup](#testing-your-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ installed
- **Expo CLI** installed (`npm install -g @expo/cli`)
- **Android Studio** (for Android emulator) or physical Android device
- A **Google Account** (for OAuth and Gemini)
- **Git** installed

---

## Appwrite Setup

### Step 1: Create Appwrite Project

1. Go to [Appwrite Cloud Console](https://cloud.appwrite.io/)
2. Sign up/login with your preferred method
3. Click **"Create Project"**
4. Name: `Whispense`
5. Copy the **Project ID** (looks like: `648a1b2c3d4e5f6789abcdef`)

### Step 2: Enable Google OAuth

1. In Appwrite Console, go to **Auth** → **Settings**
2. Scroll to **OAuth2 Providers**
3. Find **Google** and click it
4. Toggle **Enabled** to ON
5. You'll need to add Google Client ID and Secret (see [Google OAuth Setup](#google-oauth-setup))

### Step 3: Create Database

1. Go to **Databases**
2. Click **"Create database"**
3. Database ID: `whispense_db`
4. Name: `Whispense DB`
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

For each collection, set permissions:

1. Go to collection → **Settings** → **Permissions**
2. Add:
   - **Users Collection**: `Users` → `read`, `update` (own documents)
   - **Expenses Collection**: `Users` → `create`, `read`, `update`, `delete` (own documents)
   - **Categories Collection**: `Users` → `create`, `read`, `update`, `delete` (own documents)

To restrict to own documents, add filter: `user_id = {{user.$id}}`

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Click **"OAuth consent screen"** (left sidebar)
2. Select **"External"** (or Internal if using Google Workspace)
3. Fill in:
   - App name: `Whispense`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. Skip Scopes and Test Users for now
6. Click **Back to Dashboard**

### Step 3: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: `Whispense Web Client`
4. Authorized redirect URIs:
   - `https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/YOUR_PROJECT_ID`
   - (Replace `YOUR_PROJECT_ID` with your actual Appwrite project ID)
5. Click **Create**
6. Copy **Client ID** and **Client Secret**

### Step 4: Add to Appwrite

1. Go back to Appwrite Console → **Auth** → **Settings** → **OAuth2**
2. Click **Google**
3. Paste:
   - App ID: Google Client ID
   - Secret: Google Client Secret
4. Click **Update**

---

## Gemini AI Setup

### Step 1: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select your Google Cloud project
5. Copy the API key (looks like: `AIzaSy...`)

### Step 2: Verify API Access

Test your API key:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [{"parts":[{"text": "Say hello"}]}]
  }'
```

---

## Environment Variables

Create a `.env` file in your project root:

```env
# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id

# Gemini AI
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### Where to find each value:

| Variable | Where to find |
|----------|---------------|
| `APPWRITE_ENDPOINT` | Appwrite Console → Settings → API Endpoint |
| `APPWRITE_PROJECT_ID` | Appwrite Console → Settings → Project ID |
| `GEMINI_API_KEY` | Google AI Studio → API Keys |

---

## Testing Your Setup

### Step 1: Verify Environment Variables

```bash
cd whispense

# Check variables
grep -E "^EXPO_PUBLIC_" .env
```

### Step 2: Test Appwrite Auth

1. Run: `npx expo start -c`
2. Press `a` for Android
3. Tap "Sign in with Google"
4. OAuth should open in browser - complete Google sign-in
5. After sign-in, app should return automatically
6. Check Appwrite Console → Auth → Users - your email should appear
7. Check Metro logs - should see OAuth success message

### Step 3: Test Database

1. After sign-in, go to Voice tab
2. Record: "I spent 50 rupees on chai"
3. Save the expense
4. Check Appwrite Console → Database → Expenses - document should exist

### Step 4: Test Gemini

1. Go to Insights tab
2. You should see AI-generated suggestions

---

## Troubleshooting

### Auth Issues

**"User already exists in the project"**
- This is normal - Appwrite creates a user on first OAuth sign-in
- Subsequent sign-ins use the same user

**"Failed to create OAuth2 session"**
- Check Google OAuth credentials in Appwrite Console
- Verify redirect URI is correct
- Ensure OAuth consent screen is published (or add test users)

**"Permission denied" on database**
- Check collection permissions are set to `Users`
- Verify you're authenticated (check Auth → Sessions)

### General Issues

**Metro bundler cache issues**
```bash
npx expo start -c
```

**TypeScript errors**
```bash
npx tsc --noEmit
```

**Android build fails**
```bash
cd android && ./gradlew clean && cd ..
npx expo run:android
```

---

## Security Checklist

Before deploying to production:

- [ ] Enable Appwrite Email Verification (optional)
- [ ] Set up proper collection permissions
- [ ] Regenerate all API keys
- [ ] Review Google OAuth consent screen branding
- [ ] Enable rate limiting on Gemini calls

---

## Support

If you encounter issues:

1. Check logs: `npx expo start`
2. Verify environment: `npx expo doctor`
3. Clear caches: `npx expo start -c`
4. Appwrite docs: [appwrite.io/docs](https://appwrite.io/docs)

---

**You are now ready to use Whispense!** 🎤
