import { useEffect } from 'react';
import { useApp } from './model/store';
import TabBar from './components/TabBar';
import PlanView from './components/PlanView';
import ItemsView from './components/ItemsView';
import SettingsView from './components/SettingsView';
import FurnitureSheet from './components/FurnitureSheet';
import SyncConflictDialog from './components/SyncConflictDialog';

export default function App() {
  const activeTab = useApp((s) => s.activeTab);
  const persistenceError = useApp((s) => s.persistenceError);
  const openFurnitureId = useApp((s) => s.openFurnitureId);

  // global undo/redo shortcuts (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (e.shiftKey) useApp.getState().redo();
      else useApp.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="app">
      {persistenceError && (
        <div className="banner">
          Saving failed — changes may be lost. Export a backup from Settings.
        </div>
      )}
      <main className="main">
        {activeTab === 'plan' && <PlanView />}
        {activeTab === 'items' && <ItemsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <TabBar />
      {/* keyed so per-furniture state (selected area, edit toggle) resets on switch */}
      {openFurnitureId && <FurnitureSheet key={openFurnitureId} furnitureId={openFurnitureId} />}
      <SyncConflictDialog />
    </div>
  );
}
