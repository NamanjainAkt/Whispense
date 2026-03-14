// app/(tabs)/insights.tsx - Insights Screen
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, ProgressBar } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import { GeminiService } from '../../src/services/gemini';
import type { Expense, Category } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';
import { BarChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

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

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const cachedExpenses = await CacheService.getExpenses();
    const cachedCategories = await CacheService.getCategories();
    const cachedInsights = await CacheService.getInsightsCache();

    setExpenses(cachedExpenses);
    setCategories(cachedCategories);

    if (cachedInsights && Date.now() - cachedInsights.timestamp < 24 * 60 * 60 * 1000) {
      setInsights(cachedInsights.data as InsightsData);
      setLoading(false);
      return;
    }

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

      const insightsData = await GeminiService.generateInsights(appwriteExpenses);
      setInsights(insightsData);
      await CacheService.setInsightsCache(insightsData);
    } catch (error) {
      console.error('Error loading insights:', error);
      if (!insights) {
        setInsights({
          healthScore: 50,
          suggestions: ['Continue logging expenses regularly to get personalized insights'],
          patterns: { peakDays: [], timeOfDay: {}, frequency: {} },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartConfig = {
    backgroundColor: theme.colors.background,
    backgroundGradientFrom: theme.colors.background,
    backgroundGradientTo: theme.colors.background,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${parseInt(theme.colors.primary.slice(1, 3), 16)}, ${parseInt(theme.colors.primary.slice(3, 5), 16)}, ${parseInt(theme.colors.primary.slice(5, 7), 16)}, ${opacity})`,
    labelColor: (opacity = 1) => theme.colors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const dailySpendingData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dailyTotals = last7Days.map(date => {
      return expenses
        .filter(e => e.date.startsWith(date))
        .reduce((sum, e) => sum + e.amount, 0);
    });

    return {
      labels: last7Days.map(d => d.slice(8, 10)), // Day numbers
      datasets: [{ data: dailyTotals }],
    };
  }, [expenses]);

  const pieChartData = useMemo(() => {
    const spending: { [key: string]: number } = {};
    expenses.forEach((expense) => {
      const category = categories.find((c) => c.id === expense.categoryId);
      if (category) {
        spending[category.name] = (spending[category.name] || 0) + expense.amount;
      }
    });

    return Object.entries(spending).map(([name, amount]) => {
      const category = categories.find(c => c.name === name);
      return {
        name,
        population: amount,
        color: category?.color || theme.colors.primary,
        legendFontColor: theme.colors.textSecondary,
        legendFontSize: 12,
      };
    });
  }, [expenses, categories, theme.colors.primary, theme.colors.textSecondary]);

  const getHealthScoreColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score <= 40) return 'error';
    if (score <= 70) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="body" color="textSecondary">
          Generating insights...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              { borderColor: theme.colors[getHealthScoreColor(insights?.healthScore ?? 0)] },
            ]}
          >
            <Text variant="h1" color={getHealthScoreColor(insights?.healthScore ?? 0)}>
              {insights?.healthScore ?? '--'}
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

      {/* Daily Spending Trend */}
      <Text variant="h3">Spending Trend (Last 7 Days)</Text>
      <Spacer size="sm" />
      <BarChart
        data={dailySpendingData}
        width={screenWidth - 32}
        height={220}
        yAxisLabel={DEFAULT_CURRENCY}
        yAxisSuffix=""
        chartConfig={chartConfig}
        verticalLabelRotation={0}
        fromZero
        style={{ marginVertical: 8, borderRadius: 16 }}
      />

      <Spacer size="lg" />

      {/* Category Distribution */}
      <Text variant="h3">Category Distribution</Text>
      <Spacer size="sm" />
      {pieChartData.length > 0 ? (
        <PieChart
          data={pieChartData}
          width={screenWidth - 32}
          height={200}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      ) : (
        <Text variant="body" color="textMuted">No data for chart</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
