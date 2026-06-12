import type { ComponentType, SVGProps } from 'react';
import { useApp, type Tab } from '../model/store';
import { IconItems, IconPlan, IconSettings } from './icons';

const TABS: { id: Tab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }> }[] = [
  { id: 'plan', label: 'Home', Icon: IconPlan },
  { id: 'items', label: 'Items', Icon: IconItems },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

export default function TabBar() {
  const activeTab = useApp((s) => s.activeTab);
  const setTab = useApp((s) => s.setTab);
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab ${activeTab === id ? 'tab-active' : ''}`}
          onClick={() => setTab(id)}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <Icon size={22} className="tab-icon" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
