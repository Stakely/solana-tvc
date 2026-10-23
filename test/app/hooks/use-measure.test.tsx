import { act, renderHook, waitFor } from '@testing-library/react';
import {
  EMPTY_TOTALS,
  KEPT_WINDOWS,
  MeasureAction,
  initialMeasureState,
  measureReducer,
  measureUrl,
  useMeasure,
} from '@/app/hooks/use-measure.tsx';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { InclusionWindow, MeasureResponse } from '@/types/measure.ts';
import {
  VOTE,
  inclusionWindow,
  jsonResponse,
  measureResponse,
  mockFetch,
  setVisibility,
} from '../support/fixtures.tsx';

const respond = (
  instance: string,
  recent: InclusionWindow[] = [inclusionWindow(1)],
  now = 5
): MeasureAction => ({
  type: 'response',
  now,
  response: measureResponse({ instance }, { recent }),
});

// Windows 1 to `last`, oldest first, as the server sends them.
const windowsUpTo = (last: number): InclusionWindow[] =>
  Array.from({ length: last }, (_, i) => inclusionWindow(i + 1));

const seqs = (windows: InclusionWindow[]): number[] =>
  windows.map((w) => w.seq);

describe('measureReducer', () => {
  const started = measureReducer(initialMeasureState(0), {
    type: 'start',
    vote: VOTE,
    now: 1,
  });
  // The session's first response, from a server with no windows yet.
  const primed = measureReducer(started, respond('a', []));

  it('leaves out the windows the server had before the session started', () => {
    // Someone measured on this process for 3 minutes before.
    let state = measureReducer(started, respond('a', windowsUpTo(36)));
    expect(state.phase).toBe('ok');
    expect(state.windows).toEqual([]);
    expect(state.totals).toEqual(EMPTY_TOTALS);
    expect(state.startedAt).toBe(1);

    state = measureReducer(state, respond('a', windowsUpTo(37)));
    expect(seqs(state.windows)).toEqual([37]);
    expect(state.totals.windows).toBe(1);
    expect(state.totals.firstSlot).toBe(inclusionWindow(37).fromSlot);
  });

  it('counts from the first window when the server had none', () => {
    const state = measureReducer(primed, respond('a', windowsUpTo(1)));
    expect(seqs(state.windows)).toEqual([1]);
    expect(state.totals.windows).toBe(1);
  });

  const hiddenCases: Array<[string, Partial<MeasureResponse>]> = [
    ['under review', { measurement: 'under_review' }],
    ['in the migration epoch', { migrationEpoch: true }],
  ];

  it.each(hiddenCases)(
    'marks where the session starts on the first windows sent, not %s',
    (_, hidden) => {
      // The server sends no windows then, whatever it has.
      let state = measureReducer(started, {
        type: 'response',
        now: 2,
        response: measureResponse(
          { instance: 'a', ...hidden },
          { status: 'measuring', recent: [] }
        ),
      });
      expect(state.phase).toBe('ok');
      expect(state.lastSeq).toBeNull();

      state = measureReducer(state, respond('a', windowsUpTo(36)));
      expect(state.windows).toEqual([]);
      expect(state.totals).toEqual(EMPTY_TOTALS);

      state = measureReducer(state, respond('a', windowsUpTo(37)));
      expect(seqs(state.windows)).toEqual([37]);
      expect(state.totals.windows).toBe(1);
    }
  );

  it('counts each window once across overlapping responses', () => {
    const shared = inclusionWindow(2, { included: 8, shared: true });
    let state = measureReducer(primed, respond('a', [inclusionWindow(1), shared]));
    state = measureReducer(
      state,
      respond('a', [shared, inclusionWindow(3, { kind: 'leader', included: 0 })])
    );
    expect(state.phase).toBe('ok');
    expect(state.windows.map((w) => w.seq)).toEqual([1, 2, 3]);
    expect(state.totals).toEqual({
      ...EMPTY_TOTALS,
      windows: 3,
      measured: 2,
      included: 18,
      payable: 20,
      missed: 2,
      sharedMissed: 2,
      leader: 1,
      firstSlot: 1012,
      lastSlot: 1048,
    });
  });

  it('starts a new session when the server instance changes', () => {
    let state = measureReducer(
      primed,
      respond('a', [inclusionWindow(7), inclusionWindow(8)])
    );
    expect(state.totals.windows).toBe(2);
    // The new process already had window 1 (another user measuring there):
    // it came before the new session.
    state = measureReducer(state, respond('b', [inclusionWindow(1)], 99));
    expect(state.windows).toEqual([]);
    expect(state.totals).toEqual(EMPTY_TOTALS);
    expect(state.startedAt).toBe(99);
    expect(state.instance).toBe('b');

    state = measureReducer(state, respond('b', windowsUpTo(2), 104));
    expect(seqs(state.windows)).toEqual([2]);
    expect(state.totals.windows).toBe(1);
  });

  it(`keeps the last ${KEPT_WINDOWS} windows and counts all of them`, () => {
    const many = windowsUpTo(KEPT_WINDOWS + 5);
    const state = measureReducer(primed, respond('a', many));
    expect(state.windows).toHaveLength(KEPT_WINDOWS);
    expect(state.windows[0].seq).toBe(6);
    expect(state.totals.windows).toBe(KEPT_WINDOWS + 5);
  });

  it('reports an unknown vote account as not found', () => {
    const state = measureReducer(started, {
      type: 'response',
      now: 2,
      response: measureResponse({ validator: null }),
    });
    expect(state.phase).toBe('not_found');
    // It may show up later: unlike an invalid one, it is asked for again.
    expect(state.invalid).toBe(false);
  });

  it('remembers an invalid vote account until another one starts', () => {
    const invalid = measureReducer(started, { type: 'not_found' });
    expect(invalid.phase).toBe('not_found');
    expect(invalid.invalid).toBe(true);
    expect(measureReducer(invalid, { type: 'start', vote: VOTE, now: 9 })).toBe(
      invalid
    );
    expect(
      measureReducer(invalid, { type: 'start', vote: 'other', now: 9 })
    ).toEqual(initialMeasureState(9, 'other'));
  });

  it('starts from scratch when another vote account starts', () => {
    const state = measureReducer(measureReducer(started, respond('a')), {
      type: 'start',
      vote: 'other',
      now: 50,
    });
    expect(state).toEqual(initialMeasureState(50, 'other'));
  });

  it('keeps the session when the same vote account starts again', () => {
    const state = measureReducer(started, respond('a'));
    expect(
      measureReducer(state, { type: 'start', vote: VOTE, now: 60 })
    ).toBe(state);
  });
});

