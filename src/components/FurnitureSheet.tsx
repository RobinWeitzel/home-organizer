import { useEffect, useMemo, useRef, useState } from 'react';
import { columnsKind, groupAreas, sortAreas } from '../model/areaLayout';
import { KIND_LABELS, useApp } from '../model/store';
import type { Item, StorageArea } from '../model/types';
import ConfirmDialog from './ConfirmDialog';
import FurnitureFront from './FurnitureFront';
import {
  IconChevronDown, IconClose, IconMinus, IconNote,
  IconPencil, IconPlus, IconTrash,
} from './icons';
import { usePrompt } from './PromptDialog';
import { groupOptions, useAreaOptions } from './useAreaOptions';

function MoveItemSelect({ item }: { item: Item }) {
  const options = useAreaOptions();
  const updateItem = useApp((s) => s.updateItem);
  const groups = useMemo(() => groupOptions(options), [options]);
  return (
    <select
      className="input"
      value={item.areaId}
      onChange={(e) => updateItem(item.id, { areaId: e.target.value })}
      aria-label="Move item to"
    >
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
  );
}

function ItemRow({
  item,
  expanded,
  onToggle,
  flash,
}: {
  item: Item;
  expanded: boolean;
  onToggle: () => void;
  flash: boolean;
}) {
  const { updateItem, deleteItem } = useApp.getState();
  const ref = useRef<HTMLDivElement>(null);
  // a searched item may sit deep in a long list — bring it into view
  useEffect(() => {
    if (flash) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [flash]);

  if (!expanded) {
    return (
      <div
        ref={ref}
        className={flash ? 'item-li item-flash' : 'item-li'}
        onClick={onToggle}
        role="button"
        aria-label={`Edit ${item.name}`}
      >
        <span className="item-li-name">{item.name}</span>
        {item.notes && <IconNote size={13} className="item-li-note" />}
        <span className="item-li-qty">{item.quantity > 1 ? `×${item.quantity}` : ''}</span>
      </div>
    );
  }
  return (
    <div ref={ref} className="item-editor">
      <div className="item-editor-row">
        <input
          className="input"
          value={item.name}
          onChange={(e) => updateItem(item.id, { name: e.target.value })}
          aria-label="Item name"
        />
        <button className="icon-btn" onClick={onToggle} aria-label="Collapse item">
          <IconChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
      <div className="item-editor-row">
        <span className="qty">
          <button
            className="icon-btn"
            onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
            aria-label="Decrease quantity"
          >
            <IconMinus size={16} />
          </button>
          ×{item.quantity}
          <button
            className="icon-btn"
            onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
            aria-label="Increase quantity"
          >
            <IconPlus size={16} />
          </button>
        </span>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => deleteItem(item.id)} aria-label={`Delete ${item.name}`}>
          <IconTrash size={17} />
        </button>
      </div>
      <input
        className="input"
        placeholder="Notes (colour, size, box label…)"
        value={item.notes}
        onChange={(e) => updateItem(item.id, { notes: e.target.value })}
      />
      <div className="form-row">
        <label className="form-label">Move to</label>
        <MoveItemSelect item={item} />
      </div>
    </div>
  );
}

/** Items of the selected storage area: add on top, a dense scannable list below. */
function AreaItems({ area, highlightItemId }: { area: StorageArea; highlightItemId: string | null }) {
  const allItems = useApp((s) => s.data.items);
  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.areaId === area.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allItems, area.id],
  );
  const addItem = useApp((s) => s.addItem);
  const [newItem, setNewItem] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const submitNewItem = () => {
    if (newItem.trim()) {
      addItem(area.id, newItem.trim());
      setNewItem('');
    }
  };

  return (
    <div className="area-panel">
      <div className="area-panel-header">
        <span className="area-panel-title">{area.name}</span>
        <span className="area-panel-count">
          {items.length === 0 ? 'empty' : `${items.length} item${items.length === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="area-panel-add">
        <IconPlus size={15} />
        <input
          value={newItem}
          placeholder={`Add to ${area.name.toLowerCase()}…`}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitNewItem()}
          aria-label={`Add item to ${area.name}`}
        />
        {newItem.trim() && (
          <button className="btn btn-small btn-primary" onClick={submitNewItem}>
            Add
          </button>
        )}
      </div>
      {items.map((i) => (
        <ItemRow
          key={i.id}
          item={i}
          expanded={expandedId === i.id}
          onToggle={() => setExpandedId(expandedId === i.id ? null : i.id)}
          flash={i.id === highlightItemId}
        />
      ))}
    </div>
  );
}

/** One name row of the area editor; selection stays in step with the picture. */
function AreaEditRow({
  area,
  newGroup,
  selected,
  onSelect,
  onDelete,
}: {
  area: StorageArea;
  newGroup: boolean;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { renameArea } = useApp.getState();
  const ref = useRef<HTMLDivElement>(null);
  // selecting a compartment in the picture brings its name row into view
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  return (
    <div
      ref={ref}
      className={[
        'area-edit-row',
        newGroup ? 'area-edit-newgroup' : '',
        selected ? 'area-edit-selected' : '',
      ].join(' ')}
      onClick={onSelect}
    >
      <input
        className="input"
        value={area.name}
        onChange={(e) => renameArea(area.id, e.target.value)}
        onFocus={onSelect}
        aria-label="Area name"
      />
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${area.name}`}>
        <IconTrash size={17} />
      </button>
    </div>
  );
}

