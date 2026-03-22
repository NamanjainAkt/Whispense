// app/(tabs)/voice.tsx - Voice Logging Screen
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Button, Card, Spacer, Chip, Input } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { AIService } from '../../src/services/ai';
import { AppwriteService } from '../../src/services/appwrite';
import { CacheService } from '../../src/services/cache';
import SyncService from '../../src/services/sync';
import type { Category, ParsedExpense } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

// Bar heights for waveform (memoized)
const BAR_HEIGHTS = Array.from({ length: 20 }, (_, i) => {
  // Create a nice wave pattern
  return 20 + Math.sin((i / 20) * Math.PI * 2) * 15 + Math.random() * 10;
});

export default function VoiceScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'parsed'>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Editable fields for Quick Edit
  const [editAmount, setEditAmount] = useState('');
  const [editItem, setEditItem] = useState('');

  // Animation refs - using useNativeDriver where possible
  const pulseAnim = useRef(new Animated.Value(1));
  const waveAnims = useRef(
    Array.from({ length: 20 }, () => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(0.6),
    }))
  ).current;

  // Haptic feedback helper
  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' = 'medium') => {
    try {
      if (Platform.OS === 'ios') {
        switch (type) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
        }
      } else {
        // Android: use impact feedback
        if (type === 'success') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    } catch (e) {
      // Haptics not available, fail silently
    }
  }, []);

  useEffect(() => {
    loadCategories();
    
    // Voice event listeners
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechStart = () => {
    setStatus('recording');
    setError('');
    triggerHaptic('light');
  };

  const onSpeechEnd = () => {
    // We don't set processing here yet because results might still be coming
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.error('onSpeechError: ', e);
    // Don't show error if user just didn't say anything
    if (e.error?.message?.includes('No match')) {
      setStatus('idle');
      return;
    }
    // Check for permission errors
    if (e.error?.message?.includes('permission') || e.error?.message?.includes('Permission')) {
      setPermissionDenied(true);
      setError('Microphone permission denied. Please enable it in settings.');
    } else {
      setError(e.error?.message || 'Speech recognition error');
    }
    setStatus('idle');
    triggerHaptic('heavy');
  };

  const onSpeechResults = async (e: SpeechResultsEvent) => {
    if (e.value && e.value.length > 0) {
      const result = e.value[0];
      setTranscript(result);
      await processTranscript(result);
    }
  };

  const processTranscript = async (text: string) => {
    setStatus('processing');
    try {
      const catNames = categories.map((c) => c.name);
      const parsed = await AIService.parseExpense(text, catNames);

      if (parsed) {
        setParsedExpense(parsed);
        setEditAmount(String(parsed.amount));
        setEditItem(parsed.item);

        const matchedCategory =
          categories.find((c) => c.name.toLowerCase() === parsed.category.toLowerCase()) ||
          categories[0] ||
          null;
        setSelectedCategory(matchedCategory);

        // Mobile built-in Text-to-Speech confirmation
        Speech.speak(`Parsed ${parsed.amount} ${DEFAULT_CURRENCY} for ${parsed.item}`, {
          rate: 1.0,
          pitch: 1.0,
        });

        setStatus('parsed');
      } else {
        setError('Could not parse expense. Please try again or enter manually.');
        setStatus('idle');
      }
    } catch (err) {
      console.error('Error processing:', err);
      setError('Something went wrong. Please check your internet connection.');
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (status === 'recording') {
      // Using scale animation with native driver for better performance
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
      pulseAnim.current.setValue(1);
    }
  }, [status]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    
    // Load from cache first for instant UI
    const cached = await CacheService.getCategories();
    if (cached.length > 0) {
      setCategories(cached);
    }

    // Try to sync from Appwrite
    try {
      const appwriteCategories = await AppwriteService.getCategories(user.id);
      if (appwriteCategories.length > 0) {
        setCategories(appwriteCategories);
        await CacheService.setCategories(appwriteCategories);
      }
    } catch (e) {
      console.warn('[VoiceScreen] Error syncing categories from Appwrite:', e);
    }
  }, [user]);

  const startListening = async () => {
    try {
      setTranscript('');
      setParsedExpense(null);
      setError('');
      setPermissionDenied(false);
      await Voice.start('en-IN'); // Support for Indian accent
      triggerHaptic('medium');
    } catch (e: unknown) {
      console.error(e);
      // Check for permission error
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        setPermissionDenied(true);
        setError('Microphone permission denied. Please enable it in settings.');
      } else {
        setError('Failed to start speech recognition.');
      }
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      triggerHaptic('light');
    } catch (e) {
      console.error(e);
    }
  };

  const saveExpense = async () => {
    if (!user || !selectedCategory) return;

    const finalAmount = parseFloat(editAmount);
    if (isNaN(finalAmount)) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      const expenseData = {
        userId: user.id,
        amount: finalAmount,
        isApproximate: parsedExpense?.isApproximate || false,
        item: editItem,
        categoryId: selectedCategory.id,
        rawVoice: transcript,
        date: new Date().toISOString(),
      };

      // Perform with offline-first support
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

      // If online success, result is the Appwrite document.
      const finalExpense = result || {
        ...expenseData,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      await CacheService.addExpense(finalExpense);

      // Success feedback
      triggerHaptic('success');
      
      // Confirmation TTS
      Speech.speak(`Saved ${finalAmount} ${DEFAULT_CURRENCY} for ${editItem}`, { rate: 1.0 });

      setStatus('idle');
      setTranscript('');
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

  const cancel = async () => {
    setStatus('idle');
    setTranscript('');
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
                opacity: 0.3 + (bar % 5) * 0.15,
                height:
                  status === 'recording'
                    ? pulseAnim.current.interpolate({
                        inputRange: [0.5, 1],
                        outputRange: [20, BAR_HEIGHTS[bar]],
                      })
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Text variant="h2" center style={styles.title}>
          {status === 'idle' && 'Tap to speak'}
          {status === 'recording' && 'Listening...'}
          {status === 'processing' && 'Processing...'}
          {status === 'parsed' && 'Review & Confirm'}
        </Text>

        <Spacer size="lg" />

        {/* Waveform */}
        {renderWaveform()}

        <Spacer size="lg" />

        {/* Transcript */}
        {transcript ? (
          <Card>
            <Text variant="caption" color="textSecondary">
              You said:
            </Text>
            <Spacer size="sm" />
            <Text variant="body">"{transcript}"</Text>
          </Card>
        ) : null}

        {/* Parsed Result & Quick Edit */}
        {status === 'parsed' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Spacer size="lg" />
            <Card>
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

        {/* Error */}
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

        {/* Main Action Button */}
        {status === 'idle' && (
          <TouchableOpacity
            style={[styles.micButton, { backgroundColor: theme.colors.primary }]}
            onPress={startListening}
            accessibilityLabel="Start voice recording"
            accessibilityRole="button"
          >
            <Text variant="h2" color="white">
              🎤
            </Text>
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
              <Text variant="h2" color="white">
                ⏹
              </Text>
            </Animated.View>
          </TouchableOpacity>
        )}

        {/* Processing indicator */}
        {status === 'processing' && (
          <View style={styles.processingContainer}>
            <Text variant="body" color="textSecondary">Processing with AI...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    marginTop: 40,
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
  parsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