// A server that already has `before` windows and publishes one more on each
// poll, as it does while someone measures.
const serverPublishingPerPoll = (before: number) => {
  let polls = 0;
  return mockFetch(() => {
    polls += 1;
    return jsonResponse(
      measureResponse({}, { recent: windowsUpTo(before + polls) })
    );
  });
};

describe('useMeasure', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => {
    jest.useRealTimers();
    setVisibility('visible');
  });

  it('does nothing without a vote account', () => {
    const fetchMock = mockFetch(() => jsonResponse(measureResponse()));
    const { result } = renderHook(() => useMeasure(null));
    expect(result.current.phase).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls every measurePollMs while visible, pauses while hidden and stops on unmount', async () => {
    jest.useFakeTimers();
    const fetchMock = serverPublishingPerPoll(0);
    const { result, unmount } = renderHook(() => useMeasure('a b'));
    await waitFor(() => expect(result.current.phase).toBe('ok'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/measure?vote=a%20b');
    // Window 1 ends as the session starts: the session counts from window 2.
    expect(result.current.windows).toEqual([]);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(seqs(result.current.windows)).toEqual([2]));

    act(() => setVisibility('hidden'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seqs(result.current.windows)).toEqual([2]);

    // A hidden tab pauses the session, it does not reset it.
    act(() => setVisibility('visible'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(seqs(result.current.windows)).toEqual([2, 3])
    );
    expect(result.current.totals.windows).toBe(2);

    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('leaves out the windows the server had before the session started', async () => {
    jest.useFakeTimers();
    // Someone measured on this process for the last 3 minutes.
    serverPublishingPerPoll(36);
    const { result } = renderHook(() => useMeasure(VOTE));
    await waitFor(() => expect(result.current.phase).toBe('ok'));
    expect(result.current.windows).toEqual([]);
    expect(result.current.totals).toEqual(EMPTY_TOTALS);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEASURE.measurePollMs);
    });
    await waitFor(() =>
      expect(seqs(result.current.windows)).toEqual([38])
    );
    expect(result.current.totals.windows).toBe(1);
  });

  it('shows an invalid vote account (400) as not found and stops asking', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(() =>
      jsonResponse({ error: 'Invalid vote account' }, 400)
    );
    const { result } = renderHook(() => useMeasure('nope'));
    await waitFor(() => expect(result.current.phase).toBe('not_found'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not ask again for an invalid vote account, not even when the tab shows again', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch((url) =>
      url === measureUrl('nope')
        ? jsonResponse({ error: 'Invalid vote account' }, 400)
        : jsonResponse(measureResponse())
    );
    const { result, rerender } = renderHook(
      ({ vote }: { vote: string | null }) => useMeasure(vote),
      { initialProps: { vote: 'nope' as string | null } }
    );
    await waitFor(() => expect(result.current.phase).toBe('not_found'));

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    // Stop, then the same vote account again.
    rerender({ vote: null });
    rerender({ vote: 'nope' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('not_found');

    // Another vote account is asked for.
    rerender({ vote: VOTE });
    await waitFor(() => expect(result.current.phase).toBe('ok'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(measureUrl(VOTE));
  });

  it('keeps asking for an unknown vote account', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(() =>
      jsonResponse(measureResponse({ validator: null }))
    );
    const { result } = renderHook(() => useMeasure(VOTE));
    await waitFor(() => expect(result.current.phase).toBe('not_found'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a network error and keeps the session', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const { result } = renderHook(() => useMeasure(VOTE));
    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.vote).toBe(VOTE);
  });
});
