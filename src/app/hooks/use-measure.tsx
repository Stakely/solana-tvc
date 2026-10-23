'use client';

import { useEffect, useReducer } from 'react';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { InclusionWindow, MeasureResponse } from '@/types/measure.ts';
import { usePageVisible } from '@/app/hooks/page-visible.tsx';

// Windows a session keeps (and bars the graph can show): the last 5 minutes
// at one window per poll.
export const KEPT_WINDOWS = Math.ceil(
  MEASURE.recentWindowMs / MEASURE.measurePollMs
);

export type SessionTotals = {
  windows: number;
  measured: number;
  included: number;
  payable: number;
  missed: number;
  sharedMissed: number;
  leader: number;
  notMeasured: number;
  noPayingBlocks: number;
  firstSlot: number | null;
  lastSlot: number | null;
};

export const EMPTY_TOTALS: SessionTotals = {
  windows: 0,
  measured: 0,
  included: 0,
  payable: 0,
  missed: 0,
  sharedMissed: 0,
  leader: 0,
  notMeasured: 0,
  noPayingBlocks: 0,
  firstSlot: null,
  lastSlot: null,
};

export type MeasurePhase = 'idle' | 'loading' | 'ok' | 'not_found' | 'error';

export type MeasureState = {
  vote: string | null;
  phase: MeasurePhase;
  response: MeasureResponse | null;
  instance: string | null;
  // Newest seq the session has seen; null until a response marks where the
  // session starts.
  lastSeq: number | null;
  windows: InclusionWindow[];
  totals: SessionTotals;
  startedAt: number;
  // The server rejected the vote account (400): it stays invalid, so it is not
  // asked for again. An unknown one (validator: null) may show up later.
  invalid: boolean;
};

export type MeasureAction =
  | { type: 'start'; vote: string; now: number }
  | { type: 'response'; response: MeasureResponse; now: number }
  // A 400: not a valid vote account.
  | { type: 'not_found' }
  | { type: 'error' };

export function initialMeasureState(
  now: number,
  vote: string | null = null
): MeasureState {
  return {
    vote,
    phase: vote === null ? 'idle' : 'loading',
    response: null,
    instance: null,
    lastSeq: null,
    windows: [],
    totals: EMPTY_TOTALS,
    startedAt: now,
    invalid: false,
  };
}

function addWindow(totals: SessionTotals, window: InclusionWindow): SessionTotals {
  const next: SessionTotals = {
    ...totals,
    windows: totals.windows + 1,
    firstSlot: totals.firstSlot ?? window.fromSlot,
    lastSlot: window.toSlot,
  };
  switch (window.kind) {
    case 'measured': {
      const missed = Math.max(0, window.payable - window.included);
      return {
        ...next,
        measured: next.measured + 1,
        included: next.included + window.included,
        payable: next.payable + window.payable,
        missed: next.missed + missed,
        sharedMissed: next.sharedMissed + (window.shared ? missed : 0),
      };
    }
    case 'leader':
      return { ...next, leader: next.leader + 1 };
    case 'not_measured':
      return { ...next, notMeasured: next.notMeasured + 1 };
    case 'no_paying_blocks':
      return { ...next, noPayingBlocks: next.noPayingBlocks + 1 };
  }
}

// Under review and in the migration epoch the server sends no windows,
// whatever it has (spec §4.8, §6.5).
function sendsWindows(response: MeasureResponse): boolean {
  return (
    response.validator !== null &&
    response.measurement !== 'under_review' &&
    !response.migrationEpoch
  );
}

const newestSeq = (windows: InclusionWindow[], from: number): number =>
  windows.reduce((max, window) => Math.max(max, window.seq), from);

// Windows are numbered per server process (seq): each one is added once,
// and a new process (restart or another replica) starts a new session.
// The server keeps the last 5 minutes of windows, also from before the
// session (an earlier session, another user on the same process): the first
// response that sends windows only marks where the session starts, and the
// session shows and counts the windows that come after it.
export function measureReducer(
  state: MeasureState,
  action: MeasureAction
): MeasureState {
  switch (action.type) {
    case 'start':
      return state.vote === action.vote
        ? state
        : initialMeasureState(action.now, action.vote);
    case 'not_found':
      return { ...state, phase: 'not_found', invalid: true };
    case 'error':
      return { ...state, phase: 'error' };
    case 'response': {
      const { response } = action;
      const base =
        state.instance !== null && state.instance !== response.instance
          ? initialMeasureState(action.now, state.vote)
          : state;
      const next: MeasureState = {
        ...base,
        phase: response.validator === null ? 'not_found' : 'ok',
        response,
        instance: response.instance,
      };
      const recent = response.validator?.recent ?? [];
      const lastSeq = base.lastSeq;
      if (lastSeq === null) {
        return sendsWindows(response)
          ? { ...next, lastSeq: newestSeq(recent, 0) }
          : next;
      }
      const fresh = recent.filter((window) => window.seq > lastSeq);
      return {
        ...next,
        lastSeq: newestSeq(fresh, lastSeq),
        windows: [...base.windows, ...fresh].slice(-KEPT_WINDOWS),
        totals: fresh.reduce(addWindow, base.totals),
      };
    }
  }
}

export function measureUrl(vote: string): string {
  return `/api/measure?vote=${encodeURIComponent(vote)}`;
}

const INITIAL = initialMeasureState(0);

// Polls /api/measure every MEASURE.measurePollMs while `vote` is set and the
// tab is visible (spec §6.2). Unmounting, a null vote or a hidden tab stop
// it; the session survives a hidden tab. A vote account the server rejected
// (400) is not asked for again, not even when the tab shows again.
export function useMeasure(vote: string | null): MeasureState {
  const visible = usePageVisible();
  const [state, dispatch] = useReducer(measureReducer, INITIAL);
  const rejected = state.invalid && state.vote === vote;

  useEffect(() => {
    if (vote === null || !visible || rejected) return;
    dispatch({ type: 'start', vote, now: Date.now() });

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const tick = async (): Promise<void> => {
      try {
        const response = await fetch(measureUrl(vote), {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (response.status === 400) {
          // An invalid vote account stays invalid: no next tick.
          dispatch({ type: 'not_found' });
          return;
        } else if (!response.ok) {
          dispatch({ type: 'error' });
        } else {
          const body = (await response.json()) as MeasureResponse;
          if (cancelled) return;
          dispatch({ type: 'response', response: body, now: Date.now() });
        }
      } catch {
        if (cancelled) return;
        dispatch({ type: 'error' });
      }
      timer = setTimeout(tick, MEASURE.measurePollMs);
    };

    void tick();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [vote, visible, rejected]);

  return state;
}
