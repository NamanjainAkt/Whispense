import NetInfo from '@react-native-community/netinfo';
import { CacheService, PendingOperation } from './cache';
import { AppwriteService } from './appwrite';

class SyncService {
  private isSyncing = false;

  constructor() {
    this.init();
  }

  private init() {
    // Check initial state
    this.processPendingSync();

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

    for (const op of pending) {
      try {
        await this.executeOperation(op);
        processedIds.push(`${op.timestamp}-${op.id}`);
      } catch (error) {
        console.error(`[SyncService] Failed to sync operation:`, op, error);
        
        // If it's a structural error (like the "Unknown attribute" we saw earlier), 
        // we might want to drop it after a few retries.
        // For now, we'll keep it to retry later on network change.
      }
    }

    // Only remove what we actually processed
    if (processedIds.length > 0) {
      const currentPending = await CacheService.getPendingSync();
      const filtered = currentPending.filter(
        (op) => !processedIds.includes(`${op.timestamp}-${op.id}`)
      );
      
      await CacheService.clearPendingSync();
      for (const op of filtered) {
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
