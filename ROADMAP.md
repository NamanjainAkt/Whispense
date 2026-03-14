# Whispense: Technical Specification & Roadmap

This document outlines the remaining development tasks required to transition Whispense from a prototype with mocked data to a fully functional voice-controlled expense tracker.

## 1. Project Overview
Whispense is a React Native (Expo) application that uses Gemini AI to parse natural language voice inputs into structured expense data, stored in Appwrite.

## 2. Technical Gap Analysis
| Feature | Current Status | Requirement |
| :--- | :--- | :--- |
| **Voice Input** | Mocked (Hardcoded string) | Real-time audio recording + STT (Speech-to-Text) |
| **Expense Logic** | Functional (Gemini) | Refine category mapping & currency detection |
| **Persistence** | Functional (Appwrite) | Robust offline sync & error handling |
| **Insights** | Functional (Gemini) | Historical data visualization (Charts) |
| **User Profile** | Basic | Budgeting goals & multi-currency support |

---

## 3. Implementation Phases

### Phase 1: Native Voice Integration (CRITICAL)
**Goal:** Replace `mockTranscript` with actual user speech.
- **Library:** `expo-av` for recording and `google-cloud-speech` (or Whisper API/On-device STT).
- **Task 1.1:** Implement `AudioService` using `expo-av`.
- **Task 1.2:** Integrate a Speech-to-Text provider to convert audio buffers to text.
- **Task 1.3:** Update `voice.tsx` to handle permissions and recording states.

### Phase 2: Data Visualization & Insights
**Goal:** Make financial data actionable.
- **Task 2.1:** Integrate `react-native-chart-kit`.
- **Task 2.2:** Build a "Spending Trends" chart in `insights.tsx`.
- **Task 2.3:** Implement "Category Breakdown" (Pie Chart).

### Phase 3: Robust Offline Sync
**Goal:** Ensure zero data loss on poor connections.
- **Task 3.1:** Enhance `CacheService` to use `NetInfo` for automatic background syncing.
- **Task 3.2:** Implement conflict resolution for edited expenses.

### Phase 4: UI/UX Polishing
**Goal:** Premium feel.
- **Task 4.1:** Add micro-interactions (Lottie animations for voice waves).
- **Task 4.2:** Implement "Quick Edit" for parsed expenses before saving.

---

## 4. Development Strategy
1. **Switch to Development Builds:** Essential for native audio hooks.
2. **Modular Services:** Keep `AudioService` independent of `GeminiService`.
3. **Test-Driven:** Validate STT accuracy with various accents/languages (Hinglish).

---
*Document generated on March 14, 2026*
