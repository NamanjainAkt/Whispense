// app/(tabs)/profile.tsx - Profile & Settings Screen
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Share,
} from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, Button, Input } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import type { User } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user: authUser, appwriteUser, logout } = useAuth();
  const [user, setUser] = React.useState<User | null>(null);
  const [budget, setBudget] = React.useState(String(user?.monthlyBudget || 30000));
  const [threshold, setThreshold] = React.useState(user?.alertThreshold || 80);
  const [voiceConfirmation, setVoiceConfirmation] = useState(true);
  const [quickConfirm, setQuickConfirm] = useState(false);

  React.useEffect(() => {
    CacheService.getUser().then(setUser);
  }, []);

  React.useEffect(() => {
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
        monthlyBudget: parseInt(budget) || 30000,
        alertThreshold: threshold,
      });
      setUser(updated);
      await CacheService.setUser(updated);
      Alert.alert('Success', 'Settings saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleExportCSV = async () => {
    const expenses = await CacheService.getExpenses();

    if (expenses.length === 0) {
      Alert.alert('No Data', 'No expenses to export');
      return;
    }

    const csvContent = [
      'Date,Item,Amount,Category,Is Approximate',
      ...expenses.map(
        (e) =>
          `${e.date},"${e.item}",${e.amount},"${e.categoryId}",${e.isApproximate}`
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

  const handleLogout = async () => {
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

  const [totalExpenses, setTotalExpenses] = React.useState(0);

  React.useEffect(() => {
    CacheService.getExpenses().then(expenses => setTotalExpenses(expenses.length));
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
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
              {appwriteUser?.fullName?.[0] || appwriteUser?.firstName?.[0] || 'U'}
            </Text>
          </View>
          <Spacer size="md" />
          <Text variant="h2">{appwriteUser?.fullName || appwriteUser?.firstName || 'User'}</Text>
          <Text variant="caption" color="textSecondary">
            {appwriteUser?.primaryEmailAddress?.emailAddress}
          </Text>
        </View>

        <Spacer size="lg" />
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text variant="h3">{totalExpenses}</Text>
            <Text variant="caption" color="textSecondary">Expenses Logged</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="h3">{formatDate(user?.createdAt)}</Text>
            <Text variant="caption" color="textSecondary">Member Since</Text>
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
        <View style={styles.sliderRow}>
          <Text variant="caption">50%</Text>
          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((threshold - 50) / 50) * 100}%`,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>
          <Text variant="caption">100%</Text>
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
            onValueChange={setVoiceConfirmation}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
            thumbColor={voiceConfirmation ? theme.colors.primary : theme.colors.textMuted}
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
            onValueChange={setQuickConfirm}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
            thumbColor={quickConfirm ? theme.colors.primary : theme.colors.textMuted}
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

      <Button variant="ghost" onPress={handleLogout}>
        Sign Out
      </Button>

      <Spacer size="xxl" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
