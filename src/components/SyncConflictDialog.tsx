import { hideConflict, resolveConflict, useSync } from '../model/remoteSync';
import type { AppData } from '../model/types';

function summary(data: AppData): string {
  return `${data.items.length} item(s) · ${data.furniture.length} furniture · ${data.floors.length} floor(s)`;
}

/**
 * Shown when this device and the synced copy were both changed while apart
 * and there is no safe way to merge them. Closing the backdrop postpones the
 * decision (sync pauses); Settings offers a way to reopen it.
 */
export default function SyncConflictDialog() {
  const conflict = useSync((s) => s.conflict);
  const hidden = useSync((s) => s.conflictHidden);
  if (!conflict || hidden) return null;
  return (
    <div className="modal-backdrop" onClick={hideConflict}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Sync conflict</h3>
        <p>
          Your home was changed both on this device and elsewhere, and the two versions can’t be
          combined. Choose which one to keep — the other is overwritten.
        </p>
        <div className="conflict-options">
          <button className="btn" onClick={() => void resolveConflict('local')}>
            <span>Keep this device</span>
            <span className="conflict-meta">{summary(conflict.local)}</span>
          </button>
          <button className="btn" onClick={() => void resolveConflict('remote')}>
            <span>Keep synced copy</span>
            <span className="conflict-meta">{summary(conflict.remote)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
