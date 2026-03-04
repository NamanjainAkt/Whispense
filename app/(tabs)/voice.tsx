// app/(tabs)/voice.tsx - Voice Logging Screen
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
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
  const animationRef = useRef<Animated.Value>(new Animated.Value(0)).current;

  const loadCategories = async () => {
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
  };

  const startRecording = async () => {
    try {
      setError('');
      setStatus('recording');
      setTranscript('');
      setParsedExpense(null);
      await loadCategories();

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      // Start speech recognition
      Speech.stop();
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
        await recordingRef.current.stopAndUnloadAsync();
      }

      // Simulate STT and AI parsing for now
      // In production, this would use actual speech-to-text
      const mockTranscript = 'I spent 150 rupees on chai and snacks';
      setTranscript(mockTranscript);

      // Call Gemini to parse
      const parsed = await GeminiService.parseExpense(mockTranscript, categories.map(c => c.name));

      if (parsed) {
        setParsedExpense(parsed);

        // Find matching category
        const matchedCategory = categories.find(
          c => c.name.toLowerCase() === parsed.category.toLowerCase()
        ) || categories[0];
        setSelectedCategory(matchedCategory || null);

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

      // Reset
      setStatus('idle');
      setTranscript('');
      setParsedExpense(null);
      setSelectedCategory(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      setError('Failed to save. Please try again.');
    }
  };

  const cancel = () => {
    setStatus('idle');
    setTranscript('');
    setParsedExpense(null);
    setSelectedCategory(null);
    setError('');
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync();
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
                height: status === 'recording'
                  ? animationRef.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 60 + Math.random() * 40],
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
      {transcript && (
        <Card>
          <Text variant="caption" color="textSecondary">
            Transcript
          </Text>
          <Spacer size="sm" />
          <Text variant="body">{transcript}</Text>
        </Card>
      )}

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
      {error && (
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
      )}

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
