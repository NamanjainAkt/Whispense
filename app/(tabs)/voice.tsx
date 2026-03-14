// app/(tabs)/voice.tsx - Voice Logging Screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Button, Card, Spacer, Chip, Input } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { GeminiService } from '../../src/services/gemini';
import { AppwriteService } from '../../src/services/appwrite';
import { CacheService } from '../../src/services/cache';
import AudioService from '../../src/services/audio';
import SyncService from '../../src/services/sync';
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

  // Editable fields for Quick Edit
  const [editAmount, setEditAmount] = useState('');
  const [editItem, setEditItem] = useState('');

  useEffect(() => {
    loadCategories();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const granted = await AudioService.requestPermissions();
    if (!granted) {
      setError('Microphone permission is required to use voice logging.');
    }
  };

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
      const granted = await AudioService.requestPermissions();
      if (!granted) {
        setError('Microphone permission denied.');
        return;
      }
      setError('');
      setStatus('recording');
      await AudioService.startRecording();
    } catch (err) {
      console.error('Start recording error:', err);
      setError('Failed to start recording. Ensure you are on a real device or a compatible emulator.');
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    setStatus('processing');

    try {
      const { base64 } = await AudioService.stopRecording();
      
      if (!base64) {
        setError('No audio captured. Please try again.');
        setStatus('idle');
        return;
      }

      // 1. Transcribe
      const transcribedText = await GeminiService.transcribeAudio(base64);
      setTranscript(transcribedText);

      if (transcribedText === 'Could not transcribe') {
        setError('Could not understand the audio. Please speak clearly.');
        setStatus('idle');
        return;
      }

      // 2. Parse
      const catNames = categories.map((c) => c.name);
      const parsed = await GeminiService.parseExpense(transcribedText, catNames);

      if (parsed) {
        setParsedExpense(parsed);
        setEditAmount(String(parsed.amount));
        setEditItem(parsed.item);

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
      setError('Something went wrong. Please check your internet connection and try again.');
      setStatus('idle');
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
      await SyncService.perform(
        () => AppwriteService.createExpense(expenseData),
        {
          type: 'create',
          collection: 'expenses',
          id: `local-${Date.now()}`,
          data: expenseData,
          timestamp: Date.now(),
        }
      );

      await CacheService.addExpense({
        ...expenseData,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });

      setStatus('idle');
      setTranscript('');
      setParsedExpense(null);
      setEditAmount('');
      setEditItem('');
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

      {/* Parsed Result & Quick Edit */}
      {status === 'parsed' && (
        <>
          <Spacer size="lg" />
          <Card>
            <View style={styles.editRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text variant="caption" color="textSecondary">Amount</Text>
                <Input
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  prefix={DEFAULT_CURRENCY}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text variant="caption" color="textSecondary">What for?</Text>
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

          <Button onPress={saveExpense}>Confirm & Save</Button>
          <Spacer size="md" />
          <Button variant="ghost" onPress={cancel}>
            Discard
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
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
