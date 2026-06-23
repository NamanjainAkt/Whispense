// app/(tabs)/profile.tsx - Profile & Settings Screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Share,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, Button, Input, Chip } from '../../src/components/ui';
import { OfflineIndicator } from '../../src/components/OfflineIndicator';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import type { User } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';

export default function ProfileScreen() {
  const theme = useTheme();
  // authUser = our DB user, appwriteUser = Appwrite account object
  const { user: authUser, appwriteUser, logout } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  // Fix stale closure: initialise budget/threshold from authUser if available,
  // otherwise default. A separate useEffect syncs them when authUser arrives.
  const [budget, setBudget] = useState('30000');
  const [threshold, setThreshold] = useState(80);
  const [voiceConfirmation, setVoiceConfirmation] = useState(true);
  const [quickConfirm, setQuickConfirm] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Haptic feedback helper
  const triggerHaptic = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      // Haptics not available, fail silently
    }
  }, []);

  // Load user from cache on mount
  useEffect(() => {
    CacheService.getUser().then((cached) => {
      if (cached) {
        setUser(cached);
        setBudget(String(cached.monthlyBudget));
        setThreshold(cached.alertThreshold);
      }
    });
    CacheService.getExpenses().then((expenses) => setTotalExpenses(expenses.length));
    CacheService.getPreferences().then((prefs) => {
      setVoiceConfirmation(prefs.voiceConfirmation);
      setQuickConfirm(prefs.quickConfirm);
    });
  }, []);

  const handleToggleVoiceConfirmation = async (value: boolean) => {
    setVoiceConfirmation(value);
    triggerHaptic();
    await CacheService.setPreferences({
      voiceConfirmation: value,
      quickConfirm,
    });
  };

  const handleToggleQuickConfirm = async (value: boolean) => {
    setQuickConfirm(value);
    triggerHaptic();
    await CacheService.setPreferences({
      voiceConfirmation,
      quickConfirm: value,
    });
  };

  // Sync when authUser becomes available (overrides cached values with fresh data)
  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      setBudget(String(authUser.monthlyBudget));
      setThreshold(authUser.alertThreshold);
    }
  }, [authUser]);

  const handleSaveBudget = async () => {
    if (!user) return;

    try {
      const updated = await AppwriteService.updateUser(user.id, {
        monthlyBudget: parseInt(budget, 10) || 30000,
        alertThreshold: threshold,
      });
      setUser(updated);
      await CacheService.setUser(updated);
      Alert.alert('Success', 'Settings saved');
    } catch {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleExportCSV = async () => {
    const expenses = await CacheService.getExpenses();
    const categories = await CacheService.getCategories();

    if (expenses.length === 0) {
      Alert.alert('No Data', 'No expenses to export');
      return;
    }

    const getCategoryName = (id: string) => {
      const cat = categories.find(c => c.id === id);
      return cat?.name || 'Other';
    };

    const csvContent = [
      'Date,Item,Amount,Category,Is Approximate',
      ...expenses.map(
        (e) =>
          `${e.date},"${e.item}",${e.amount},"${getCategoryName(e.categoryId)}",${e.isApproximate}`
      ),
    ].join('\n');

    try {
      await Share.share({
        message: csvContent,
        title: 'Whispense Export',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Appwrite Models.User has `name` and `email` — not fullName/firstName/primaryEmailAddress
  const displayName = appwriteUser?.name || user?.name || 'User';
  const displayEmail = appwriteUser?.email || user?.email || '';
  const avatarLetter = displayName[0]?.toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <OfflineIndicator />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <Card shadow="medium">
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.primaryLight },
              ]}
            >
              <Text variant="h2" color="primary">
                {avatarLetter}
              </Text>
            </View>
            <Spacer size="md" />
            <Text variant="h2">{displayName}</Text>
            <Text variant="caption" color="textSecondary">
              {displayEmail}
            </Text>
          </View>

        <Spacer size="lg" />
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text variant="h3">{totalExpenses}</Text>
            <Text variant="caption" color="textSecondary">Expenses Logged</Text>
          </View>
        </View>
      </Card>

      <Spacer size="lg" />

      {/* Budget Settings */}
      <Text variant="h3">Budget Settings</Text>
      <Spacer size="md" />

      <Card>
        <Text variant="caption" color="textSecondary">Monthly Budget</Text>
        <Spacer size="sm" />
        <Input
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          placeholder={`${DEFAULT_CURRENCY}30,000`}
        />

        <Spacer size="lg" />

        <Text variant="caption" color="textSecondary">
          Alert Threshold ({threshold}%)
        </Text>
        <Spacer size="sm" />
        <View style={styles.thresholdChipsContainer}>
          {[50, 60, 75, 90, 100].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setThreshold(t);
                triggerHaptic();
              }}
              style={styles.thresholdChipWrapper}
            >
              <Chip selected={threshold === t}>
                {`${t}%`}
              </Chip>
            </TouchableOpacity>
          ))}
        </View>
        <Spacer size="md" />
        <Button size="sm" onPress={handleSaveBudget}>
          Save Settings
        </Button>
      </Card>

      <Spacer size="lg" />

      {/* Preferences */}
      <Text variant="h3">Preferences</Text>
      <Spacer size="md" />

      <Card>
        <View style={styles.preferenceRow}>
          <View>
            <Text variant="body">Voice Confirmation</Text>
            <Text variant="caption" color="textSecondary">
              Play back voice after recording
            </Text>
          </View>
          <Switch
            value={voiceConfirmation}
            onValueChange={handleToggleVoiceConfirmation}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
            thumbColor={voiceConfirmation ? theme.colors.primary : theme.colors.textMuted}
            accessibilityLabel="Toggle voice confirmation"
          />
        </View>
        <View style={[styles.preferenceRow, { marginTop: 16 }]}>
          <View>
            <Text variant="body">Quick Auto-Confirm</Text>
            <Text variant="caption" color="textSecondary">
              Auto-save when AI confidence &gt; 95%
            </Text>
          </View>
          <Switch
            value={quickConfirm}
            onValueChange={handleToggleQuickConfirm}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
            thumbColor={quickConfirm ? theme.colors.primary : theme.colors.textMuted}
            accessibilityLabel="Toggle quick auto-confirm"
          />
        </View>
      </Card>

      <Spacer size="lg" />

      {/* Data */}
      <Text variant="h3">Data</Text>
      <Spacer size="md" />

      <Card>
        <Button variant="outline" onPress={handleExportCSV}>
          Export CSV
        </Button>
      </Card>

      <Spacer size="lg" />

      {/* Account */}
      <Text variant="h3">Account</Text>
      <Spacer size="md" />

      <TouchableOpacity
        style={[styles.swissLogoutButton, { backgroundColor: theme.colors.error }]}
        activeOpacity={0.8}
        onPress={handleLogout}
      >
        <Text style={[styles.swissLogoutButtonText, { color: theme.colors.white }]}>SIGN OUT</Text>
      </TouchableOpacity>

      <Spacer size="xxl" />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thresholdChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  thresholdChipWrapper: {
    marginBottom: 4,
  },
  swissLogoutButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 0,
  },
  swissLogoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'HelveticaNeue-CondensedBold', android: 'sans-serif-condensed', default: 'System' }),
  },
});
