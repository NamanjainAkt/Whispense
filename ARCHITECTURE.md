# Whispense Architecture

## Overview

Whispense is an AI-powered expense tracking React Native (Expo) app with voice input. It uses a **cache-first, write-through** data model with local-first rendering and Appwrite as the remote backend. Auth is handled by Clerk with Google Sign-In.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83 + Expo SDK 55 |
| Navigation | expo-router (file-based routing) |
| UI Styling | StyleSheet (no Tailwind/CSS-in-JS) |
| Auth | Clerk (`@clerk/clerk-expo`) with SecureStore token cache |
| Backend / DB | Appwrite (self-hosted) — Documents API |
| AI Parsing | Google Gemini (`gemma-4-31b-it`) + local rule-based fallback |
| Local Storage | AsyncStorage |
| Push Notifications | expo-notifications |
| Speech | `@react-native-voice/voice` (STT) + `expo-speech` (TTS) |

---

## Project Structure

```
app/                      # expo-router file-based routing
├── _layout.tsx           # Root layout — ClerkProvider → AuthProvider → Stack
├── login.tsx             # Login screen
├── +not-found.tsx        # 404
└── (tabs)/               # Tab navigator (authenticated)
    ├── _layout.tsx       # Tab bar config (Home, Expenses, Voice, Insights, Profile)
    ├── index.tsx         # Home dashboard
    ├── expenses.tsx      # Expense list with CRUD + BottomSheet editor
    ├── voice.tsx         # Voice recording + AI parsing + confirm/save
    ├── insights.tsx      # Charts + AI-generated suggestions
    └── profile.tsx       # Settings, budget config, CSV export, logout

src/
├── theme/                # Design token system
│   ├── theme.ts          # Colors, spacing, typography, shadows — single source of truth
│   ├── types.ts          # Theme type
│   ├── useTheme.ts       # Hook that returns theme
│   └── index.ts          # Barrel exports
├── components/
│   ├── ui/               # Atomic UI primitives (Button, Card, Text, Input, etc.)
│   └── OfflineIndicator.tsx
├── context/
│   └── AuthContext.tsx    # Auth provider — bridges Clerk → app user state → routing guard
├── services/
│   ├── appwrite.ts       # Appwrite CRUD wrapper (Users, Expenses, Categories)
│   ├── cache.ts          # AsyncStorage cache service with typed methods
│   ├── sync.ts           # Offline-first sync queue (pending ops → replay on reconnect)
│   ├── ai.ts             # AI expense parsing (local first → Gemini fallback) + insights
│   ├── localParser.ts    # On-device Hinglish/Hindi/English rule-based expense parser
│   └── notifications.ts  # Push notification setup
├── types/
│   └── index.ts          # User, Expense, Category, ParsedExpense types + DEFAULT_CATEGORIES
└── constants/
    └── index.ts          # App-wide constants (budget defaults, storage keys)
```

---

## Data Flow Architecture

### Principle: Cache-first reads, write-through writes

```
┌────────────────────────────────────────────────────────────┐
│                    UI Layer (Screens)                       │
│   Home / Expenses / Voice / Insights / Profile             │
└──────────┬──────────────────────────────┬─────────────────┘
           │ read                          │ write
           ▼                               ▼
┌──────────────────────┐       ┌──────────────────────┐
│   CacheService        │       │   SyncService         │
│   (AsyncStorage)      │       │   (offline-first)     │
│                      │       │                      │
│   • Instant reads     │       │   • Online  → Appwrite│
│   • Offline fallback  │       │   • Offline → Pending │
│   • Pending ops store │       │     queue (replay     │
│                      │       │     on reconnect)      │
└──────────────────────┘       └──────────┬───────────┘
                                           │
                                           ▼
                                 ┌──────────────────┐
                                 │  AppwriteService  │
                                 │  (Remote DB)      │
                                 │                  │
                                 │  Collections:     │
                                 │  • users          │
                                 │  • expenses       │
                                 │  • categories     │
                                 └──────────────────┘
```

**Read path:** Screens always read from `CacheService` first for instant rendering. On mount, they also trigger a background sync from Appwrite that merges remote data with locally-created items (identified by `local-` prefix IDs) and updates both state and cache.

**Write path:** All mutations go through `SyncService.perform()`, which attempts an online Appwrite write. If online, it succeeds immediately; if offline or the request fails, the operation is added to a **pending sync queue** in AsyncStorage. The `SyncService` replays pending ops when connectivity returns (via NetInfo listener).

---

## Auth Flow

