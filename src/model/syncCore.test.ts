import { describe, expect, it } from 'vitest';
import { isEmptyData, planSync, type SyncInput } from './syncCore';
import { emptyData } from './types';

const A = '{"v":"a"}';
const B = '{"v":"b"}';
const C = '{"v":"c"}';

function plan(input: Partial<SyncInput>) {
  return planSync({
    localJson: A,
    remoteJson: A,
    lastSyncedJson: A,
    localEmpty: false,
    remoteEmpty: false,
    ...input,
  });
}

describe('planSync', () => {
  it('does nothing when everything agrees', () => {
    expect(plan({})).toBe('noop');
  });

  it('records the common state when both sides match but the marker is stale', () => {
    expect(plan({ lastSyncedJson: null })).toBe('markSynced');
    expect(plan({ lastSyncedJson: B })).toBe('markSynced');
  });

  it('pushes when no remote document exists yet', () => {
    expect(plan({ remoteJson: null, lastSyncedJson: null })).toBe('push');
  });

  it('pushes local-only changes', () => {
    expect(plan({ localJson: B, remoteJson: A, lastSyncedJson: A })).toBe('push');
  });

  it('pulls remote-only changes', () => {
    expect(plan({ localJson: A, remoteJson: B, lastSyncedJson: A })).toBe('pull');
  });

  it('conflicts when both sides diverged', () => {
    expect(plan({ localJson: B, remoteJson: C, lastSyncedJson: A })).toBe('conflict');
  });

  it('conflicts on first sync when both sides hold different data', () => {
    expect(plan({ localJson: A, remoteJson: B, lastSyncedJson: null })).toBe('conflict');
  });

  it('never asks the user when one diverged side is empty', () => {
    expect(plan({ localJson: A, remoteJson: B, lastSyncedJson: null, localEmpty: true })).toBe('pull');
    expect(plan({ localJson: A, remoteJson: B, lastSyncedJson: null, remoteEmpty: true })).toBe('push');
  });

  it('pulls offline remote edits made elsewhere while this device stayed put', () => {
    // device went offline at A; another device moved remote to B
    expect(plan({ localJson: A, remoteJson: B, lastSyncedJson: A })).toBe('pull');
  });

  it('conflicts after offline edits on both sides', () => {
    // device edited A→B offline while another device moved remote A→C
    expect(plan({ localJson: B, remoteJson: C, lastSyncedJson: A })).toBe('conflict');
  });
});

describe('isEmptyData', () => {
  it('treats a fresh home as empty', () => {
    expect(isEmptyData(emptyData())).toBe(true);
  });

  it('treats any populated collection as non-empty', () => {
    const data = emptyData();
    data.floors.push({ id: 'f1', name: 'Ground', order: 0 });
    expect(isEmptyData(data)).toBe(false);
  });
});
