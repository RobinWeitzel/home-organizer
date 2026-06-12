import { create } from 'zustand';
import type RemoteStorage from 'remotestoragejs';
import { validateData } from './persistence';
import { isEmptyData, planSync } from './syncCore';
import { useApp } from './store';
import type { AppData } from './types';

/**
 * Optional mirroring of the local data to a remoteStorage account
 * (remotestorage.io). localStorage stays the source of truth on the device;
 * the remote copy follows it. Editing keeps working offline — the next sync
 * after coming back online reconciles, and when both sides changed
 * independently the user picks the winner (see SyncConflictDialog).
 */

const SYNC_FLAG_KEY = 'home-organizer/sync-on';
const SYNC_STATE_KEY = 'home-organizer/v1/sync-state';
const SCOPE = 'home-organizer';
const DOCUMENT_PATH = `/${SCOPE}/data.json`;
const PUSH_DEBOUNCE_MS = 1500;
const POLL_INTERVAL_MS = 30_000;

export type SyncStatus = 'off' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncConflict {
  local: AppData;
  remote: AppData;
  remoteJson: string;
  remoteRev: string | null;
}

interface SyncState {
  status: SyncStatus;
  userAddress: string | null;
  error: string | null;
  conflict: SyncConflict | null;
  /** the user closed the conflict dialog to decide later */
  conflictHidden: boolean;
  lastSyncedAt: number | null;
}

export const useSync = create<SyncState>()(() => ({
  status: 'off',
  userAddress: null,
  error: null,
  conflict: null,
  conflictHidden: false,
  lastSyncedAt: null,
}));

let rs: RemoteStorage | null = null;
let rsPromise: Promise<RemoteStorage> | null = null;
let syncing = false;
let syncQueued = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** The state both sides last agreed on: its content and the remote revision. */
interface SyncMarker {
  json: string;
  rev: string | null;
}

function getMarker(): SyncMarker | null {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncMarker;
    return typeof parsed.json === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function setMarker(marker: SyncMarker) {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(marker));
  } catch {
    // sync still works, it just re-detects the same divergence next time
  }
}

class SyncHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** The library is lazy-loaded: users who never enable sync don't pay for it. */
async function ensureRemoteStorage(): Promise<RemoteStorage> {
  if (rsPromise) return rsPromise;
  rsPromise = import('remotestoragejs').then(({ default: RS }) => {
    const r = new RS({ cache: false });
    r.access.claim(SCOPE, 'rw');
    r.on('connected', () => {
      useSync.setState({
        status: 'syncing',
        userAddress: r.remote.userAddress ?? null,
        error: null,
      });
      void syncNow();
    });
    r.on('connecting', () => useSync.setState({ status: 'connecting' }));
    r.on('authing', () => useSync.setState({ status: 'connecting' }));
    r.on('not-connected', () => {
      // ready without a token (first run, or the user cancelled authorization)
      if (useSync.getState().status !== 'connecting') {
        useSync.setState({ status: 'off', userAddress: null });
      }
    });
    r.on('disconnected', () => {
      try {
        localStorage.removeItem(SYNC_FLAG_KEY);
        localStorage.removeItem(SYNC_STATE_KEY);
      } catch {
        /* nothing to clean up */
      }
      useSync.setState({
        status: 'off',
        userAddress: null,
        error: null,
        conflict: null,
        conflictHidden: false,
        lastSyncedAt: null,
      });
    });
    r.on('network-offline', () => {
      if (r.connected) useSync.setState({ status: 'offline' });
    });
    r.on('network-online', () => {
      if (r.connected) void syncNow();
    });
    r.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      useSync.setState(
        r.connected
          ? { status: 'error', error: message }
          : { status: 'off', error: message },
      );
    });
    rs = r;
    return r;
  });
  return rsPromise;
}

/** Start the OAuth dance; on success the browser navigates away and back. */
export async function connectSync(address: string): Promise<void> {
  useSync.setState({ status: 'connecting', error: null });
  try {
    const r = await ensureRemoteStorage();
    localStorage.setItem(SYNC_FLAG_KEY, '1');
    r.connect(address.trim());
  } catch (err) {
    useSync.setState({ status: 'off', error: err instanceof Error ? err.message : String(err) });
  }
}

export function disconnectSync(): void {
  rs?.disconnect();
}

/** Re-run authorization after an expired token. */
export function reconnectSync(): void {
  rs?.reconnect();
}

export function showConflict(): void {
  useSync.setState({ conflictHidden: false });
}

export function hideConflict(): void {
  useSync.setState({ conflictHidden: true });
}

interface RemoteDoc {
  /** null when no document exists on the remote yet */
  json: string | null;
  rev: string | null;
  /** true when the server reported "unchanged since the marker revision" */
  unchanged: boolean;
}

async function fetchRemote(markerRev: string | null): Promise<RemoteDoc> {
  const res = await rs!.remote.get(DOCUMENT_PATH, markerRev ? { ifNoneMatch: markerRev } : {});
  if (res.statusCode === 304) return { json: null, rev: markerRev, unchanged: true };
  if (res.statusCode === 404) return { json: null, rev: null, unchanged: false };
  if (res.statusCode === 401 || res.statusCode === 403) {
    throw new SyncHttpError('Not authorized — reconnect to your storage.', res.statusCode);
  }
  if (res.statusCode !== 200) {
    throw new SyncHttpError(`Your storage answered with HTTP ${res.statusCode}.`, res.statusCode);
  }
  const body =
    typeof res.body === 'string'
      ? res.body
      : res.body
        ? // Dropbox/Google Drive backends hand JSON bodies back pre-parsed
          JSON.stringify(res.body)
        : null;
  return { json: body && body.trim() ? body : null, rev: res.revision ?? null, unchanged: false };
}

