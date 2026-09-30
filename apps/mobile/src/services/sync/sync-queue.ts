import { getSyncRepository } from './sync-repository';
import { logger } from '../../utils/logger';

export async function enqueueSyncOperation(options: {
    entityType: 'deck' | 'card';
    entityId: string;
    operation: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    userId?: string | null;
}): Promise<void> {
    const syncRepo = getSyncRepository();
    const result = await syncRepo.enqueueOperation(
        options.entityType,
        options.entityId,
        options.operation,
        options.data,
        options.userId ?? null
    );

    if (result.isErr()) {
        logger.error('[Sync] Failed to queue operation:', result.error.message);
    } else {
        logger.debug('[Sync] Queued operation:', options.entityType, options.operation, options.entityId);
    }
}
