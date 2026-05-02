# Whispense

AI-powered expense tracking app with voice input. Built with React Native, Expo, Clerk, Appwrite, and Gemini AI.

## Features

- Voice-based expense logging with AI parsing
- Real-time budget tracking and alerts
- Monthly insights and spending analysis
- Offline support with local caching
- CSV export functionality
- Push notifications for reminders and alerts

## Tech Stack

- **Frontend**: React Native + Expo
- **Navigation**: expo-router
- **Backend**: Appwrite (self-hosted on Railway)
- **Authentication**: Clerk with Google Sign-In
- **AI**: Gemini 1.5 Flash API (free tier)
- **Storage**: AsyncStorage for local cache
- **Styling**: StyleSheet (no NativeWind/Tailwind)

## Project Structure

```
src/
├── theme/              # Theme system (colors, typography, spacing)
├── components/ui/      # Atomic UI components
├── screens/            # Screen components
├── context/            # React contexts (Auth)
├── services/           # API services (Appwrite, Gemini, Cache, Notifications)
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── constants/          # App constants

app/                    # expo-router file-based routing
├── (tabs)/             # Tab navigation screens
├── _layout.tsx         # Root layout
├── login.tsx           # Login screen
└── +not-found.tsx      # 404 screen
```

## Quick Start

For detailed setup instructions, see **[SETUP.md](SETUP.md)**.

### 1. Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for emulator)
- Clerk, Appwrite, and Gemini accounts

### 2. Install & Setup

```bash
# Clone and install
git clone <repo-url>
cd whispense
npm install

# Copy environment template
cp .env.example .env

# Fill in your credentials (see SETUP.md for details)
# EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# EXPO_PUBLIC_APPWRITE_ENDPOINT=...
# EXPO_PUBLIC_GEMINI_API_KEY=...
```

### 3. Run the App

```bash
npx expo start
# Press 'a' for Android
```

**For complete setup guide with screenshots and troubleshooting, see [SETUP.md](SETUP.md)**

## Architecture Principles

1. **Single Theme Source**: All colors, spacing, and typography come from `src/theme/theme.ts`
2. **No Hardcoded Values**: Components never define their own colors
3. **StyleSheet Only**: No NativeWind or CSS-in-JS libraries
4. **Cache-First Reads**: AsyncStorage is the primary data source, Appwrite is the sync target
5. **Write-Through**: All writes go to Appwrite first, then cache on success

## Key Rules

- Every component styles come from a `createStyles(theme)` factory function
- Test theme swap early: change `theme.colors.primary` and verify the app updates
- Gemini calls are batched for insights (1x daily) but real-time for voice parsing
- All new files must be TypeScript with proper type definitions

## Building for Production

```bash
# Configure EAS
npx eas build:configure

# Build for Android
npx eas build --platform android --profile production

# Or local build
npx expo run:android --variant release
```

## Testing

- Voice logging flow should complete in ≤ 5 seconds
- Broken speech: "uh 50 rupees chai" → ₹50 / Food & Drinks
- Hinglish: "aaj auto mein 120 laga" → ₹120 / Transport
- 100 expenses should scroll at 60fps
- Kill + reopen: data persists, no re-login required

## License

MIT
