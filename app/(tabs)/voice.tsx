import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Button, Card, Spacer, Chip, Input } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { AIService } from '../../src/services/ai';
import { AppwriteService } from '../../src/services/appwrite';
import { CacheService } from '../../src/services/cache';
import SyncService from '../../src/services/sync';
import type { Category, ParsedExpense } from '../../src/types';
import { DEFAULT_CATEGORIES } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const BAR_HEIGHTS = Array.from({ length: 20 }, (_, i) => {
  return 20 + Math.sin((i / 20) * Math.PI * 2) * 15 + Math.random() * 10;
});

export default function VoiceScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({ voiceConfirmation: true, quickConfirm: false });
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'parsed'>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedExpense, setParsedExpense] = useState<(ParsedExpense & { parsedBy?: 'local' | 'google-ai' | 'offline-fallback' }) | null>(null);

  useFocusEffect(
    useCallback(() => {
      CacheService.getPreferences().then(setPreferences);
    }, [])
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [editAmount, setEditAmount] = useState('');
  const [editItem, setEditItem] = useState('');

  const waveAnimValues = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      height: new Animated.Value(BAR_HEIGHTS[i]),
      opacity: new Animated.Value(0.3 + (i % 5) * 0.15),
    }))
  ).current;
  const pulseAnim = useRef(new Animated.Value(1));
  const categoriesRef = useRef<Category[]>([]);
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef('');
  const waveAnims = useRef(
    Array.from({ length: 20 }, () => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(0.6),
    }))
  ).current;

  // --- expo-speech-recognition event hooks ---
  useSpeechRecognitionEvent('start', () => {
    setStatus('recording');
    setError('');
    triggerHaptic('light');
  });

  useSpeechRecognitionEvent('end', () => {
  });

  useSpeechRecognitionEvent('result', (event) => {
    const lastResult = event.results[event.results.length - 1];
    if (lastResult) {
      const text = lastResult.transcript;
      transcriptRef.current = text;
      setTranscript(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    if (event.error === 'not-allowed') {
      setPermissionDenied(true);
      setError('Microphone permission denied. Please enable it in settings.');
    } else {
      setError(event.message || 'Speech recognition error');
    }
    setStatus('idle');
    triggerHaptic('heavy');
  });

  // --- /event hooks ---

  const loadCategories = useCallback(async () => {
    if (!user) return;

    const cached = await CacheService.getCategories();
    if (cached.length > 0) {
      setCategories(cached);
    }

    try {
      const appwriteCategories = await AppwriteService.getCategories(user.id);
      if (appwriteCategories.length > 0) {
        const localCategories = cached.filter(c => c.id.startsWith('local-'));
        const uniqueAppwriteCategories = appwriteCategories.filter(
          (ac) => !localCategories.some((lc) => lc.name.toLowerCase() === ac.name.toLowerCase())
        );
        const combinedCategories = [...uniqueAppwriteCategories, ...localCategories];

        setCategories(combinedCategories);
        await CacheService.setCategories(combinedCategories);
      } else if (cached.length === 0) {
        const defaultCats: Category[] = DEFAULT_CATEGORIES.map((dc, i) => ({
          ...dc,
          id: `local-default-${i}`,
          userId: user.id,
        }));
        setCategories(defaultCats);
        await CacheService.setCategories(defaultCats);
      }
    } catch (e) {
      console.warn('[VoiceScreen] Error syncing categories from Appwrite:', e);
      if (cached.length === 0) {
        const defaultCats: Category[] = DEFAULT_CATEGORIES.map((dc, i) => ({
          ...dc,
          id: `local-default-${i}`,
          userId: user.id,
        }));
        setCategories(defaultCats);
        await CacheService.setCategories(defaultCats);
      }
    }
  }, [user]);

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' = 'medium') => {
    try {
      if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(
          type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
          type === 'light' ? Haptics.ImpactFeedbackStyle.Light :
          Haptics.ImpactFeedbackStyle.Medium
        );
      }
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const performSaveExpense = async (
    amount: number,
    item: string,
    category: Category,
    isApprox: boolean,
    rawText: string
  ) => {
    if (!user) return;

    try {
      const expenseData = {
        userId: user.id,
        amount,
        isApproximate: isApprox,
        item,
        categoryId: category.id,
        rawVoice: rawText,
        date: new Date().toISOString(),
      };

      const result = await SyncService.perform(
        () => AppwriteService.createExpense(expenseData),
        {
          type: 'create',
          collection: 'expenses',
          id: `local-${Date.now()}`,
          data: expenseData,
          timestamp: Date.now(),
        }
      );

      const finalExpense = result || {
        ...expenseData,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      await CacheService.addExpense(finalExpense);

      triggerHaptic('success');

      if (preferences.voiceConfirmation) {
        Speech.speak(`Saved ${amount} ${DEFAULT_CURRENCY} for ${item}`, { rate: 1.0 });
      }

      setStatus('idle');
      setTranscript('');
      transcriptRef.current = '';
      setParsedExpense(null);
      setEditAmount('');
      setEditItem('');
      setSelectedCategory(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      triggerHaptic('heavy');
      setError('Failed to save. Please try again.');
    }
  };

  const processTranscript = async (text: string) => {
    isProcessingRef.current = true;
    setStatus('processing');
    try {
      const catNames = categoriesRef.current.map((c) => c.name);
      const parsed = await AIService.parseExpense(text, catNames);

      if (parsed) {
        const availableCats = categoriesRef.current.length > 0
          ? categoriesRef.current
          : DEFAULT_CATEGORIES.map((dc, i) => ({
              ...dc,
              id: `local-default-${i}`,
              userId: user?.id || '',
            }));
        const matchedCategory =
          availableCats.find((c) => c.name.toLowerCase() === parsed.category.toLowerCase()) ||
          availableCats[0] ||
          null;

        if (preferences.quickConfirm && parsed.parsedBy === 'local' && matchedCategory) {
          if (preferences.voiceConfirmation) {
            Speech.speak(`Auto saving ${parsed.amount} for ${parsed.item}`, { rate: 1.0 });
          }
          await performSaveExpense(
            parsed.amount,
            parsed.item,
            matchedCategory,
            parsed.isApproximate,
            text
          );
          return;
        }

        setParsedExpense(parsed);
        setEditAmount(String(parsed.amount));
        setEditItem(parsed.item);
        setSelectedCategory(matchedCategory);

        if (preferences.voiceConfirmation) {
          Speech.speak(`Parsed ${parsed.amount} ${DEFAULT_CURRENCY} for ${parsed.item}`, {
            rate: 1.0,
            pitch: 1.0,
          });
        }

        setStatus('parsed');
      } else {
        setError('Could not parse expense. Please try again or enter manually.');
        setStatus('idle');
      }
    } catch (err) {
      console.error('Error processing:', err);
      setError('Something went wrong. Please check your internet connection.');
      setStatus('idle');
    } finally {
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    if (status === 'recording') {
      waveAnimValues.forEach((wav, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(wav.height, {
              toValue: BAR_HEIGHTS[i] * 1.8,
              duration: 400 + (i * 30),
              useNativeDriver: false,
            }),
            Animated.timing(wav.height, {
              toValue: BAR_HEIGHTS[i],
              duration: 400 + (i * 30),
              useNativeDriver: false,
            }),
          ])
        ).start();
      });
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim.current, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim.current, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnimValues.forEach((wav) => wav.height.setValue(BAR_HEIGHTS[0]));
      pulseAnim.current.setValue(1);
    }
  }, [status, waveAnimValues]);

  const startListening = async () => {
    try {
      setTranscript('');
      transcriptRef.current = '';
      setParsedExpense(null);
      setError('');
      setPermissionDenied(false);

      const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permResult.granted) {
        setPermissionDenied(true);
        setError('Microphone permission denied. Please enable it in settings.');
        return;
      }

      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setError(
          Platform.OS === 'android'
            ? 'Speech recognition unavailable. Install/update the Google app from Play Store, or use a device with Google Play Services.'
            : 'Speech recognition is not available on this device.'
        );
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'en-IN',
        interimResults: true,
        continuous: true,
      });

      triggerHaptic('medium');
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        setPermissionDenied(true);
        setError('Microphone permission denied. Please enable it in settings.');
      } else {
        setError(
          Platform.OS === 'android'
            ? 'Speech recognition failed. Open Play Store → search "Google" → tap Update. Then restart the app.'
            : 'Failed to start speech recognition. Please try again.'
        );
      }
    }
  };

  const stopListening = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      triggerHaptic('light');

      const finalText = transcriptRef.current.trim();
      if (finalText) {
        processTranscript(finalText);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveExpense = async () => {
    if (!user) return;
    if (!selectedCategory) {
      setError('Please select a category before saving.');
      return;
    }

    const finalAmount = parseFloat(editAmount);
    if (isNaN(finalAmount)) {
      setError('Please enter a valid amount.');
      return;
    }

    await performSaveExpense(
      finalAmount,
      editItem,
      selectedCategory,
      parsedExpense?.isApproximate || false,
      transcript
    );
  };

  const cancel = async () => {
    ExpoSpeechRecognitionModule.abort();
    setStatus('idle');
    setTranscript('');
    transcriptRef.current = '';
    setParsedExpense(null);
    setEditAmount('');
    setEditItem('');
    setSelectedCategory(null);
    setError('');
  };

  const renderWaveform = () => {
    const bars = Array.from({ length: 20 }, (_, i) => i);

    return (
      <View style={styles.waveform}>
        {bars.map((bar) => (
          <Animated.View
            key={bar}
            style={[
              styles.waveformBar,
              {
                backgroundColor: theme.colors.primary,
                opacity: waveAnimValues[bar].opacity,
                height: status === 'recording'
                  ? waveAnimValues[bar].height
                  : BAR_HEIGHTS[bar],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.rootContainer}>
        <Text variant="h2" center style={styles.title}>
          {status === 'idle' && 'Tap to speak'}
          {status === 'recording' && 'Listening...'}
          {status === 'processing' && 'Processing...'}
          {status === 'parsed' && 'Review & Confirm'}
        </Text>

        <Spacer size="lg" />

        {renderWaveform()}

        <Spacer size="lg" />

        <View style={styles.contentArea}>
          {transcript ? (
            <Card>
              <Text variant="caption" color="textSecondary">
                You said:
              </Text>
              <Spacer size="sm" />
              <Text variant="body">"{transcript}"</Text>
            </Card>
          ) : null}

          {status === 'parsed' && (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
              <Spacer size="lg" />
              <Card>
                {parsedExpense?.parsedBy && (
                  <View style={styles.badgeRow}>
                    {parsedExpense.parsedBy === 'local' && (
                      <Text variant="caption" style={{ color: theme.colors.success, fontWeight: '600' }}>
                        ⚡ Parsed Locally (Instant & Offline)
                      </Text>
                    )}
                    {parsedExpense.parsedBy === 'google-ai' && (
                      <Text variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                        ✨ Parsed with Google AI
                      </Text>
                    )}
                    {parsedExpense.parsedBy === 'offline-fallback' && (
                      <Text variant="caption" style={{ color: theme.colors.warning, fontWeight: '600' }}>
                        🔌 Offline Best-Guess Parser
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.editRow}>
                  <View style={styles.amountContainer}>
                    <Text variant="caption" color="textSecondary">Amount</Text>
                    <Spacer size="xs" />
                    <Input
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      prefix={DEFAULT_CURRENCY}
                    />
                  </View>
                  <View style={styles.itemContainer}>
                    <Text variant="caption" color="textSecondary">What for?</Text>
                    <Spacer size="xs" />
                    <Input
                      value={editItem}
                      onChangeText={setEditItem}
                      placeholder="e.g. Coffee"
                    />
                  </View>
                </View>

                <Spacer size="md" />

                <Text variant="caption" color="textSecondary">Category</Text>
                <Spacer size="sm" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipContainer}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => {
                          setSelectedCategory(category);
                          triggerHaptic('light');
                        }}
                        style={styles.chipWrapper}
                      >
                        <Chip
                          selected={selectedCategory?.id === category.id}
                          color={`${category.color}20`}
                        >
                          {category.name}
                        </Chip>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </Card>

              <Spacer size="lg" />

              <Button onPress={saveExpense} size="lg">Confirm & Save</Button>
              <Spacer size="md" />
              <Button variant="ghost" onPress={cancel}>
                Discard
              </Button>
            </ScrollView>
          )}

          {error ? (
            <View>
              <Spacer size="lg" />
              <Card style={{ backgroundColor: `${theme.colors.error}10`, borderLeftWidth: 4, borderLeftColor: theme.colors.error }}>
                <Text variant="body" color="error" center>
                  {error}
                </Text>
                {permissionDenied && (
                  <>
                    <Spacer size="sm" />
                    <Text variant="caption" color="textSecondary" center>
                      Go to Settings → Privacy → Microphone to enable
                    </Text>
                  </>
                )}
              </Card>
              <Spacer size="md" />
              <Button variant="outline" onPress={cancel}>
                Try Again
              </Button>
            </View>
          ) : null}
        </View>

        <View style={styles.bottomArea}>
          {status === 'idle' && (
            <TouchableOpacity
              style={[styles.micButton, { backgroundColor: theme.colors.primary }]}
              onPress={startListening}
              accessibilityLabel="Start voice recording"
              accessibilityRole="button"
            >
              <Ionicons name="mic" size={36} color={theme.colors.white} />
            </TouchableOpacity>
          )}

          {status === 'recording' && (
            <TouchableOpacity
              style={[styles.micButton, { backgroundColor: theme.colors.error }]}
              onPress={stopListening}
              accessibilityLabel="Stop voice recording"
              accessibilityRole="button"
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim.current }] }}>
                <Ionicons name="stop" size={36} color={theme.colors.white} />
              </Animated.View>
            </TouchableOpacity>
          )}

          {status === 'processing' && (
            <View style={styles.processingContainer}>
              <Text variant="body" color="textSecondary">Processing with AI...</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rootContainer: {
    flex: 1,
    padding: 24,
  },
  title: {
    marginTop: 40,
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  bottomArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    gap: 4,
  },
  waveformBar: {
    width: 6,
    borderRadius: 3,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  amountContainer: {
    flex: 1,
    marginRight: 12,
  },
  itemContainer: {
    flex: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipWrapper: {
    marginBottom: 4,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
});
