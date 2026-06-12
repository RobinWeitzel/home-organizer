import { useRef, useState } from 'react';
import { useApp } from '../model/store';
import { IconClose, IconPlus, IconSearch } from './icons';

/**
 * Always-visible search over the plan — the primary way to find things.
 * Picking a result highlights the furniture on the plan and opens its detail
 * at the right storage area.
 */
export default function PlanSearch({ onAddItem }: { onAddItem: (initialName: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const items = useApp((s) => s.data.items);
  const locateItem = useApp((s) => s.locateItem);

  const q = query.trim().toLowerCase();
  const results = q
    ? items
        .filter((i) => i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 12)
    : [];
  const open = focused && q.length > 0;

  const pick = (itemId: string) => {
    setQuery('');
    inputRef.current?.blur();
    useApp.getState().revealItem(itemId);
  };

  return (
    <div className="plan-search">
      <div className="plan-search-bar">
        <IconSearch size={18} className="plan-search-icon" />
        <input
          ref={inputRef}
          className="plan-search-input"
          type="search"
          placeholder="Where is my…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          // delayed: on some mobile browsers blur fires before the tap reaches
          // a result row — collapsing immediately would unmount it mid-tap
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFocused(false), 150);
          }}
        />
        {query && (
          <button
            className="icon-btn"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <IconClose size={16} />
          </button>
        )}
      </div>
      {open && (
        <div className="plan-search-results" onMouseDown={(e) => e.preventDefault()}>
          {results.map((item) => {
            const loc = locateItem(item.id);
            return (
              <button
                key={item.id}
                className="plan-search-result"
                // pointerdown beats the input's blur so the tap still lands
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(item.id);
                }}
              >
                <span className="plan-search-result-name">
                  {item.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </span>
                {loc && (
                  <span className="breadcrumb">
                    {loc.room.name} › {loc.furniture.name} › {loc.area.name}
                  </span>
                )}
              </button>
            );
          })}
          {results.length === 0 && <div className="plan-search-empty">Nothing matches “{query.trim()}”.</div>}
          <button
            className="plan-search-result plan-search-add"
            onPointerDown={(e) => {
              e.preventDefault();
              const name = query.trim();
              setQuery('');
              inputRef.current?.blur();
              onAddItem(name);
            }}
          >
            <IconPlus size={16} />
            <span>Add “{query.trim()}” as a new item</span>
          </button>
        </div>
      )}
    </div>
  );
}
