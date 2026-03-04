// app/(tabs)/expenses.tsx - Expenses List Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, Chip, Input, BottomSheet, Button } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import type { Expense, Category } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ExpensesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);

  useEffect(() => {
    loadData();
  }, [user, selectedMonth, selectedCategory]);

  const loadData = async () => {
    if (!user) return;

    // Load from cache
    const cachedExpenses = CacheService.getExpenses();
    const cachedCategories = CacheService.getCategories();
    setExpenses(cachedExpenses);
    setCategories(cachedCategories);

    // Sync from Appwrite
    try {
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

      const [appwriteExpenses, appwriteCategories] = await Promise.all([
        AppwriteService.getExpenses(
          user.id,
          startOfMonth.toISOString(),
          endOfMonth.toISOString()
        ),
        AppwriteService.getCategories(user.id),
      ]);

      setExpenses(appwriteExpenses);
      setCategories(appwriteCategories);
      CacheService.setExpenses(appwriteExpenses);
      CacheService.setCategories(appwriteCategories);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const groupByDate = (expenses: Expense[]) => {
    const groups: { [key: string]: Expense[] } = {};
    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(expense);
    });
    return groups;
  };

  const filteredExpenses = selectedCategory
    ? expenses.filter((e) => e.categoryId === selectedCategory)
    : expenses;

  const groupedExpenses = groupByDate(filteredExpenses);

  const handleDelete = async (expense: Expense) => {
    try {
      await AppwriteService.deleteExpense(expense.id);
      CacheService.deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleUpdate = async (updates: Partial<Expense>) => {
    if (!editingExpense) return;

    try {
      const updated = await AppwriteService.updateExpense(editingExpense.id, updates);
      CacheService.updateExpense(editingExpense.id, updated);
      setExpenses((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e))
      );
      setShowEditSheet(false);
      setEditingExpense(null);
    } catch (error) {
      console.error('Error updating expense:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Month Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        {Array.from({ length: 12 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const isSelected =
            selectedMonth.getMonth() === date.getMonth() &&
            selectedMonth.getFullYear() === date.getFullYear();

          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedMonth(date)}
              style={styles.monthChip}
            >
              <Chip selected={isSelected}>
                {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </Chip>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.categoryChip}>
          <Chip selected={selectedCategory === null}>All</Chip>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => setSelectedCategory(category.id)}
            style={styles.categoryChip}
          >
            <Chip
              selected={selectedCategory === category.id}
              color={`${category.color}20`}
            >
              {category.name}
            </Chip>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Spacer size="md" />

      {/* Expenses List */}
      <ScrollView style={styles.list}>
        {Object.entries(groupedExpenses).map(([date, items]) => (
          <View key={date}>
            <Text variant="caption" color="textSecondary" style={styles.dateHeader}>
              {date}
            </Text>
            <Spacer size="sm" />
            {items.map((expense) => {
              const category = getCategoryById(expense.categoryId);
              return (
                <TouchableOpacity
                  key={expense.id}
                  onPress={() => {
                    setEditingExpense(expense);
                    setShowEditSheet(true);
                  }}
                >
                  <Card shadow="none" style={styles.expenseCard}>
                    <View style={styles.expenseRow}>
                      <View style={styles.expenseLeft}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: category?.color || theme.colors.textMuted },
                          ]}
                        />
                        <View>
                          <Text variant="body">{expense.item}</Text>
                          {expense.rawVoice && (
                            <Text variant="caption" color="textMuted" numberOfLines={1}>
                              "{expense.rawVoice}"
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text variant="body" color="expense">
                        {expense.isApproximate && '~'}
                        {DEFAULT_CURRENCY}{expense.amount.toLocaleString()}
                      </Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
            <Spacer size="md" />
          </View>
        ))}

        {expenses.length === 0 && (
          <View style={styles.emptyState}>
            <Text variant="body" color="textMuted" center>
              No expenses found for this period
            </Text>
          </View>
        )}

        <Spacer size="xxl" />
      </ScrollView>

      {/* Edit Bottom Sheet */}
      {editingExpense && (
        <EditExpenseSheet
          visible={showEditSheet}
          onClose={() => {
            setShowEditSheet(false);
            setEditingExpense(null);
          }}
          expense={editingExpense}
          categories={categories}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </View>
  );
}

function EditExpenseSheet({
  visible,
  onClose,
  expense,
  categories,
  onUpdate,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  expense: Expense;
  categories: Category[];
  onUpdate: (updates: Partial<Expense>) => void;
  onDelete: (expense: Expense) => void;
}) {
  const theme = useTheme();
  const [amount, setAmount] = useState(String(expense.amount));
  const [item, setItem] = useState(expense.item);
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [isApproximate, setIsApproximate] = useState(expense.isApproximate);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="h3">Edit Expense</Text>
      <Spacer size="lg" />

      <Text variant="caption" color="textSecondary">Amount</Text>
      <Spacer size="sm" />
      <Input
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <Spacer size="md" />

      <Text variant="caption" color="textSecondary">Item</Text>
      <Spacer size="sm" />
      <Input value={item} onChangeText={setItem} />

      <Spacer size="md" />

      <Text variant="caption" color="textSecondary">Category</Text>
      <Spacer size="sm" />
      <View style={styles.chipContainer}>
        {categories.map((category) => (
          <TouchableOpacity key={category.id} onPress={() => setCategoryId(category.id)}>
            <Chip selected={categoryId === category.id} color={`${category.color}20`}>
              {category.name}
            </Chip>
          </TouchableOpacity>
        ))}
      </View>

      <Spacer size="lg" />

      <Button
        onPress={() =>
          onUpdate({
            amount: parseFloat(amount) || 0,
            item,
            categoryId,
            isApproximate,
          })
        }
      >
        Save Changes
      </Button>

      <Spacer size="md" />

      <Button variant="ghost" onPress={() => onDelete(expense)}>
        Delete Expense
      </Button>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthScroll: {
    maxHeight: 50,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  monthChip: {
    marginRight: 8,
  },
  categoryScroll: {
    maxHeight: 50,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  categoryChip: {
    marginRight: 8,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateHeader: {
    marginTop: 16,
  },
  expenseCard: {
    marginBottom: 8,
    padding: 12,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyState: {
    paddingVertical: 60,
  },
});
