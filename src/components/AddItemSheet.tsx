import { useMemo, useState } from 'react';
import { useApp } from '../model/store';
import { IconClose, IconMinus, IconPlus } from './icons';
import { groupOptions, useAreaOptions } from './useAreaOptions';

export default function AddItemSheet({
  initialName,
  lastAreaId,
  onClose,
  onAdded,
}: {
  initialName: string;
  lastAreaId: string | null;
  onClose: () => void;
  onAdded: (areaId: string) => void;
}) {
  const options = useAreaOptions();
  const addItem = useApp((s) => s.addItem);
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState(1);
  const [areaId, setAreaId] = useState(
    lastAreaId && options.some((o) => o.areaId === lastAreaId) ? lastAreaId : (options[0]?.areaId ?? ''),
  );
  const [addedCount, setAddedCount] = useState(0);

  const groups = useMemo(() => groupOptions(options), [options]);

  const submit = () => {
    if (!name.trim() || !areaId) return;
    addItem(areaId, name.trim(), quantity);
    onAdded(areaId);
    setName('');
    setQuantity(1);
    setAddedCount(addedCount + 1);
  };

  return (
    <>
      <div className="sheet-backdrop" onPointerDown={onClose} />
      <div className="sheet">
        <div className="sheet-header">
          <div style={{ flex: 1 }}>
            <div className="sheet-title-static">Add item</div>
            {addedCount > 0 && <div className="sheet-kind">{addedCount} added</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="sheet-body">
          {options.length === 0 ? (
            <div className="add-item-empty">
              <p>You need a place to put things first. Draw a room on the plan and add storage furniture to it.</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  const store = useApp.getState();
                  store.setTab('plan');
                  store.setPlanEditing(true);
                }}
              >
                Edit the plan
              </button>
            </div>
          ) : (
            <div className="add-item-form">
              <input
                className="input"
                placeholder="What is it? e.g. Winter gloves"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              <div className="form-row">
                <label className="form-label">Where</label>
                <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  {groups.map(([label, opts]) => (
                    <optgroup key={label} label={label}>
                      {opts.map((o) => (
                        <option key={o.areaId} value={o.areaId}>
                          {o.areaName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Quantity</label>
                <span className="qty">
                  <button className="icon-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">
                    <IconMinus size={16} />
                  </button>
                  ×{quantity}
                  <button className="icon-btn" onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity">
                    <IconPlus size={16} />
                  </button>
                </span>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={onClose}>
                  Done
                </button>
                <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
                  Add item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
