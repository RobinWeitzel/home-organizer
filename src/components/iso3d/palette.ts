import { useEffect, useState } from 'react';

const NAMES = ['--wall-top', '--wall-front', '--wall-side', '--floor-skirt', '--door-wood', '--iso-bg'] as const;
export type Palette = Record<(typeof NAMES)[number], string>;

function read(): Palette {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(NAMES.map((n) => [n, cs.getPropertyValue(n).trim()])) as Palette;
}

export function usePalette(): Palette {
  const [p, setP] = useState<Palette>(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setP(read());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return p;
}
