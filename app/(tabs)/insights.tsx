// app/(tabs)/insights.tsx - Insights Screen
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, ProgressBar } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import { GeminiService } from '../../src/services/gemini';
import type { Expense, Category } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';

interface InsightsData {
  healthScore: number;
  suggestions: string[];
  patterns: {
    peakDays: string[];
    timeOfDay: { [key: string]: number };
    frequency: { [key: string]: number };
  };
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    // Load from cache
    const cachedExpenses = await CacheService.getExpenses();
    const cachedCategories = await CacheService.getCategories();
    const cachedInsights = await CacheService.getInsightsCache();

    setExpenses(cachedExpenses);
    setCategories(cachedCategories);

    if (cachedInsights && Date.now() - cachedInsights.timestamp < 24 * 60 * 60 * 1000) {
      setInsights(cachedInsights.data as InsightsData);
      setLoading(false);
    }

    // Sync from Appwrite
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [appwriteExpenses, appwriteCategories] = await Promise.all([
        AppwriteService.getExpenses(
          user.id,
          startOfMonth.toISOString(),
          new Date().toISOString()
        ),
        AppwriteService.getCategories(user.id),
      ]);

      setExpenses(appwriteExpenses);
      setCategories(appwriteCategories);
      await CacheService.setExpenses(appwriteExpenses);
      await CacheService.setCategories(appwriteCategories);

      // Generate insights via Gemini
      const insightsData = await GeminiService.generateInsights(appwriteExpenses);
      setInsights(insightsData);
      await CacheService.setInsightsCache(insightsData);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategorySpending = () => {
    const spending: { [key: string]: number } = {};
    expenses.forEach((expense) => {
      const category = categories.find((c) => c.id === expense.categoryId);
      if (category) {
        spending[category.name] = (spending[category.name] || 0) + expense.amount;
      }
    });
    return spending;
  };

  const categorySpending = getCategorySpending();
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const getHealthScoreColor = (score: number) => {
    if (score <= 40) return 'error';
    if (score <= 70) return 'warning';
    return 'success';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Financial Health Score */}
      <Card shadow="medium">
        <Text variant="caption" color="textSecondary" center>
          Financial Health Score
        </Text>
        <Spacer size="md" />
        <View style={styles.scoreContainer}>
          <View
            style={[
              styles.scoreCircle,
              {
                borderColor:
                  theme.colors[
                    getHealthScoreColor(insights?.healthScore || 0)
                  ],
              },
            ]}
          >
            <Text variant="h1" color={getHealthScoreColor(insights?.healthScore || 0)}>
              {insights?.healthScore || '--'}
            </Text>
          </View>
        </View>
        <Spacer size="md" />
        <Text variant="caption" color="textSecondary" center>
          {insights?.healthScore && insights.healthScore >= 71
            ? 'Great job managing your finances!'
            : insights?.healthScore && insights.healthScore >= 41
            ? 'Room for improvement'
            : 'Needs attention'}
        </Text>
      </Card>

      <Spacer size="lg" />

      {/* Category Breakdown */}
      <Text variant="h3">Category Breakdown</Text>
      <Spacer size="md" />

      {Object.entries(categorySpending)
        .sort(([, a], [, b]) => b - a)
        .map(([categoryName, amount]) => {
          const category = categories.find((c) => c.name === categoryName);
          const percentage = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;

          return (
            <View key={categoryName} style={styles.categoryRow}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: category?.color || theme.colors.textMuted },
                    ]}
                  />
                  <Text variant="body">{categoryName}</Text>
                </View>
                <Text variant="caption" color="textSecondary">
                  {DEFAULT_CURRENCY}{amount.toLocaleString()} ({percentage.toFixed(0)}%)
                </Text>
              </View>
              <Spacer size="sm" />
              <ProgressBar
                progress={percentage / 100}
                color={percentage > 50 ? 'error' : 'primary'}
              />
            </View>
          );
        })}

      {Object.keys(categorySpending).length === 0 && (
        <Text variant="body" color="textMuted">
          No expenses recorded yet
        </Text>
      )}

      <Spacer size="lg" />

      {/* AI Saving Suggestions */}
      <Text variant="h3">AI Saving Suggestions</Text>
      <Spacer size="md" />

      {insights?.suggestions.map((suggestion, index) => (
        <Card key={index} style={[styles.suggestionCard, { borderLeftColor: theme.colors.accent }]}>
          <Text variant="body">{suggestion}</Text>
        </Card>
      ))}

      {(!insights?.suggestions || insights.suggestions.length === 0) && (
        <Text variant="body" color="textMuted">
          Keep logging expenses to get personalized suggestions
        </Text>
      )}

      <Spacer size="lg" />

      {/* Spending Patterns */}
      <Text variant="h3">Spending Patterns</Text>
      <Spacer size="md" />

      {insights?.patterns && (
        <Card>
          {insights.patterns.peakDays.length > 0 && (
            <>
              <Text variant="caption" color="textSecondary">Peak Spending Days</Text>
              <Text variant="body">{insights.patterns.peakDays.join(', ')}</Text>
              <Spacer size="md" />
            </>
          )}

          {Object.keys(insights.patterns.frequency).length > 0 && (
            <>
              <Text variant="caption" color="textSecondary">Frequent Categories</Text>
              {Object.entries(insights.patterns.frequency).map(([category, count]) => (
                <Text key={category} variant="body">
                  • {category}: {Number(count).toFixed(1)}x per week
                </Text>
              ))}
            </>
          )}
        </Card>
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
  scoreContainer: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  suggestionCard: {
    marginBottom: 8,
    borderLeftWidth: 4,
  },
});
