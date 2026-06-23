// app/(tabs)/expenses.tsx - Expenses List Screen
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';
import { Text, Card, Spacer, Chip, Input, BottomSheet, Button } from '../../src/components/ui';
import { OfflineIndicator } from '../../src/components/OfflineIndicator';
import { useAuth } from '../../src/context/AuthContext';
import { CacheService } from '../../src/services/cache';
import { AppwriteService } from '../../src/services/appwrite';
import SyncService from '../../src/services/sync';
import type { Expense, Category } from '../../src/types';
import { DEFAULT_CURRENCY } from '../../src/constants';
import { useFocusEffect } from 'expo-router';

export default function ExpensesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Show cached data immediately to avoid blank screen
    const cachedExpenses = await CacheService.getExpenses();
    const cachedCategories = await CacheService.getCategories();
    setExpenses(cachedExpenses);
    setCategories(cachedCategories);

    // Then sync fresh data from Appwrite
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

      // Preserve local categories that haven't synced yet
      const localCategories = cachedCategories.filter(c => c.id.startsWith('local-'));
      const uniqueAppwriteCategories = appwriteCategories.filter(
        (ac) => !localCategories.some((lc) => lc.name.toLowerCase() === ac.name.toLowerCase())
      );
      const combinedCategories = [...uniqueAppwriteCategories, ...localCategories];

      // Preserve local expenses that haven't synced yet
      const localExpenses = cachedExpenses.filter(e => e.id.startsWith('local-'));
      const combinedExpenses = [...appwriteExpenses, ...localExpenses];
      combinedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Update state and cache with fresh data
      setExpenses(combinedExpenses);
      setCategories(combinedCategories);
      await CacheService.setExpenses(combinedExpenses);
      await CacheService.setCategories(combinedCategories);
    } catch (error) {
      console.error('Error loading expenses:', error);
      // Keep showing cached data — no need to show error for background sync failure
    }
  }, [user, selectedMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const groupByDate = (expenseList: Expense[]) => {
    const groups: { [key: string]: Expense[] } = {};
    expenseList.forEach((expense) => {
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
      await SyncService.perform(
        () => AppwriteService.deleteExpense(expense.id),
        {
          type: 'delete',
          collection: 'expenses',
          id: expense.id,
          timestamp: Date.now(),
        }
      );
      
      await CacheService.deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      setShowEditSheet(false);
      setEditingExpense(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      Alert.alert('Error', 'Failed to delete expense. Please try again.');
    }
  };

  const handleSave = async (updates: Partial<Expense>) => {
    if (!editingExpense) return;

    if (editingExpense.id === '') {
      // Create mode
      try {
        const localId = `local-${Date.now()}`;
        const expenseData = {
          userId: user?.id || '',
          amount: updates.amount || 0,
          isApproximate: updates.isApproximate || false,
          item: updates.item || 'Unknown',
          categoryId: updates.categoryId || categories[0]?.id || '',
          date: new Date().toISOString(),
        };

        const result = await SyncService.perform(
          () => AppwriteService.createExpense(expenseData),
          {
            type: 'create',
            collection: 'expenses',
            id: localId,
            data: expenseData,
            timestamp: Date.now(),
          }
        );

        const finalExpense = result || {
          ...expenseData,
          id: localId,
          createdAt: new Date().toISOString(),
        };

        await CacheService.addExpense(finalExpense);
        setExpenses((prev) => [finalExpense, ...prev]);
        setShowEditSheet(false);
        setEditingExpense(null);
      } catch (error) {
        console.error('Error creating expense:', error);
        Alert.alert('Error', 'Failed to add expense. Please try again.');
      }
    } else {
      // Edit/Update mode
      try {
        const result = await SyncService.perform(
          () => AppwriteService.updateExpense(editingExpense.id, updates),
          {
            type: 'update',
            collection: 'expenses',
            id: editingExpense.id,
            data: updates,
            timestamp: Date.now(),
          }
        );

        const finalUpdated = result || { ...editingExpense, ...updates };
        await CacheService.updateExpense(editingExpense.id, finalUpdated);
        
        setExpenses((prev) =>
          prev.map((e) => (e.id === editingExpense.id ? finalUpdated : e))
        );
        
        setShowEditSheet(false);
        setEditingExpense(null);
      } catch (error) {
        console.error('Error updating expense:', error);
        Alert.alert('Error', 'Failed to update expense. Please try again.');
      }
    }
  };

  const handleCategoryCreated = (newCat: Category) => {
    setCategories((prev) => [...prev, newCat]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <OfflineIndicator />
      
      {/* Header Row with Add Button */}
      <View style={styles.headerRow}>
        <Text variant="h2">Expenses</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.8}
          onPress={() => {
            setEditingExpense({
              id: '', // Empty ID represents creating
              userId: user?.id || '',
              amount: 0,
              isApproximate: false,
              item: '',
              categoryId: categories[0]?.id || '',
              date: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            });
            setShowEditSheet(true);
          }}
        >
          <Ionicons name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

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
              onPress={() => setSelectedMonth(new Date(date))}
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
      <ScrollView style={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                          {expense.rawVoice ? (
                            <Text variant="caption" color="textMuted" numberOfLines={1}>
                              "{expense.rawVoice}"
                            </Text>
                          ) : null}
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

        {filteredExpenses.length === 0 && (
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
          onSave={handleSave}
          onDelete={handleDelete}
          onCategoryCreated={handleCategoryCreated}
        />
      )}
    </SafeAreaView>
  );
}

function EditExpenseSheet({
  visible,
  onClose,
  expense,
  categories,
  onSave,
  onDelete,
  onCategoryCreated,
}: {
  visible: boolean;
  onClose: () => void;
  expense: Expense;
  categories: Category[];
  onSave: (updates: Partial<Expense>) => void;
  onDelete: (expense: Expense) => void;
  onCategoryCreated: (category: Category) => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState(String(expense.amount || ''));
  const [item, setItem] = useState(expense.item || '');
  const [categoryId, setCategoryId] = useState(expense.categoryId || '');
  const [isApproximate, setIsApproximate] = useState(expense.isApproximate || false);

  // Category creation state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366F1');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const lastExpenseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastExpenseIdRef.current !== expense.id) {
      lastExpenseIdRef.current = expense.id;
      setAmount(expense.amount ? String(expense.amount) : '');
      setItem(expense.item || '');
      setCategoryId(expense.categoryId || (categories[0]?.id || ''));
      setIsApproximate(expense.isApproximate || false);
      setShowAddCategory(false);
    }
  }, [expense, categories]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCategory(true);
    try {
      const localCatId = `local-${Date.now()}`;
      const catData = {
        userId: user?.id || expense.userId || '',
        name: newCatName.trim(),
        icon: 'folder',
        color: newCatColor,
        isCustom: true,
      };

      const result = await SyncService.perform(
        () => AppwriteService.createCategory(catData),
        {
          type: 'create',
          collection: 'categories',
          id: localCatId,
          data: catData,
          timestamp: Date.now(),
        }
      );

      const finalCategory = result || {
        ...catData,
        id: localCatId,
      };

      // Add to local cache
      const cached = await CacheService.getCategories();
      const updated = [...cached, finalCategory];
      await CacheService.setCategories(updated);

      // Trigger categories reload in parent
      onCategoryCreated(finalCategory);

      // Select it automatically
      setCategoryId(finalCategory.id);
      
      // Reset state
      setNewCatName('');
      setShowAddCategory(false);
    } catch (err) {
      console.error('Failed to create category:', err);
      Alert.alert('Error', 'Failed to create category. Please try again.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const isCreateMode = expense.id === '';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="h3">{isCreateMode ? 'Add Expense' : 'Edit Expense'}</Text>
      <Spacer size="lg" />

      <Text variant="caption" color="textSecondary">Amount</Text>
      <Spacer size="sm" />
      <Input
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0.00"
      />

      <Spacer size="md" />

      <Text variant="caption" color="textSecondary">Item</Text>
      <Spacer size="sm" />
      <Input value={item} onChangeText={setItem} placeholder="e.g. Coffee" />

      <Spacer size="md" />

      <Text variant="caption" color="textSecondary">Category</Text>
      <Spacer size="sm" />
      <View style={[styles.chipContainer, { marginBottom: 12 }]}>
        {categories.map((category) => (
          <TouchableOpacity key={category.id} onPress={() => setCategoryId(category.id)}>
            <Chip selected={categoryId === category.id} color={`${category.color}20`}>
              {category.name}
            </Chip>
          </TouchableOpacity>
        ))}

        {showAddCategory ? (
          <View style={styles.categoryCreatorContainer}>
            <Text variant="label" style={{ fontWeight: '600' }}>New Category</Text>
            <Spacer size="sm" />
            <Input
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="e.g. Shopping"
            />
            <Spacer size="sm" />
            <Text variant="caption" color="textSecondary">Color</Text>
            <View style={styles.colorSelectorRow}>
              {['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newCatColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewCatColor(color)}
                />
              ))}
            </View>
            <Spacer size="md" />
            <View style={styles.creatorActionRow}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => setShowAddCategory(false)}>
                Cancel
              </Button>
              <Spacer size="sm" />
              <Button style={{ flex: 1 }} onPress={handleCreateCategory} loading={creatingCategory}>
                Create
              </Button>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowAddCategory(true)}>
            <Chip selected={false} color="#F3F4F6">
              + Custom
            </Chip>
          </TouchableOpacity>
        )}
      </View>

      <Spacer size="lg" />

      <Button
        onPress={() => {
          onSave({
            amount: parseFloat(amount) || 0,
            item,
            categoryId,
            isApproximate,
          });
        }}
      >
        {isCreateMode ? 'Add Expense' : 'Save Changes'}
      </Button>

      {!isCreateMode && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Delete Expense',
              'Are you sure you want to delete this expense?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(expense) }
              ]
            );
          }}
          style={{
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
          }}
        >
          <Text variant="label" style={{ color: theme.colors.error, fontWeight: '600' }}>
            Delete Expense
          </Text>
        </TouchableOpacity>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  categoryCreatorContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    width: '100%',
  },
  colorSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#000000',
  },
  creatorActionRow: {
    flexDirection: 'row',
  },
});
