import NetInfo from '@react-native-community/netinfo';
import { CacheService, PendingOperation } from './cache';
import { AppwriteService } from './appwrite';

class SyncService {
  private isSyncing = false;

  constructor() {
    this.init();
  }

  private init() {
    // Defer initial sync to allow app to fully initialize
    setTimeout(() => this.processPendingSync(), 1000);

    // Listen for network changes
    NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processPendingSync();
      }
    });
  }

  async processPendingSync() {
    if (this.isSyncing) return;
    
    const pending = await CacheService.getPendingSync();
    if (pending.length === 0) return;

    this.isSyncing = true;
    console.log(`[SyncService] Processing ${pending.length} pending operations...`);

    const processedIds: string[] = [];
    const idMap: { [key: string]: string } = {};

    for (const op of pending) {
      try {
        // If this operation references a mapped local ID, update it
        if (op.id && idMap[op.id]) {
          op.id = idMap[op.id];
        }

        // If this operation references a mapped local category ID inside its data, update it
        if (op.collection === 'expenses' && op.data) {
          const expenseData = op.data as any;
          if (expenseData.categoryId && idMap[expenseData.categoryId]) {
            expenseData.categoryId = idMap[expenseData.categoryId];
          }
        }

        const serverId = await this.executeOperation(op);
        if (serverId && op.id.startsWith('local-')) {
          idMap[op.id] = serverId;
        }

        processedIds.push(`${op.timestamp}-${op.id}`);
      } catch (error) {
        console.error(`[SyncService] Failed to sync operation:`, op, error);
      }
    }

    // Only remove what we actually processed, but also update any IDs in remaining operations
    if (processedIds.length > 0) {
      const currentPending = await CacheService.getPendingSync();
      const filtered = currentPending.filter((op) => {
        const isProcessed = processedIds.some(
          (pId) => pId === `${op.timestamp}-${op.id}` || (idMap[op.id] && pId === `${op.timestamp}-${idMap[op.id]}`)
        );
        return !isProcessed;
      });

      // Update IDs in the remaining pending list
      const updatedRemaining = filtered.map((op) => {
        if (op.id && idMap[op.id]) {
          return { ...op, id: idMap[op.id] };
        }
        return op;
      });
      
      await CacheService.clearPendingSync();
      for (const op of updatedRemaining) {
        await CacheService.addToPendingSync(op);
      }
    }

    this.isSyncing = false;
    console.log('[SyncService] Sync completed.');
  }

  private async executeOperation(op: PendingOperation): Promise<string | null> {
    switch (op.collection) {
      case 'expenses':
        if (op.type === 'create') {
          const created = await AppwriteService.createExpense(op.data as any);
          if (op.id.startsWith('local-')) {
            // Replace local placeholder with real server document in cache
            await CacheService.deleteExpense(op.id);
            await CacheService.addExpense(created);
            return created.id;
          }
        } else if (op.type === 'update') {
          await AppwriteService.updateExpense(op.id, op.data as any);
        } else if (op.type === 'delete') {
          await AppwriteService.deleteExpense(op.id);
        }
        break;
      case 'categories':
        if (op.type === 'create') {
          const created = await AppwriteService.createCategory(op.data as any);
          if (op.id.startsWith('local-')) {
            // Replace local placeholder in cache
            const cached = await CacheService.getCategories();
            const updated = cached.map((c) => (c.id === op.id ? created : c));
            await CacheService.setCategories(updated);
            return created.id;
          }
        }
        break;
    }
    return null;
  }

  // Helper to wrap service calls with offline support
  async perform<T>(
    operation: () => Promise<T>,
    pendingOp: PendingOperation
  ): Promise<T | null> {
    const state = await NetInfo.fetch();
    
    if (state.isConnected && state.isInternetReachable) {
      try {
        return await operation();
      } catch (error) {
        console.warn('[SyncService] Operation failed online, adding to pending queue.', error);
        await CacheService.addToPendingSync(pendingOp);
        return null;
      }
    } else {
      console.log('[SyncService] Offline, adding to pending queue.');
      await CacheService.addToPendingSync(pendingOp);
      return null;
    }
  }
}

export default new SyncService();