```
ClerkProvider (app/_layout.tsx)
  └─ ClerkLoaded
      └─ GestureHandlerRootView
          └─ SafeAreaProvider
              └─ AuthProvider (src/context/AuthContext.tsx)
                  └─ Stack Navigator
                      ├─ (tabs)  ← authenticated
                      └─ login   ← unauthenticated
```

- Clerk manages tokens via `expo-secure-store` (custom `tokenCache`).
- `AuthContext` bridges Clerk's user into the app's `User` type, syncing the Clerk identity with Appwrite's `users` collection on first sign-in (creates Appwrite user doc + seeds default categories).
- A routing effect redirects between `login` and `(tabs)` based on auth state.
- Logout clears Clerk session + AsyncStorage cache.

---

## Voice → Expense Pipeline

```
User speaks
    │
    ▼
@react-native-voice/voice  (STT, en-IN/en-US locales)
    │  transcript
    ▼
AIService.parseExpense()
    │
    ├─ 1. LocalParser  (rule-based: Hinglish/Hindi/English)
    │      → high confidence? Return immediately (offline, instant)
    │      → low confidence? Fall through
    │
    ├─ 2. Google AI API  (gemma-4-31b-it model)
    │      → Success? Return parsed JSON
    │      → Fail? Fall through
    │
    └─ 3. Offline fallback  (use local parser result anyway)
           → Return with parsedBy='offline-fallback'
    │
    ▼
User reviews parsed result (amount, item, category)
    │  confirms
    ▼
SyncService.perform() → AppwriteService.createExpense()
    │
    ▼
CacheService.addExpense() + (optional) TTS confirmation
```

**Parsing confidence badges:**
- `⚡ Parsed Locally` — high confidence from rule engine
- `✨ Parsed with Google AI` — Gemini API used
- `🔌 Offline Best-Guess` — fallback mode

**Quick Confirm mode:** If confidence is high and the preference is enabled, expenses auto-save without user review.

---

## Theme System

All design tokens live in `src/theme/theme.ts`:

- **colors** — primary, secondary, background, text, status, financial
- **fontSizes** — xs through xxxl
- **fontWeights** — regular, medium, semiBold, bold
- **lineHeights** — matching sizes
- **spacing** — xs (4) through xxl (48)
- **borderRadius** — sm (8) through full (9999)
- **shadows** — light, medium, heavy

Components use `useTheme()` to access the theme object. Styles are defined using `StyleSheet.create()` inside components, referencing theme values. No hardcoded colors or spacing.

---

## Service Layer Details

### CacheService (`src/services/cache.ts`)
- Typed `get<T>()` / `set<T>()` over AsyncStorage with JSON serialization
- Corrupted entries are automatically deleted on read
- `clearAll()` only clears app-scoped keys (not third-party libs)
- Methods: user, categories, expenses (CRUD), pending sync queue, auth token, FCM token, insights cache, user preferences

### AppwriteService (`src/services/appwrite.ts`)
- Stateless wrapper around Appwrite JS SDK
- Collections: `users`, `expenses`, `categories`
- Maps Appwrite's snake_case fields to TypeScript camelCase
- `seedDefaultCategories()` called on new user creation (best-effort)

### SyncService (`src/services/sync.ts`)
- Singleton — auto-initializes on import
- Listens to NetInfo connectivity changes
- `perform()` — wraps any Appwrite operation with offline fallback
- `processPendingSync()` — replays queued operations; handles `local-` → real ID mapping for categories referenced in expenses
- Queue stores: type (create/update/delete), collection, id, data, timestamp

### AIService (`src/services/ai.ts`)
- `parseExpense()` — 3-tier parsing (local → AI → fallback)
- `generateInsights()` — calls Gemini with expense data for health score + suggestions + patterns
- Insights are cached for 24 hours

### LocalParser (`src/services/localParser.ts`)
- Rule-based parser supporting Hinglish, Hindi, English
- Number word mapping: 0–100 in Hindi + multipliers (sau, hazaar, lakh, crore)
- Currency detection: `₹`, `rs`, `rupees`, `rupaye`, `dollars`, etc.
- Category keyword matching per category (food, transport, groceries, health, shopping, bills)
- Confidence scoring based on amount presence, item extraction, and category match

---

## Key Design Decisions

1. **No global state library** — Context + prop drilling suffices for the current scope
2. **No CSS-in-JS** — StyleSheet.create() keeps runtime overhead zero
3. **local- prefix IDs** — distinguish un-synced local entities; SyncService maps them to server IDs after successful create
4. **Offline resilience** — every important operation flows through SyncService; the app works fully offline and syncs when connectivity returns
5. **AI tiered fallback** — local parser handles the common case instantly; Gemini handles complex/ambiguous input; offline fallback ensures the app never blocks on network
