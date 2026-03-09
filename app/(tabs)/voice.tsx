// app/(tabs)/voice.tsx - Voice Logging Screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Button, Card, Spacer, Chip } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { GeminiService } from '../../src/services/gemini';
import { AppwriteService } from '../../src/services/appwrite';
import { CacheService } from '../../src/services/cache';
import type { Category, ParsedExpense } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';

export default function VoiceScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'parsed'>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  // Correct: keep Animated.Value in a ref, don't call .current immediately
  const pulseAnim = useRef(new Animated.Value(0));

  // Pre-compute stable bar heights once (avoids Math.random in render)
  const barHeights = useRef<number[]>(
    Array.from({ length: 20 }, () => 20 + Math.random() * 40)
  );

  // Pulse animation loop while recording
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'recording') {
      pulseAnim.current.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim.current, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim.current, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.current.setValue(0);
    }
    return () => {
      animation?.stop();
    };
  }, [status]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    const cached = await CacheService.getCategories();
    if (cached.length > 0) {
      setCategories(cached);
    } else {
      try {
        const appwriteCategories = await AppwriteService.getCategories(user.id);
        setCategories(appwriteCategories);
        await CacheService.setCategories(appwriteCategories);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    }
  }, [user]);

  const startRecording = async () => {
    try {
      setError('');
      setStatus('recording');
      setTranscript('');
      setParsedExpense(null);
      await loadCategories();

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied. Please allow access in Settings.');
        setStatus('idle');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Could not start recording. Please try again.');
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    setStatus('processing');

    try {
      if (recordingRef.current) {
        // Correctly awaiting stopAndUnloadAsync
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      // TODO: Integrate a real speech-to-text service here.
      // Currently using a placeholder transcript for development/testing.
      const mockTranscript = 'I spent 150 rupees on chai and snacks';
      setTranscript(mockTranscript);

      const catNames = categories.map((c) => c.name);
      const parsed = await GeminiService.parseExpense(mockTranscript, catNames);

      if (parsed) {
        setParsedExpense(parsed);

        const matchedCategory =
          categories.find((c) => c.name.toLowerCase() === parsed.category.toLowerCase()) ||
          categories[0] ||
          null;
        setSelectedCategory(matchedCategory);

        setStatus('parsed');
      } else {
        setError('Could not parse expense. Please try again or enter manually.');
        setStatus('idle');
      }
    } catch (err) {
      console.error('Error processing:', err);
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  const saveExpense = async () => {
    if (!user || !parsedExpense || !selectedCategory) return;

    try {
      const expense = await AppwriteService.createExpense({
        userId: user.id,
        amount: parsedExpense.amount,
        isApproximate: parsedExpense.isApproximate,
        item: parsedExpense.item,
        categoryId: selectedCategory.id,
        rawVoice: transcript,
        date: new Date().toISOString(),
      });

      await CacheService.addExpense(expense);

      setStatus('idle');
      setTranscript('');
      setParsedExpense(null);
      setSelectedCategory(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      setError('Failed to save. Please try again.');
    }
  };

  const cancel = async () => {
    setStatus('idle');
    setTranscript('');
    setParsedExpense(null);
    setSelectedCategory(null);
    setError('');
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Already stopped — ignore
      }
      recordingRef.current = null;
    }
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
                // Use pre-computed stable heights, animated by pulseAnim
                height:
                  status === 'recording'
                    ? pulseAnim.current.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, barHeights.current[bar]],
                      })
                    : 20,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="h2" center>
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
            Transcript
          </Text>
          <Spacer size="sm" />
          <Text variant="body">{transcript}</Text>
        </Card>
      ) : null}

      {/* Parsed Result */}
      {status === 'parsed' && parsedExpense && (
        <>
          <Spacer size="lg" />
          <Card>
            <View style={styles.parsedRow}>
              <Text variant="caption" color="textSecondary">Amount</Text>
              <Text variant="h2" color="expense">
                {parsedExpense.isApproximate && '~'}
                {DEFAULT_CURRENCY}{parsedExpense.amount}
              </Text>
            </View>

            <Spacer size="md" />

            <View style={styles.parsedRow}>
              <Text variant="caption" color="textSecondary">Item</Text>
              <Text variant="body">{parsedExpense.item}</Text>
            </View>

            <Spacer size="md" />

            <Text variant="caption" color="textSecondary">Category</Text>
            <Spacer size="sm" />
            <View style={styles.chipContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category)}
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
          </Card>

          <Spacer size="lg" />

          <Button onPress={saveExpense}>Confirm</Button>
          <Spacer size="md" />
          <Button variant="ghost" onPress={cancel}>
            Cancel
          </Button>
        </>
      )}

      {/* Error */}
      {error ? (
        <>
          <Spacer size="lg" />
          <Text variant="body" color="error" center>
            {error}
          </Text>
          <Spacer size="md" />
          <Button variant="ghost" onPress={cancel}>
            Try Again
          </Button>
        </>
      ) : null}

      {/* Main Action Button */}
      {status === 'idle' && (
        <TouchableOpacity
          style={[styles.micButton, { backgroundColor: theme.colors.primary }]}
          onPress={startRecording}
        >
          <Text variant="h2" color="white">
            🎤
          </Text>
        </TouchableOpacity>
      )}

      {status === 'recording' && (
        <TouchableOpacity
          style={[styles.micButton, { backgroundColor: theme.colors.error }]}
          onPress={stopRecording}
        >
          <Text variant="h2" color="white">
            ⏹
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});