/**
 * Rename / delete areas — tucked behind the sheet's edit toggle. Arranging
 * happens by dragging the compartments in the front view above; the list
 * mirrors its structure (a hairline starts each row/column of the face) and
 * shares its selection.
 */
function AreaEditor({
  areas,
  selectedAreaId,
  onSelect,
}: {
  areas: StorageArea[];
  selectedAreaId: string | null;
  onSelect: (id: string) => void;
}) {
  const [confirmAreaId, setConfirmAreaId] = useState<string | null>(null);
  const confirmArea = areas.find((a) => a.id === confirmAreaId);
  const countItems = useApp((s) => s.data.items);
  const itemsIn = (areaId: string) => countItems.filter((i) => i.areaId === areaId).length;
  const grouped = groupAreas(areas);
  return (
    <div>
      {grouped.map((members, gi) =>
        members.map((a) => (
          <AreaEditRow
            key={a.id}
            area={a}
            newGroup={a.order === 0 && gi > 0}
            selected={a.id === selectedAreaId}
            onSelect={() => onSelect(a.id)}
            onDelete={() => setConfirmAreaId(a.id)}
          />
        )),
      )}
      <ConfirmDialog
        open={confirmAreaId !== null}
        title={`Delete "${confirmArea?.name ?? ''}"?`}
        message={`This deletes the storage area and the ${confirmAreaId ? itemsIn(confirmAreaId) : 0} item(s) inside. This cannot be undone.`}
        onConfirm={() => {
          if (confirmAreaId) useApp.getState().deleteArea(confirmAreaId);
          setConfirmAreaId(null);
        }}
        onCancel={() => setConfirmAreaId(null)}
      />
    </div>
  );
}

export default function FurnitureSheet({ furnitureId }: { furnitureId: string }) {
  const furniture = useApp((s) => s.data.furniture.find((f) => f.id === furnitureId));
  const allAreas = useApp((s) => s.data.areas);
  const allItems = useApp((s) => s.data.items);
  const highlightAreaId = useApp((s) => s.highlightAreaId);
  const highlightItemId = useApp((s) => s.highlightItemId);
  const areas = useMemo(
    () => sortAreas(allAreas.filter((a) => a.furnitureId === furnitureId)),
    [allAreas, furnitureId],
  );
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of allItems) m.set(i.areaId, (m.get(i.areaId) ?? 0) + 1);
    return m;
  }, [allItems]);
  const { setOpenFurniture, updateFurniture, deleteFurniture, addArea, countItemsInFurniture } = useApp.getState();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(highlightAreaId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { ask, dialog } = usePrompt();

  // a search reveal retargets the open sheet to the found area
  useEffect(() => {
    if (highlightAreaId) setSelectedAreaId(highlightAreaId);
  }, [highlightAreaId]);

  if (!furniture) return null;

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? areas[0] ?? null;

  return (
    <>
      {/* pointerdown, not click: a synthesized click from whatever gesture
          opened the sheet must not immediately close it */}
      <div className="sheet-backdrop" onPointerDown={() => setOpenFurniture(null)} />
      <div className="sheet">
        <div className="sheet-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="sheet-title"
              value={furniture.name}
              onChange={(e) => updateFurniture(furniture.id, { name: e.target.value })}
              aria-label="Furniture name"
            />
            <div className="sheet-kind">{KIND_LABELS[furniture.kind]}</div>
          </div>
          <button
            className={`icon-btn ${editing ? 'icon-btn-active' : ''}`}
            onClick={() => setEditing(!editing)}
            aria-label="Edit storage areas"
          >
            <IconPencil size={17} />
          </button>
          <button className="icon-btn" onClick={() => setOpenFurniture(null)} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="sheet-body">
          <div className="front-wrap">
            <FurnitureFront
              furniture={furniture}
              areas={areas}
              selectedAreaId={selectedArea?.id ?? null}
              highlightAreaId={highlightAreaId}
              counts={counts}
              onSelect={setSelectedAreaId}
              editable={editing}
              onPlace={(id, placement) => useApp.getState().placeArea(id, placement)}
            />
          </div>
          {areas.length === 0 && (
            <p className="front-empty">No storage areas yet — add one to start putting things in.</p>
          )}
          {editing ? (
            <>
              {areas.length > 1 && (
                <p className="front-hint">
                  Drag a compartment in the picture to move it: drop it on a{' '}
                  {columnsKind(furniture.kind) ? 'column to share that column, or between columns' : 'row to share that row, or between rows'}{' '}
                  to make a new one.
                </p>
              )}
              <AreaEditor
                areas={areas}
                selectedAreaId={selectedArea?.id ?? null}
                onSelect={setSelectedAreaId}
              />
              <button
                className="btn"
                style={{ marginTop: 12, width: '100%' }}
                onClick={async () => {
                  const name = await ask('Area name', `Area ${areas.length + 1}`);
                  if (name) addArea(furniture.id, name);
                }}
              >
                <IconPlus size={16} /> Add storage area
              </button>
              <button
                className="btn btn-danger"
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => setConfirmDelete(true)}
              >
                <IconTrash size={16} /> Delete furniture
              </button>
            </>
          ) : (
            selectedArea && <AreaItems area={selectedArea} highlightItemId={highlightItemId} />
          )}
        </div>
      </div>
      {dialog}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${furniture.name}"?`}
        message={`This deletes the furniture, its ${areas.length} storage area(s) and ${countItemsInFurniture(
          furniture.id,
        )} item(s). This cannot be undone.`}
        onConfirm={() => deleteFurniture(furniture.id)}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
