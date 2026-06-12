import type { AppData } from './types';

/**
 * Three-way sync decision between the device copy (localStorage), the remote
 * copy, and a snapshot of the last state both sides agreed on. All inputs are
 * canonical JSON strings (compact `JSON.stringify` of validated AppData), so
 * equality means "same data".
 */
export type SyncAction =
  /** both sides already agree and the marker is current */
  | 'noop'
  /** both sides agree; just record the new common state */
  | 'markSynced'
  /** only this device changed (or the remote is empty) — upload */
  | 'push'
  /** only the remote changed (or this device is empty) — download */
  | 'pull'
  /** both sides changed independently — the user must choose */
  | 'conflict';

export interface SyncInput {
  localJson: string;
  /** null when no remote document exists yet */
  remoteJson: string | null;
  /** null before the first successful sync on this device */
  lastSyncedJson: string | null;
  localEmpty: boolean;
  remoteEmpty: boolean;
}

export function isEmptyData(data: AppData): boolean {
  return (
    data.floors.length === 0 &&
    data.rooms.length === 0 &&
    data.wallItems.length === 0 &&
    data.furniture.length === 0 &&
    data.areas.length === 0 &&
    data.items.length === 0
  );
}

export function planSync({ localJson, remoteJson, lastSyncedJson, localEmpty, remoteEmpty }: SyncInput): SyncAction {
  if (remoteJson === localJson) {
    return lastSyncedJson === localJson ? 'noop' : 'markSynced';
  }
  if (remoteJson === null) return 'push';
  const localChanged = localJson !== lastSyncedJson;
  const remoteChanged = remoteJson !== lastSyncedJson;
  if (remoteChanged && !localChanged) return 'pull';
  if (localChanged && !remoteChanged) return 'push';
  // Both diverged — also the shape of a first sync where both sides hold data.
  // A side with nothing in it has nothing to lose, so don't bother the user.
  if (localEmpty) return 'pull';
  if (remoteEmpty) return 'push';
  return 'conflict';
}
