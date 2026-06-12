// Stroke icon set — replaces emoji glyphs so the chrome matches the clean
// architectural look of the floor plan. All icons share one 24×24 grid.
import type { ReactNode, SVGProps } from 'react';
import type { FurnitureKind } from '../model/types';

function Icon({ children, size = 20, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

/* ---- navigation ---- */

export const IconPlan = (p: P) => (
  <Icon {...p}>
    <rect x={3.5} y={3.5} width={17} height={17} rx={1} />
    <path d="M 10.5 3.5 V 10 H 3.5 M 10.5 10 H 14 M 17.5 10 H 20.5 M 14.5 20.5 V 15" />
  </Icon>
);

export const IconItems = (p: P) => (
  <Icon {...p}>
    <path d="M 4 8.2 12 4 20 8.2 V 16 L 12 20 4 16 Z" />
    <path d="M 4 8.2 12 12.2 20 8.2 M 12 12.2 V 20" />
  </Icon>
);

export const IconSettings = (p: P) => (
  <Icon {...p}>
    <path d="M 4 7.5 H 12 M 17 7.5 H 20 M 4 16.5 H 7 M 12 16.5 H 20" />
    <circle cx={14.5} cy={7.5} r={2.4} />
    <circle cx={9.5} cy={16.5} r={2.4} />
  </Icon>
);

/* ---- plan tools ---- */

export const IconSelect = (p: P) => (
  <Icon {...p}>
    <path d="M 6 4 L 18.5 11.5 L 12.8 13 L 10 18.5 Z" />
  </Icon>
);

export const IconRoom = (p: P) => (
  <Icon {...p}>
    <rect x={4.5} y={5.5} width={15} height={13} rx={1} />
    <path d="M 4.5 12 H 9 M 15 12 H 19.5" strokeDasharray="0" opacity={0.55} />
  </Icon>
);

export const IconDoor = (p: P) => (
  <Icon {...p}>
    <path d="M 5 20 H 19" />
    <path d="M 7 20 V 5.5 L 14.5 4 V 20" />
    <circle cx={12.6} cy={12} r={0.9} fill="currentColor" stroke="none" />
  </Icon>
);

export const IconWindow = (p: P) => (
  <Icon {...p}>
    <rect x={4.5} y={4.5} width={15} height={15} rx={1} />
    <path d="M 12 4.5 V 19.5 M 4.5 12 H 19.5" />
  </Icon>
);

/** a wall with a gap: open passage between rooms */
export const IconOpening = (p: P) => (
  <Icon {...p}>
    <path d="M 3.5 12 H 8.5 M 15.5 12 H 20.5" strokeWidth={2.6} />
    <path d="M 8.5 9 V 15 M 15.5 9 V 15" strokeWidth={1.2} strokeDasharray="1.6 1.4" />
  </Icon>
);

export const IconFurniture = (p: P) => (
  <Icon {...p}>
    <rect x={4.5} y={4} width={15} height={14} rx={1} />
    <path d="M 4.5 11 H 19.5 M 7 18 V 20.5 M 17 18 V 20.5" />
    <path d="M 10.5 7.5 H 13.5 M 10.5 14.5 H 13.5" />
  </Icon>
);

/* ---- actions ---- */

export const IconPencil = (p: P) => (
  <Icon {...p}>
    <path d="M 14.5 5.5 L 18.5 9.5 L 9 19 L 4.5 19.5 L 5 15 Z" />
    <path d="M 13 7 L 17 11" />
  </Icon>
);

export const IconSearch = (p: P) => (
  <Icon {...p}>
    <circle cx={11} cy={11} r={6.5} />
    <path d="M 15.8 15.8 L 20 20" />
  </Icon>
);

export const IconTrash = (p: P) => (
  <Icon {...p}>
    <path d="M 5 7 H 19 M 9.5 7 V 4.8 A 0.8 0.8 0 0 1 10.3 4 H 13.7 A 0.8 0.8 0 0 1 14.5 4.8 V 7" />
    <path d="M 6.7 7 L 7.4 19.2 A 0.9 0.9 0 0 0 8.3 20 H 15.7 A 0.9 0.9 0 0 0 16.6 19.2 L 17.3 7" />
    <path d="M 10.2 10.5 V 16.5 M 13.8 10.5 V 16.5" />
  </Icon>
);

export const IconPlus = (p: P) => (
  <Icon {...p}>
    <path d="M 12 5 V 19 M 5 12 H 19" />
  </Icon>
);

export const IconMinus = (p: P) => (
  <Icon {...p}>
    <path d="M 5 12 H 19" />
  </Icon>
);

export const IconClose = (p: P) => (
  <Icon {...p}>
    <path d="M 6 6 L 18 18 M 18 6 L 6 18" />
  </Icon>
);

export const IconNote = (p: P) => (
  <Icon {...p}>
    <path d="M 5 4.5 H 19 V 19.5 H 5 Z" />
    <path d="M 8 9 H 16 M 8 12.5 H 16 M 8 16 H 12.5" />
  </Icon>
);

export const IconArrowUp = (p: P) => (
  <Icon {...p}>
    <path d="M 12 19 V 5 M 6.5 10.5 L 12 5 L 17.5 10.5" />
  </Icon>
);

export const IconArrowDown = (p: P) => (
  <Icon {...p}>
    <path d="M 12 5 V 19 M 6.5 13.5 L 12 19 L 17.5 13.5" />
  </Icon>
);

export const IconChevronDown = (p: P) => (
  <Icon {...p}>
    <path d="M 6 9.5 L 12 15.5 L 18 9.5" />
  </Icon>
);

export const IconChevronRight = (p: P) => (
  <Icon {...p}>
    <path d="M 9.5 6 L 15.5 12 L 9.5 18" />
  </Icon>
);

export const IconUndo = (p: P) => (
  <Icon {...p}>
    <path d="M 8.5 6.5 L 4.5 10.5 L 8.5 14.5" />
    <path d="M 4.5 10.5 H 14 A 5 5 0 0 1 14 20.5 H 9" />
  </Icon>
);

export const IconRedo = (p: P) => (
  <Icon {...p}>
    <path d="M 15.5 6.5 L 19.5 10.5 L 15.5 14.5" />
    <path d="M 19.5 10.5 H 10 A 5 5 0 0 0 10 20.5 H 15" />
  </Icon>
);

export const IconCheck = (p: P) => (
  <Icon {...p}>
    <path d="M 5 12.5 L 10 17.5 L 19 6.5" />
  </Icon>
);

export const IconLayers = (p: P) => (
  <Icon {...p}>
    <path d="M 12 3.5 L 20.5 8 L 12 12.5 L 3.5 8 Z" />
    <path d="M 4.8 12.2 L 12 16 L 19.2 12.2" />
    <path d="M 4.8 16.2 L 12 20 L 19.2 16.2" />
  </Icon>
);

export const IconRotate = (p: P) => (
  <Icon {...p}>
    <path d="M 19.5 12 A 7.5 7.5 0 1 1 14.5 4.93" />
    <path d="M 14.5 1.5 L 14.5 4.93 L 17.9 4.93" />
  </Icon>
);

/* ---- furniture kinds ---- */

export const KIND_GLYPHS: Record<FurnitureKind, (p: P) => ReactNode> = {
  shelf: (p) => (
    <Icon {...p}>
      <rect x={5.5} y={3.5} width={13} height={17} rx={1} />
      <path d="M 5.5 8.5 H 18.5 M 5.5 13.5 H 18.5" />
    </Icon>
  ),
  dresser: (p) => (
    <Icon {...p}>
      <rect x={4.5} y={6} width={15} height={13} rx={1} />
      <path d="M 4.5 12.5 H 19.5 M 11 9.2 H 13 M 11 15.7 H 13" />
    </Icon>
  ),
  wardrobe: (p) => (
    <Icon {...p}>
      <rect x={5.5} y={3.5} width={13} height={17} rx={1} />
      <path d="M 12 3.5 V 20.5 M 10 11 V 13.4 M 14 11 V 13.4" />
    </Icon>
  ),
  cabinet: (p) => (
    <Icon {...p}>
      <rect x={4.5} y={6} width={15} height={13} rx={1} />
      <rect x={7.5} y={9} width={9} height={7} />
    </Icon>
  ),
  chest: (p) => (
    <Icon {...p}>
      <rect x={4.5} y={9} width={15} height={10} rx={1} />
      <path d="M 4.5 12 H 19.5 M 11 10.5 H 13" />
    </Icon>
  ),
  other: (p) => (
    <Icon {...p}>
      <path d="M 5 9 H 19 V 19 H 5 Z" />
      <path d="M 5 9 L 6.8 5 H 17.2 L 19 9 M 10.5 12 H 13.5" />
    </Icon>
  ),
};
