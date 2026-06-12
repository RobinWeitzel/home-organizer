import { useRef, useState } from 'react';
import { exportJson, importJson } from '../model/persistence';
import {
  connectSync,
  disconnectSync,
  reconnectSync,
  showConflict,
  syncNow,
  useSync,
} from '../model/remoteSync';
import { useApp } from '../model/store';
import { emptyData, type AppData } from '../model/types';
import ConfirmDialog from './ConfirmDialog';

function SyncSection() {
  const status = useSync((s) => s.status);
  const userAddress = useSync((s) => s.userAddress);
  const error = useSync((s) => s.error);
  const conflict = useSync((s) => s.conflict);
  const [address, setAddress] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (status === 'off' || status === 'connecting') {
    return (
      <div className="settings-card">
        <h3>Sync</h3>
        <p>
          Optionally mirror your data to a{' '}
          <a href="https://remotestorage.io" target="_blank" rel="noreferrer">
            remoteStorage
          </a>{' '}
          account to back it up and share it across devices. You can keep working offline; changes
          sync once you’re back online.
        </p>
        <form
          className="sync-form"
          onSubmit={(e) => {
            e.preventDefault();
            void connectSync(address);
          }}
        >
          <input
            className="input"
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="user@provider.com"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={status === 'connecting'}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={status === 'connecting' || !address.includes('@')}
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        </form>
        {error && <span className="error-text">{error}</span>}
      </div>
    );
  }

  const statusText =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? 'Offline — changes will sync when you’re back online.'
        : status === 'error'
          ? 'Last sync failed.'
          : conflict
            ? 'Paused — a sync conflict needs your decision.'
            : 'Up to date.';

  return (
    <div className="settings-card">
      <h3>Sync</h3>
      <p>
        Connected as <strong>{userAddress}</strong>. {statusText}
      </p>
      {status === 'error' && error && <span className="error-text">{error}</span>}
      {conflict && (
        <button className="btn btn-primary" onClick={showConflict}>
          Resolve sync conflict…
        </button>
      )}
      {status === 'error' && (
        <button className="btn" onClick={reconnectSync}>
          Reconnect
        </button>
      )}
      <button className="btn" onClick={() => void syncNow()} disabled={status === 'syncing'}>
        Sync now
      </button>
      <button className="btn" onClick={() => setConfirmDisconnect(true)}>
        Disconnect
      </button>
      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect sync?"
        message="Your data stays on this device and on the remote storage, but they will no longer be kept in sync."
        confirmLabel="Disconnect"
        onConfirm={() => {
          disconnectSync();
          setConfirmDisconnect(false);
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}

export default function SettingsView() {
  const data = useApp((s) => s.data);
  const replaceData = useApp((s) => s.replaceData);
  const syncedRemotely = useSync((s) => s.status !== 'off' && s.status !== 'connecting');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);

  const doExport = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-organizer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    setImportError('');
    if (!file) return;
    const result = importJson(await file.text());
    if (result.ok) setPendingImport(result.data);
    else setImportError(result.error);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="settings">
      <h2>Settings</h2>
      <div className="settings-card">
        <h3>Backup</h3>
        <p>
          {syncedRemotely
            ? `Your data lives on this device and is mirrored to your storage account (${data.items.length} item(s), ${data.floors.length} floor(s)).`
            : `Your data lives only on this device (${data.items.length} item(s), ${data.floors.length} floor(s)). Export a backup file regularly.`}
        </p>
        <button className="btn btn-primary" onClick={doExport}>
          Export backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {importError && <span className="error-text">{importError}</span>}
      </div>
      <SyncSection />
      <div className="settings-card">
        <h3>Example home</h3>
        <p>Load a small two-floor demo to see how a finished home looks. You can undo this.</p>
        <button className="btn" onClick={() => setConfirmSample(true)}>
          Load example home
        </button>
      </div>
      <div className="settings-card">
        <h3>Danger zone</h3>
        <p>Remove every floor, room, furniture piece and item from this device.</p>
        <button className="btn btn-danger" onClick={() => setConfirmErase(true)}>
          Erase all data
        </button>
      </div>
      <div className="settings-card">
        <h3>About</h3>
        <p>
          Home Organizer — draw your home, define storage areas in your furniture, and track where everything is.
          Works fully offline; install it from your browser menu for the full app experience.
        </p>
      </div>
      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace everything?"
        message={`The backup contains ${pendingImport?.items.length ?? 0} item(s) on ${
          pendingImport?.floors.length ?? 0
        } floor(s). Your current data (${data.items.length} item(s)) will be replaced.`}
        confirmLabel="Import"
        onConfirm={() => {
          if (pendingImport) replaceData(pendingImport);
          setPendingImport(null);
        }}
        onCancel={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmSample}
        title="Load the example home?"
        message={`This replaces your current data (${data.items.length} item(s)). You can undo it afterwards.`}
        confirmLabel="Load example"
        onConfirm={async () => {
          const { buildSampleHome } = await import('../model/sampleHome');
          replaceData(buildSampleHome());
          setConfirmSample(false);
          useApp.getState().setTab('plan');
        }}
        onCancel={() => setConfirmSample(false)}
      />
      <ConfirmDialog
        open={confirmErase}
        title="Erase all data?"
        message={`This permanently deletes ${data.items.length} item(s) and every floor plan. This cannot be undone.`}
        confirmLabel="Erase"
        onConfirm={() => {
          replaceData(emptyData());
          setConfirmErase(false);
        }}
        onCancel={() => setConfirmErase(false)}
      />
    </div>
  );
}