/**
 * Conditional upload: only succeeds if the remote still has the revision we
 * fetched this round (or none, for a first push). Returns false on a lost
 * race so the caller can re-sync against the newer remote state.
 */
async function pushLocal(json: string, expectedRev: string | null): Promise<boolean> {
  const res = await rs!.remote.put(
    DOCUMENT_PATH,
    json,
    'application/json',
    expectedRev ? { ifMatch: expectedRev } : { ifNoneMatch: '*' },
  );
  if (res.statusCode === 412) return false;
  if (res.statusCode === 401 || res.statusCode === 403) {
    throw new SyncHttpError('Not authorized — reconnect to your storage.', res.statusCode);
  }
  if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204) {
    throw new SyncHttpError(`Upload failed with HTTP ${res.statusCode}.`, res.statusCode);
  }
  setMarker({ json, rev: res.revision ?? null });
  return true;
}

export async function syncNow(): Promise<void> {
  if (!rs?.connected) return;
  // a pending conflict freezes sync until the user picks a side
  if (useSync.getState().conflict) return;
  if (syncing) {
    syncQueued = true;
    return;
  }
  syncing = true;
  useSync.setState({ status: 'syncing' });
  try {
    const localData = useApp.getState().data;
    const localJson = JSON.stringify(localData);
    const marker = getMarker();
    const remote = await fetchRemote(marker?.rev ?? null);
    const rawRemote = remote.unchanged ? (marker?.json ?? null) : remote.json;

    let remoteData: AppData | null = null;
    let remoteJson: string | null = null;
    if (rawRemote !== null) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(rawRemote);
      } catch {
        /* handled below as unreadable */
      }
      const result = parsed === null ? null : validateData(parsed);
      if (!result?.ok) {
        // possibly written by a newer app version — never overwrite it blindly
        useSync.setState({
          status: 'error',
          error: 'The synced copy can’t be read by this version of the app. Update the app, or disconnect sync to ignore it.',
        });
        return;
      }
      remoteData = result.data;
      remoteJson = JSON.stringify(remoteData);
    }

    const action = planSync({
      localJson,
      remoteJson,
      lastSyncedJson: marker?.json ?? null,
      localEmpty: isEmptyData(localData),
      remoteEmpty: remoteData ? isEmptyData(remoteData) : true,
    });

    if (action === 'markSynced') {
      setMarker({ json: localJson, rev: remote.rev });
    } else if (action === 'push') {
      if (!(await pushLocal(localJson, remote.rev))) syncQueued = true;
    } else if (action === 'pull' && remoteData && remoteJson) {
      useApp.getState().applyExternalData(remoteData);
      setMarker({ json: remoteJson, rev: remote.rev });
      // a pulled v1 document gets re-uploaded in canonical (migrated) form
      if (remoteJson !== rawRemote) await pushLocal(remoteJson, remote.rev);
    } else if (action === 'conflict' && remoteData && remoteJson) {
      useSync.setState({
        conflict: { local: localData, remote: remoteData, remoteJson, remoteRev: remote.rev },
        conflictHidden: false,
      });
    }
    useSync.setState({ status: 'synced', error: null, lastSyncedAt: Date.now() });
  } catch (err) {
    if (err instanceof SyncHttpError) {
      useSync.setState({ status: 'error', error: err.message });
    } else {
      // can't reach the storage — same as offline: keep editing, retry later
      useSync.setState({ status: 'offline', error: null });
    }
  } finally {
    syncing = false;
    if (syncQueued) {
      syncQueued = false;
      void syncNow();
    }
  }
}

export async function resolveConflict(choice: 'local' | 'remote'): Promise<void> {
  const { conflict } = useSync.getState();
  if (!conflict) return;
  useSync.setState({ conflict: null, conflictHidden: false });
  // Treat the remote snapshot as the last agreed state: keeping "local" then
  // pushes the device data, keeping "remote" applies it and settles as a noop.
  setMarker({ json: conflict.remoteJson, rev: conflict.remoteRev });
  if (choice === 'remote') {
    useApp.getState().applyExternalData(conflict.remote);
  }
  await syncNow();
}

let initialized = false;

export function initRemoteSync(): void {
  if (initialized) return;
  initialized = true;
  // mirror local edits upward, debounced like the localStorage save
  useApp.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    if (!rs?.connected) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void syncNow(), PUSH_DEBOUNCE_MS);
  });
  window.addEventListener('online', () => {
    if (rs?.connected) void syncNow();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && rs?.connected) void syncNow();
  });
  setInterval(() => {
    if (rs?.connected && document.visibilityState === 'visible') void syncNow();
  }, POLL_INTERVAL_MS);
  // an instance must exist on load to restore the session — and to catch the
  // token in the URL fragment when the OAuth redirect lands back here
  let wasConnected = false;
  try {
    wasConnected = localStorage.getItem(SYNC_FLAG_KEY) !== null;
  } catch {
    /* no localStorage, no sync */
  }
  if (wasConnected) void ensureRemoteStorage();
}
