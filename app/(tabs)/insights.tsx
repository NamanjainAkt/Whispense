// app/(tabs)/insights.tsx - Insights Screen
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer } from '../../src/components/ui';
import { OfflineIndicator } from '../../src/components/OfflineIndicator';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import { AIService } from '../../src/services/ai';
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

      // Preserve local categories
      const localCategories = cachedCategories.filter(c => c.id.startsWith('local-'));
      const uniqueAppwriteCategories = appwriteCategories.filter(
        (ac) => !localCategories.some((lc) => lc.name.toLowerCase() === ac.name.toLowerCase())
      );
      const combinedCategories = [...uniqueAppwriteCategories, ...localCategories];

      // Preserve local expenses
      const localExpenses = cachedExpenses.filter(e => e.id.startsWith('local-'));
      const combinedExpenses = [...appwriteExpenses, ...localExpenses];
      combinedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setExpenses(combinedExpenses);
      setCategories(combinedCategories);
      await CacheService.setExpenses(combinedExpenses);
      await CacheService.setCategories(combinedCategories);

      const insightsData = await AIService.generateInsights(combinedExpenses);
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
    color: (opacity = 1) => {
      // Robust hex to rgba conversion
      const hex = theme.colors.primary.replace('#', '');
      const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
      const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
      const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <OfflineIndicator />
        <ScrollView contentContainerStyle={styles.loadingContainer}>
          <Text variant="h3" style={styles.loadingTitle}>Generating insights...</Text>
          <Spacer size="lg" />
          <SkeletonCard />
          <Spacer size="lg" />
          <SkeletonChart />
          <Spacer size="lg" />
          <SkeletonChart />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Check if there's any expense data
  const hasExpenseData = expenses.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <OfflineIndicator />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
    </SafeAreaView>
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
  loadingContainer: {
    padding: 16,
    paddingTop: 40,
  },
  loadingTitle: {
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
});

// Skeleton loading components
function SkeletonCard() {
  const theme = useTheme();
  return (
    <View style={[styles.skeleton, { backgroundColor: theme.colors.shimmer }]}>
      <Card>
        <View style={[styles.skeleton, { backgroundColor: theme.colors.shimmer, height: 120, width: '100%' }]} />
      </Card>
    </View>
  );
}

function SkeletonChart() {
  const theme = useTheme();
  return (
    <View style={[styles.skeleton, { backgroundColor: theme.colors.shimmer, height: 200, width: '100%' }]} />
  );
}
