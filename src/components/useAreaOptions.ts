import { useMemo } from 'react';
import { sortAreas } from '../model/areaLayout';
import { useApp } from '../model/store';

export interface AreaOption {
  areaId: string;
  areaName: string;
  groupLabel: string;
}

/** All storage areas, ordered by floor/room/furniture, for location pickers. */
export function useAreaOptions(): AreaOption[] {
  const data = useApp((s) => s.data);
  return useMemo(() => {
    const out: AreaOption[] = [];
    for (const floor of [...data.floors].sort((a, b) => a.order - b.order)) {
      for (const room of data.rooms.filter((r) => r.floorId === floor.id)) {
        for (const f of data.furniture.filter((x) => x.roomId === room.id)) {
          const areas = sortAreas(data.areas.filter((a) => a.furnitureId === f.id));
          for (const a of areas) {
            out.push({
              areaId: a.id,
              areaName: a.name,
              groupLabel: `${floor.name} › ${room.name} › ${f.name}`,
            });
          }
        }
      }
    }
    return out;
  }, [data]);
}

export function groupOptions(options: AreaOption[]): [string, AreaOption[]][] {
  const map = new Map<string, AreaOption[]>();
  for (const o of options) {
    const list = map.get(o.groupLabel) ?? [];
    list.push(o);
    map.set(o.groupLabel, list);
  }
  return [...map.entries()];
}
