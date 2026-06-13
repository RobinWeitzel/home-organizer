import { useEffect, useRef, useState } from 'react';
import { rectInsideCells } from '../model/cells';
import { flatProjection, isoProjection, WALL_H, makeIsoProjection, type ViewRotation } from '../model/iso';
import { KIND_LABELS, useApp } from '../model/store';
import { FURNITURE_COLOR_KEYS, FURNITURE_COLORS } from '../model/furnitureColors';
import { furnitureFacing } from '../model/scene3d';
import type { Furniture, FurnitureKind, WallItem } from '../model/types';
import AddItemSheet from './AddItemSheet';
import AddSheet from './AddSheet';
import ConfirmDialog from './ConfirmDialog';
import FloorSheet from './FloorSheet';
import { IconCheck, IconChevronDown, IconClose, IconPencil, IconPlus, IconRedo, IconUndo, IconRotateView } from './icons';
import IsoView from './iso3d/IsoView';
import PlanCanvas from './PlanCanvas';
import { usePrompt } from './PromptDialog';
import PlanSearch from './PlanSearch';
import type { EditLayer, ShapeOp, Tool, View } from './usePlanPointer';

function UndoRedoFabs() {
  const canUndo = useApp((s) => s.history.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  if (!canUndo && !canRedo) return null;
  return (
    <>
      <button className="fab" disabled={!canUndo} onClick={() => useApp.getState().undo()} aria-label="Undo">
        <IconUndo size={19} />
      </button>
      <button className="fab" disabled={!canRedo} onClick={() => useApp.getState().redo()} aria-label="Redo">
        <IconRedo size={19} />
      </button>
    </>
  );
}

const PLACEMENT_HINTS: Record<Exclude<Tool, 'select'>, string> = {
  room: 'Drag on the grid to draw a room',
  door: 'Tap a wall to place the door',
  window: 'Tap a wall to place the window',
  opening: 'Tap a wall to open it up — drag the ends to widen',
  furniture: 'Tap inside a room to place it',
};

export default function PlanView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [view, setView] = useState<View>({ cx: 4, cy: 3, scale: 50 });
  const [mode, setMode] = useState<'iso' | 'flat'>(() =>
    localStorage.getItem('planViewMode') === 'flat' ? 'flat' : 'iso',
  );
  const [rotation, setRotation] = useState<ViewRotation>(() => {
    const stored = Number(localStorage.getItem('planRotation'));
    return ([0, 1, 2, 3] as const).includes(stored as ViewRotation) ? (stored as ViewRotation) : 0;
  });
  const projection = mode === 'iso' ? makeIsoProjection(rotation) : flatProjection;
  const rotateView = () => {
    const next = ((rotation + 1) % 4) as ViewRotation;
    // keep the world point at the screen centre fixed across the turn
    const w = makeIsoProjection(rotation).unprojectFloor(view.cx, view.cy);
    const c = makeIsoProjection(next).project(w.x, w.y);
    setView({ ...view, cx: c.x, cy: c.y });
    setRotation(next);
    localStorage.setItem('planRotation', String(next));
  };
  const toggleMode = () => {
    const next = mode === 'iso' ? 'flat' : 'iso';
    setMode(next);
    localStorage.setItem('planViewMode', next);
  };
  const [tool, setTool] = useState<Tool>('select');
  const [editLayer, setEditLayer] = useState<EditLayer>('furniture');
  const [furnitureKind, setFurnitureKind] = useState<FurnitureKind>('shelf');
  const [armedShapeOp, setArmedShapeOp] = useState<ShapeOp | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [floorsOpen, setFloorsOpen] = useState(false);
  const [addingItem, setAddingItem] = useState<string | null>(null); // initial name when open
  const [lastAreaId, setLastAreaId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { ask, dialog } = usePrompt();

  const data = useApp((s) => s.data);
  const currentFloorId = useApp((s) => s.currentFloorId);
  const selected = useApp((s) => s.selected);
  const editing = useApp((s) => s.planEditing);
  const highlightFurnitureId = useApp((s) => s.highlightFurnitureId);
  const highlightNonce = useApp((s) => s.highlightNonce);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // fit view to the rooms of the floor when switching floors or projection
  useEffect(() => {
    const proj = mode === 'iso' ? isoProjection : flatProjection;
    const rooms = useApp.getState().data.rooms.filter((r) => r.floorId === currentFloorId);
    if (!rooms.length) {
      const c = proj.project(4, 3);
      setView({ cx: c.x, cy: c.y, scale: 50 });
      return;
    }
    const pts = rooms.flatMap((r) =>
      r.polygon.flatMap((p) => [proj.project(p.x, p.y), proj.project(p.x, p.y, WALL_H)]),
    );
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const el = wrapRef.current;
    const w = el?.clientWidth ?? 360;
    const h = el?.clientHeight ?? 480;
    const scale = Math.min(80, Math.max(15, Math.min(w / (maxX - minX + 2), h / (maxY - minY + 2))));
    setView({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale });
  }, [currentFloorId, mode]);

  // center on highlighted furniture; keep it visible above an open detail sheet
  useEffect(() => {
    if (!highlightFurnitureId) return;
    const f = useApp.getState().data.furniture.find((x) => x.id === highlightFurnitureId);
    if (f) {
      const sheetOpen = useApp.getState().openFurnitureId !== null;
      const c = projection.project(f.x + f.w / 2, f.y + f.h / 2);
      setView((v) => {
        const scale = Math.max(v.scale, 50);
        // with the sheet covering the lower half, aim for the upper quarter
        const cy = sheetOpen ? c.y + (size.h * 0.25) / scale : c.y;
        return { cx: c.x, cy, scale };
      });
    }
    // a highlight tied to an open sheet stays until the sheet closes
    if (useApp.getState().openFurnitureId) return;
    const t = setTimeout(() => useApp.getState().clearHighlight(), 3500);
    return () => clearTimeout(t);
    // highlightNonce re-centers when the same furniture is revealed again
  }, [highlightFurnitureId, highlightNonce, projection, size.h]);

  // brief feedback toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // disarm extend/carve when the selection changes away from a room
  useEffect(() => {
    if (selected?.kind !== 'room') setArmedShapeOp(null);
  }, [selected]);

  // editing can end outside this component (e.g. revealItem) — drop stale tools
  useEffect(() => {
    if (!editing) {
      setTool('select');
      setArmedShapeOp(null);
    }
  }, [editing]);

  // a floor with no rooms yet starts on the structure layer — there's nothing
  // to furnish until walls exist
  useEffect(() => {
    if (!editing) return;
    const hasRooms = useApp.getState().data.rooms.some((r) => r.floorId === currentFloorId);
    if (!hasRooms) setEditLayer('structure');
  }, [editing, currentFloorId]);

  const stopEditing = () => {
    setTool('select');
    setArmedShapeOp(null);
    useApp.getState().setPlanEditing(false);
  };

  const switchLayer = (next: EditLayer) => {
    if (next === editLayer) return;
    setEditLayer(next);
    setTool('select');
    setArmedShapeOp(null);
    useApp.getState().setSelected(null);
  };

  const selectedEntity = (() => {
    if (!selected) return null;
    if (selected.kind === 'room') return data.rooms.find((r) => r.id === selected.id) ?? null;
    if (selected.kind === 'furniture') return data.furniture.find((f) => f.id === selected.id) ?? null;
    return data.wallItems.find((w) => w.id === selected.id) ?? null;
  })();

  const selectedName =
    selected?.kind === 'wallItem'
      ? (() => {
          const w = selectedEntity as { type?: string; length?: number } | null;
          const label = w?.type === 'door' ? 'Door' : w?.type === 'opening' ? 'Opening' : 'Window';
          return w?.length ? `${label} · ${w.length.toFixed(1).replace(/\.0$/, '')} m` : label;
        })()
      : ((selectedEntity as { name?: string } | null)?.name ?? '');

  const store = useApp.getState();

  const renameSelected = async () => {
    if (!selected || selected.kind === 'wallItem') return;
    const name = await ask('Rename', selectedName);
    if (!name) return;
    if (selected.kind === 'room') store.renameRoom(selected.id, name);
    else store.updateFurniture(selected.id, { name });
  };

  const rotateSelected = () => {
    if (selected?.kind !== 'furniture') return;
    const f = useApp.getState().data.furniture.find((x) => x.id === selected.id);
    if (!f) return;
    const cells = useApp.getState().roomCells(f.roomId);
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const rotated = {
      x: Math.round((cx - f.h / 2) * 20) / 20,
      y: Math.round((cy - f.w / 2) * 20) / 20,
      w: f.h,
      h: f.w,
      // a quarter-turn clockwise: the front follows the footprint
      facing: ((furnitureFacing(f) + 1) % 4) as 0 | 1 | 2 | 3,
    };
    if (rectInsideCells(rotated, cells)) store.updateFurniture(f.id, rotated);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === 'room') store.deleteRoom(selected.id);
    else if (selected.kind === 'furniture') store.deleteFurniture(selected.id);
    else store.deleteWallItem(selected.id);
    setConfirmDelete(false);
  };

  const deleteMessage = (() => {
    if (selected?.kind === 'room') {
      const count = store.countItemsInRoom(selected.id);
      return `This deletes the room with its doors, windows, furniture and ${count} item(s).`;
    }
    if (selected?.kind === 'furniture') {
      const count = store.countItemsInFurniture(selected.id);
      return `This deletes the furniture with its storage areas and ${count} item(s).`;
    }
    return 'This removes it from the wall (removing an opening closes the wall again).';
  })();

  const floors = data.floors;
  const currentFloor = floors.find((f) => f.id === currentFloorId);
  const roomsOnFloor = data.rooms.filter((r) => r.floorId === currentFloorId);

  const armShapeOp = (op: ShapeOp) => {
    setArmedShapeOp((cur) => (cur === op ? null : op));
  };

  const placing = editing && tool !== 'select';
  const showSelbar = editing && !placing && selected && selectedEntity && !armedShapeOp;
  const hint = placing
    ? tool === 'furniture'
      ? `Tap inside a room to place the ${KIND_LABELS[furnitureKind].toLowerCase()}`
      : PLACEMENT_HINTS[tool]
    : null;

  const canvasProps = {
    view,
    setView,
    size,
    tool: editing ? tool : ('select' as Tool),
    furnitureKind,
    armedShapeOp: editing ? armedShapeOp : null,
    browse: !editing,
    layer: editLayer,
    onShapeOpDone: (ok: boolean) => {
      setArmedShapeOp(null);
      if (!ok) setToast("Couldn't change the shape — rooms must stay in one piece.");
    },
    onOpenFurniture: (id: string) => useApp.getState().setOpenFurniture(id),
    onMissWall: () => setToast('Tap directly on a wall to place it.'),
    onPlaced: () => setTool('select'),
  };

  return (
    <div className="plan">
      <div className="canvas-wrap" ref={wrapRef}>
        {currentFloorId &&
          (projection.mode === 'iso' ? (
            <IsoView {...canvasProps} rotation={rotation} />
          ) : (
            <PlanCanvas {...canvasProps} projection={projection} />
          ))}
        {!editing && floors.length > 0 && <PlanSearch onAddItem={(name) => setAddingItem(name)} />}
        {currentFloor && !showSelbar && !armedShapeOp && !placing && (
          <button
            className={editing ? 'floor-pill' : 'floor-pill floor-pill-under'}
            onClick={() => setFloorsOpen(true)}
            aria-label="Switch floor"
          >
            {currentFloor.name}
            <IconChevronDown size={15} />
          </button>
        )}
        {editing && !showSelbar && !armedShapeOp && !placing && (
          <div className="layer-toggle" role="group" aria-label="Edit layer">
            <button
              className={editLayer === 'structure' ? 'active' : undefined}
              onClick={() => switchLayer('structure')}
            >
              Structure
            </button>
            <button
              className={editLayer === 'furniture' ? 'active' : undefined}
              onClick={() => switchLayer('furniture')}
            >
              Furniture
            </button>
          </div>
        )}
        {hint && (
          <div className="hint-pill">
            <span>{hint}</span>
            <button className="icon-btn" onClick={() => setTool('select')} aria-label="Cancel placement">
              <IconClose size={16} />
            </button>
          </div>
        )}
        {showSelbar && (
          <div className="selbar">
            <span className="selbar-name">{selectedName}</span>
            {selected.kind !== 'wallItem' && (
              <button className="btn btn-small" onClick={renameSelected}>
                Rename
              </button>
            )}
            {selected.kind === 'wallItem' && (selectedEntity as WallItem | null)?.type === 'door' && (
              <>
                <button
                  className="btn btn-small"
                  aria-label="Flip hinge side"
                  onClick={() => {
                    const w = selectedEntity as WallItem;
                    store.updateWallItem(w.id, { hingeAtEnd: !w.hingeAtEnd });
                  }}
                >
                  Hinge
                </button>
                <button
                  className="btn btn-small"
                  aria-label="Flip swing direction"
                  onClick={() => {
                    const w = selectedEntity as WallItem;
                    store.updateWallItem(w.id, { swingOutward: !w.swingOutward });
                  }}
                >
                  Swing
                </button>
              </>
            )}
            {selected.kind === 'room' && (
              <>
                <button className="btn btn-small" onClick={() => armShapeOp('extend')}>
                  Extend
                </button>
                <button className="btn btn-small" onClick={() => armShapeOp('carve')}>
                  Carve
                </button>
              </>
            )}
            {selected.kind === 'furniture' && (
              <>
                <span className="color-row" role="group" aria-label="Furniture colour">
                  <button
                    className={`color-dot color-dot-auto${!(selectedEntity as Furniture | null)?.color ? ' color-dot-active' : ''}`}
                    aria-label="Default colour"
                    onClick={() => store.updateFurniture(selected.id, { color: undefined })}
                  />
                  {FURNITURE_COLOR_KEYS.map((c) => (
                    <button
                      key={c}
                      className={`color-dot${(selectedEntity as Furniture | null)?.color === c ? ' color-dot-active' : ''}`}
                      style={{ background: FURNITURE_COLORS[c].hex }}
                      aria-label={FURNITURE_COLORS[c].label}
                      onClick={() => store.updateFurniture(selected.id, { color: c })}
                    />
                  ))}
                </span>
                <button className="btn btn-small" onClick={rotateSelected}>
                  Rotate
                </button>
                <button
                  className="btn btn-small btn-primary"
                  onClick={() => useApp.getState().setOpenFurniture(selected.id)}
                >
                  Open
                </button>
              </>
            )}
            <button className="btn btn-small btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>
        )}
        {armedShapeOp && (
          <div className="selbar selbar-hint">
            <span className="selbar-name">
              {armedShapeOp === 'extend'
                ? 'Drag a rectangle to add it to the room'
                : 'Drag a rectangle to cut it out of the room'}
            </span>
            <button className="btn btn-small" onClick={() => setArmedShapeOp(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="canvas-fabs canvas-fabs-left">
          <button className="fab" onClick={toggleMode} aria-label="Toggle 2D/3D view">
            {mode === 'iso' ? '2D' : '3D'}
          </button>
          {mode === 'iso' && (
            <button className="fab" onClick={rotateView} aria-label="Rotate view">
              <IconRotateView size={19} />
            </button>
          )}
        </div>
        <div className="canvas-fabs">
          {editing ? (
            <>
              <UndoRedoFabs />
              {currentFloorId && !placing && (
                <button className="fab" onClick={() => setAddOpen(true)} aria-label="Add to plan">
                  <IconPlus size={20} />
                </button>
              )}
              <button className="fab fab-primary" onClick={stopEditing} aria-label="Done editing">
                <IconCheck size={22} />
              </button>
            </>
          ) : (
            floors.length > 0 && (
              <>
                <button
                  className="fab"
                  onClick={() => useApp.getState().setPlanEditing(true)}
                  aria-label="Edit floor plan"
                >
                  <IconPencil size={18} />
                </button>
                <button
                  className="fab fab-primary"
                  onClick={() => setAddingItem('')}
                  aria-label="Add item"
                >
                  <IconPlus size={22} />
                </button>
              </>
            )
          )}
        </div>
        {toast && <div className="shape-toast">{toast}</div>}
        {floors.length === 0 && (
          <div className="empty-state">
            <p>Draw your home once, then find and stow your stuff in seconds.</p>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const name = await ask('Floor name', 'Ground floor');
                if (name) {
                  useApp.getState().addFloor(name);
                  useApp.getState().setPlanEditing(true);
                }
              }}
            >
              Add your first floor
            </button>
            <button
              className="btn"
              onClick={async () => {
                const { buildSampleHome } = await import('../model/sampleHome');
                useApp.getState().replaceData(buildSampleHome());
              }}
            >
              …or explore an example home
            </button>
          </div>
        )}
        {floors.length > 0 && roomsOnFloor.length === 0 && !placing && (
          <div className="empty-state">
            {editing ? (
              <p>
                Tap <strong>＋</strong> and choose <strong>Room</strong>, then drag on the grid to draw your
                first room. Rooms snap to the 1&nbsp;m grid; select one to extend or carve its shape.
              </p>
            ) : (
              <>
                <p>This floor is empty. Edit the plan to draw its rooms.</p>
                <button className="btn btn-primary" onClick={() => useApp.getState().setPlanEditing(true)}>
                  <IconPencil size={16} /> Edit the plan
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {dialog}
      {addOpen && (
        <AddSheet
          layer={editLayer}
          onClose={() => setAddOpen(false)}
          onPick={(t, kind) => {
            setAddOpen(false);
            setTool(t);
            if (kind) setFurnitureKind(kind);
            useApp.getState().setSelected(null);
          }}
        />
      )}
      {floorsOpen && <FloorSheet onClose={() => setFloorsOpen(false)} />}
      {addingItem !== null && (
        <AddItemSheet
          initialName={addingItem}
          lastAreaId={lastAreaId}
          onClose={() => setAddingItem(null)}
          onAdded={(areaId) => setLastAreaId(areaId)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selectedName || 'selection'}?`}
        message={`${deleteMessage} This cannot be undone.`}
        onConfirm={deleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
