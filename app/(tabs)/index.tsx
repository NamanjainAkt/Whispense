// app/(tabs)/index.tsx - Home Dashboard
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, Button } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import type { Expense, User } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userData, setUserData] = useState<User | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load from cache first for instant UI
    const cachedExpenses = await CacheService.getExpenses();
    const cachedUser = await CacheService.getUser();
    setExpenses(cachedExpenses);
    setUserData(cachedUser);

    // Sync from Appwrite in background
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [freshExpenses, freshUserData, freshCategories] = await Promise.all([
        AppwriteService.getExpenses(
          user.id,
          startOfMonth.toISOString(),
          new Date().toISOString()
        ),
        AppwriteService.getUser(user.id),
        AppwriteService.getCategories(user.id),
      ]);

      setExpenses(freshExpenses);
      if (freshUserData) {
        setUserData(freshUserData);
        await CacheService.setUser(freshUserData);
      }
      if (freshCategories.length > 0) {
        await CacheService.setCategories(freshCategories);
      }
      await CacheService.setExpenses(freshExpenses);
      await CacheService.setLastSync(Date.now());
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyBudget = userData?.monthlyBudget ?? 30000;
  const remaining = monthlyBudget - totalSpent;
  const percentUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  const firstName = user?.name?.split(' ')[0] || 'User';
  const todayExpenses = expenses.filter((e) => {
    const expenseDate = new Date(e.date);
    const today = new Date();
    return (
      expenseDate.getDate() === today.getDate() &&
      expenseDate.getMonth() === today.getMonth() &&
      expenseDate.getFullYear() === today.getFullYear()
    );
  });
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text variant="caption" color="textSecondary">
            Good morning,
          </Text>
          <Text variant="h2">{firstName}</Text>
        </View>
        {user?.name ? (
          <View
            style={[styles.avatar, { borderColor: theme.colors.border, backgroundColor: theme.colors.primaryLight }]}
          >
            <Text variant="caption" color="primary">
              {user.name[0]?.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      <Spacer size="lg" />

      {/* Budget Card */}
      <Card shadow="medium">
        <Text variant="caption" color="textSecondary">
          Monthly Budget
        </Text>
        <Spacer size="sm" />
        <Text variant="h1" color={percentUsed > 100 ? 'error' : 'text'}>
          {DEFAULT_CURRENCY}{totalSpent.toLocaleString()}
          <Text variant="body" color="textMuted">
            {' / '}{DEFAULT_CURRENCY}{monthlyBudget.toLocaleString()}
          </Text>
        </Text>
        <Spacer size="md" />
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor:
                  percentUsed > 90
                    ? theme.colors.error
                    : percentUsed > 75
                    ? theme.colors.warning
                    : theme.colors.primary,
              },
            ]}
          />
        </View>
        <Spacer size="sm" />
        <Text variant="caption" color="textSecondary">
          {DEFAULT_CURRENCY}{remaining.toLocaleString()} remaining
        </Text>
      </Card>

      <Spacer size="lg" />

      {/* Today's Spending */}
      <Card>
        <Text variant="caption" color="textSecondary">
          Today's Spending
        </Text>
        <Spacer size="sm" />
        <Text variant="h2" color="expense">
          {DEFAULT_CURRENCY}{todayTotal.toLocaleString()}
        </Text>
        <Text variant="caption" color="textMuted">
          {todayExpenses.length} transaction{todayExpenses.length !== 1 ? 's' : ''}
        </Text>
      </Card>

      <Spacer size="lg" />

      {/* Recent Expenses */}
      <View style={styles.sectionHeader}>
        <Text variant="h3">Recent Expenses</Text>
        <Button variant="ghost" size="sm">
          See all
        </Button>
      </View>

      <Spacer size="md" />

      {expenses.slice(0, 5).map((expense) => (
        <View key={expense.id} style={styles.expenseRow}>
          <View style={styles.expenseInfo}>
            <Text variant="body">{expense.item}</Text>
            <Text variant="caption" color="textMuted">
              {new Date(expense.date).toLocaleDateString()}
            </Text>
          </View>
          <Text variant="body" color="expense">
            {expense.isApproximate && '~'}
            {DEFAULT_CURRENCY}{expense.amount.toLocaleString()}
          </Text>
        </View>
      ))}

      {expenses.length === 0 && (
        <View style={styles.emptyState}>
          <Text variant="body" color="textMuted" center>
            No expenses yet. Tap the mic button to add one!
          </Text>
        </View>
      )}

      <Spacer size="xxl" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  expenseInfo: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: 40,
  },
});
