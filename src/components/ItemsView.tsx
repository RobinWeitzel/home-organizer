import { useMemo, useState } from 'react';
import { sortAreas } from '../model/areaLayout';
import { useApp } from '../model/store';
import type { Furniture, Item } from '../model/types';
import AddItemSheet from './AddItemSheet';
import { IconNote, IconPlus, KIND_GLYPHS } from './icons';

interface ItemEntry extends Item {
  areaName: string;
}

interface Group {
  furniture: Furniture;
  crumb: string;
  items: ItemEntry[];
}

export default function ItemsView() {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null); // initial name when open
  const [lastAreaId, setLastAreaId] = useState<string | null>(null);
  const data = useApp((s) => s.data);
  const revealItem = useApp((s) => s.revealItem);
  const revealFurniture = useApp((s) => s.revealFurniture);

  const q = query.trim().toLowerCase();

  // the home's own hierarchy structures the list: floor › room › furniture,
  // with each item carrying its storage area
  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const floor of [...data.floors].sort((a, b) => a.order - b.order)) {
      for (const room of data.rooms.filter((r) => r.floorId === floor.id)) {
        for (const furniture of data.furniture.filter((f) => f.roomId === room.id)) {
          const areas = sortAreas(data.areas.filter((a) => a.furnitureId === furniture.id));
          const items: ItemEntry[] = [];
          for (const area of areas) {
            const matched = data.items
              .filter(
                (i) =>
                  i.areaId === area.id &&
                  (!q || i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)),
              )
              .sort((a, b) => a.name.localeCompare(b.name));
            for (const i of matched) items.push({ ...i, areaName: area.name });
          }
          if (items.length) out.push({ furniture, crumb: `${floor.name} › ${room.name}`, items });
        }
      }
    }
    return out;
  }, [data, q]);

  const total = data.items.length;
  const matched = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="items-view">
      <div className="search-bar">
        <input
          className="input"
          type="search"
          placeholder="Search your stuff…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary add-item-btn" onClick={() => setAdding('')}>
          <IconPlus size={16} /> Add
        </button>
      </div>
      {total > 0 && (
        <div className="items-count">
          {q ? `${matched} of ${total}` : total} item{total === 1 ? '' : 's'}
        </div>
      )}
      <div className="items-list">
        {total === 0 && (
          <div className="empty-state" style={{ position: 'static', padding: '48px 24px' }}>
            <p>Nothing here yet. Add your first item and never lose it again.</p>
            <button className="btn btn-primary" onClick={() => setAdding('')}>
              <IconPlus size={16} /> Add an item
            </button>
          </div>
        )}
        {total > 0 && matched === 0 && (
          <div className="empty-state" style={{ position: 'static', padding: '48px 24px' }}>
            <p>Nothing matches “{query}”.</p>
            <button className="btn btn-primary" onClick={() => setAdding(query.trim())}>
              <IconPlus size={16} /> Add “{query.trim()}”
            </button>
          </div>
        )}
        {groups.map((g) => {
          const Glyph = KIND_GLYPHS[g.furniture.kind];
          return (
            <section key={g.furniture.id} className="items-group">
              <button
                className="items-group-header"
                onClick={() => revealFurniture(g.furniture.id)}
                aria-label={`Show ${g.furniture.name} on the plan`}
              >
                <Glyph size={17} />
                <span className="items-group-name">{g.furniture.name}</span>
                <span className="items-group-crumb">{g.crumb}</span>
              </button>
              {g.items.map((item) => (
                <div key={item.id} className="item-li" onClick={() => revealItem(item.id)} role="button">
                  <span className="item-li-name">
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </span>
                  {item.notes && <IconNote size={13} className="item-li-note" />}
                  <span className="item-li-area">{item.areaName}</span>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      {adding !== null && (
        <AddItemSheet
          initialName={adding}
          lastAreaId={lastAreaId}
          onClose={() => setAdding(null)}
          onAdded={(areaId) => setLastAreaId(areaId)}
        />
      )}
    </div>
  );
}
