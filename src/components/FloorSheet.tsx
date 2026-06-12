import { useState } from 'react';
import { useApp } from '../model/store';
import ConfirmDialog from './ConfirmDialog';
import { IconCheck, IconClose, IconPencil, IconPlus, IconTrash } from './icons';
import { usePrompt } from './PromptDialog';

/** Floor switcher + management, opened from the floating floor pill. */
export default function FloorSheet({ onClose }: { onClose: () => void }) {
  const floors = useApp((s) => s.data.floors);
  const currentFloorId = useApp((s) => s.currentFloorId);
  const { addFloor, renameFloor, deleteFloor, setCurrentFloor, countItemsInFloor } = useApp.getState();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { ask, dialog } = usePrompt();

  const sorted = [...floors].sort((a, b) => a.order - b.order);
  const pendingDelete = floors.find((f) => f.id === deleteId);

  const promptAdd = async () => {
    const name = await ask('Floor name', floors.length === 0 ? 'Ground floor' : `Floor ${floors.length + 1}`);
    if (name) addFloor(name);
  };

  const promptRename = async (id: string, current: string) => {
    const name = await ask('Rename floor', current);
    if (name) renameFloor(id, name);
  };

  return (
    <>
      <div className="sheet-backdrop" onPointerDown={onClose} />
      <div className="sheet">
        <div className="sheet-header">
          <div className="sheet-title-static" style={{ flex: 1 }}>
            Floors
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="sheet-body">
          {sorted.map((f) => {
            const active = f.id === currentFloorId;
            return (
              <div key={f.id} className={`floor-row ${active ? 'floor-row-active' : ''}`}>
                <button
                  className="floor-row-main"
                  onClick={() => {
                    setCurrentFloor(f.id);
                    onClose();
                  }}
                >
                  <span className="floor-row-check">{active && <IconCheck size={16} />}</span>
                  {f.name}
                </button>
                <button className="icon-btn" onClick={() => promptRename(f.id, f.name)} aria-label={`Rename ${f.name}`}>
                  <IconPencil size={16} />
                </button>
                <button className="icon-btn" onClick={() => setDeleteId(f.id)} aria-label={`Delete ${f.name}`}>
                  <IconTrash size={16} />
                </button>
              </div>
            );
          })}
          <button className="btn add-floor-btn" onClick={promptAdd}>
            <IconPlus size={16} /> Add floor
          </button>
        </div>
      </div>
      {dialog}
      <ConfirmDialog
        open={deleteId !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message={`This deletes the floor with all its rooms, furniture and ${
          pendingDelete ? countItemsInFloor(pendingDelete.id) : 0
        } item(s). This cannot be undone.`}
        onConfirm={() => {
          if (deleteId) deleteFloor(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
