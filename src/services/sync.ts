import NetInfo from '@react-native-community/netinfo';
import { CacheService, PendingOperation } from './cache';
import { AppwriteService } from './appwrite';

class SyncService {
  private isSyncing = false;

  constructor() {
    this.init();
  }

  private init() {
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

    const remaining: PendingOperation[] = [];

    for (const op of pending) {
      try {
        await this.executeOperation(op);
      } catch (error) {
        console.error(`[SyncService] Failed to sync operation:`, op, error);
        // Keep in queue if it's a network error, otherwise drop or handle specifically
        remaining.push(op);
      }
    }

    await CacheService.clearPendingSync();
    if (remaining.length > 0) {
      for (const op of remaining) {
        await CacheService.addToPendingSync(op);
      }
    }

    this.isSyncing = false;
    console.log('[SyncService] Sync completed.');
  }

  private async executeOperation(op: PendingOperation) {
    switch (op.collection) {
      case 'expenses':
        if (op.type === 'create') {
          await AppwriteService.createExpense(op.data as any);
        } else if (op.type === 'update') {
          await AppwriteService.updateExpense(op.id, op.data as any);
        } else if (op.type === 'delete') {
          await AppwriteService.deleteExpense(op.id);
        }
        break;
      // Add other collections as needed (e.g., categories)
    }
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
