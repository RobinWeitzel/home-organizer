import { KIND_LABELS } from '../model/store';
import type { FurnitureKind } from '../model/types';
import { IconClose, IconDoor, IconRoom, IconWindow, KIND_GLYPHS } from './icons';
import type { Tool } from './usePlanPointer';

const KINDS = Object.keys(KIND_LABELS) as FurnitureKind[];

/**
 * One-tap "add" menu: replaces the persistent tool bar. Picking an entry puts
 * the canvas into a temporary placement mode; it returns to select on success.
 */
export default function AddSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (tool: Exclude<Tool, 'select'>, kind?: FurnitureKind) => void;
}) {
  return (
    <>
      <div className="sheet-backdrop" onPointerDown={onClose} />
      <div className="sheet">
        <div className="sheet-header">
          <div className="sheet-title-static" style={{ flex: 1 }}>
            Add to plan
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="sheet-body">
          <div className="add-grid">
            <button className="add-tile" onClick={() => onPick('room')}>
              <IconRoom size={24} />
              <span>Room</span>
            </button>
            <button className="add-tile" onClick={() => onPick('door')}>
              <IconDoor size={24} />
              <span>Door</span>
            </button>
            <button className="add-tile" onClick={() => onPick('window')}>
              <IconWindow size={24} />
              <span>Window</span>
            </button>
          </div>
          <div className="add-section">Furniture</div>
          <div className="add-grid">
            {KINDS.map((k) => {
              const Glyph = KIND_GLYPHS[k];
              return (
                <button key={k} className="add-tile" onClick={() => onPick('furniture', k)}>
                  <Glyph size={24} />
                  <span>{KIND_LABELS[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
