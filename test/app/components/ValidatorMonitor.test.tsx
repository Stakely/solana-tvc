import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  ValidatorMonitor,
  emptyGraphText,
} from '@/app/components/ValidatorMonitor.tsx';
import {
  MONITOR_TEXT,
  migrationNotice,
  statusHelp,
} from '@/app/components/measure-texts.ts';
import {
  MeasureState,
  initialMeasureState,
} from '@/app/hooks/use-measure.tsx';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { MeasureResponse } from '@/types/measure.ts';
import {
  OTHER_IDENTITY,
  OTHER_VOTE,
  VOTE,
  clearUmami,
  inclusionWindow,
  jsonResponse,
  measureResponse,
  mockFetch,
  mockUmami,
  renderUi,
  setVisibility,
  snapshot,
  validator,
} from '../support/fixtures.tsx';

// The other validator comes first: the monitor must not take validators[0].
const twoValidators = () =>
  snapshot([
    validator({
      voteAccountPubkey: OTHER_VOTE,
      identityPubkey: OTHER_IDENTITY,
      info: undefined,
    }),
    validator(),
  ]);

const renderMonitor = () =>
  renderUi(
    <ValidatorMonitor
      vote={VOTE}
      snapshot={twoValidators()}
      versions={[]}
      onBackClicked={jest.fn()}
    />
  );

const bars = () => screen.queryAllByTestId('inclusion-bar');
const COUNTED_IN_ALL = /^Counted in 10 of 10 blocks/;

// A failed poll: the server answers 500.
const SERVER_ERROR = 500;

// One reply per poll, in order; the last one repeats. A number is an HTTP
// error status.
const respondInTurn = (...replies: Array<MeasureResponse | number>) => {
  let calls = 0;
  return mockFetch(() => {
    const reply = replies[Math.min(calls++, replies.length - 1)];
    return typeof reply === 'number'
      ? jsonResponse({ error: 'unavailable' }, reply)
      : jsonResponse(reply);
  });
};

const underReview = () =>
  measureResponse(
    { measurement: 'under_review', cluster: null, coverageSeconds: 0 },
    { status: 'measuring', last5m: null, recent: [] }
  );

// The session's first response only marks where the session starts:
// the windows it brings ended before the monitor opened. A server with no
// windows yet sends none.
const noWindowsYet = () => measureResponse({}, { recent: [] });

// Fake timers: the next poll comes measurePollMs later.
const nextPoll = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(MEASURE.measurePollMs);
  });

describe('ValidatorMonitor', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => {
    jest.useRealTimers();
    clearUmami();
  });

  it('follows the vote account and draws the server windows', async () => {
    jest.useFakeTimers();
    const fetchMock = respondInTurn(noWindowsYet(), measureResponse());
    renderMonitor();
    expect(screen.getByText('Measuring Puffin Validator')).toBeInTheDocument();
    expect(screen.getByText('Puffin Validator')).toBeInTheDocument();
    // The status chip comes with the first response.
    expect(await screen.findByText('OK')).toBeInTheDocument();
    expect(bars()).toHaveLength(0);

    await nextPoll();
    expect(
      await screen.findAllByRole('img', { name: COUNTED_IN_ALL })
    ).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/measure?vote=${VOTE}`);
  });

  it('says so when the vote account is unknown', async () => {
    mockFetch(() => jsonResponse(measureResponse({ validator: null })));
    renderMonitor();
    expect(await screen.findByText(MONITOR_TEXT.notFound)).toBeInTheDocument();
    // Not "Measuring …": the title is the name alone (ValidatorInfo has it too).
    expect(screen.queryByText('Measuring Puffin Validator')).toBeNull();
    expect(screen.getAllByText('Puffin Validator')).toHaveLength(2);
  });

  it('hides the numbers it already had once the measurement is under review', async () => {
    jest.useFakeTimers();
    respondInTurn(
      noWindowsYet(),
      measureResponse(),
      measureResponse(
        { measurement: 'under_review', cluster: null, coverageSeconds: 0 },
        { status: 'measuring', last5m: null, recent: [] }
      )
    );
    renderMonitor();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    await nextPoll();
    await waitFor(() => expect(bars()).toHaveLength(2));
    expect(document.body).toHaveTextContent('Votes counted: 100.00%');

    await nextPoll();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Measurement under review'
    );
    expect(bars()).toHaveLength(0);
    expect(screen.getByText(MONITOR_TEXT.hidden)).toBeInTheDocument();
    expect(screen.queryByText(MONITOR_TEXT.measuring)).toBeNull();
    // No "Measuring" status chip ("Not enough data yet") under the banner.
    expect(screen.queryByText('Measuring')).toBeNull();
    expect(document.body).toHaveTextContent('Votes counted: —');
    expect(document.body).toHaveTextContent('Missed: —');
  });

  it('shows the migration notice without a status or numbers', async () => {
    mockFetch(() =>
      jsonResponse(
        measureResponse(
          { epoch: 1064, migrationEpoch: true, cluster: null, coverageSeconds: 0 },
          {
            status: 'measuring',
            last5m: null,
            epochRatio: null,
            epochRatioState: 'unavailable',
            recent: [],
          }
        )
      )
    );
    renderMonitor();
    // The status region is there, empty, before the first response: wait for
    // the text, not for the region.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        migrationNotice(1064)
      )
    );
    expect(screen.getByText(MONITOR_TEXT.hidden)).toBeInTheDocument();
    expect(screen.queryByText(MONITOR_TEXT.measuring)).toBeNull();
    expect(screen.queryByText('Measuring')).toBeNull();
  });

  it('warns when the validator is not voting', async () => {
    mockFetch(() =>
      jsonResponse(measureResponse({}, { status: 'not_voting', offlineRun: 40 }))
    );
    renderMonitor();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      statusHelp('not_voting', null)
    );
  });

  it('keeps the bars on Stop and starts a fresh session on Start', async () => {
    jest.useFakeTimers();
    const track = mockUmami();
    const fetchMock = respondInTurn(
      noWindowsYet(),
      measureResponse(),
      // The new session's first poll: windows 1 and 2 came before it.
      measureResponse(),
      measureResponse(
        {},
        { recent: [1, 2, 3, 4].map((seq) => inclusionWindow(seq)) }
      )
    );
    renderMonitor();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    await nextPoll();
    await waitFor(() => expect(bars()).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }));
    expect(track).toHaveBeenCalledWith('monitor_stopped', { vote: VOTE });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bars()).toHaveLength(2);
    expect(document.body).toHaveTextContent('Votes counted: 100.00%');

    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));
    expect(track).toHaveBeenCalledWith('monitor_started', { vote: VOTE });
    expect(bars()).toHaveLength(0);
    expect(screen.getByText(MONITOR_TEXT.measuring)).toBeInTheDocument();
    // The fresh session has no response yet, so no status chip.
    expect(screen.queryByText('OK')).toBeNull();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bars()).toHaveLength(0);
    expect(document.body).toHaveTextContent('Votes counted: —');

    await nextPoll();
    await waitFor(() => expect(bars()).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', { name: 'Stop session' })).toBeInTheDocument();
  });

  it('announces a failed poll in an alert, also before the first bar', async () => {
    jest.useFakeTimers();
    respondInTurn(SERVER_ERROR, noWindowsYet());
    renderMonitor();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      MONITOR_TEXT.error
    );
    // Said once, in the alert: the graph keeps saying it is measuring.
    expect(screen.getAllByText(MONITOR_TEXT.error)).toHaveLength(1);
    expect(screen.getByText(MONITOR_TEXT.measuring)).toBeInTheDocument();
    expect(bars()).toHaveLength(0);

    // The next poll gets an answer: the alert goes.
    await nextPoll();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(MONITOR_TEXT.error)).toBeNull();
  });

  it('says a failed poll once while the numbers are hidden', async () => {
    jest.useFakeTimers();
    respondInTurn(
      noWindowsYet(),
      measureResponse(),
      underReview(),
      SERVER_ERROR
    );
    renderMonitor();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    await nextPoll();
    await waitFor(() => expect(bars()).toHaveLength(2));
    await nextPoll();
    expect(screen.getByText(MONITOR_TEXT.hidden)).toBeInTheDocument();

    await nextPoll();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      MONITOR_TEXT.error
    );
    expect(screen.getAllByText(MONITOR_TEXT.error)).toHaveLength(1);
    // The graph still says why it shows no bars.
    expect(screen.getByText(MONITOR_TEXT.hidden)).toBeInTheDocument();
    expect(bars()).toHaveLength(0);
  });

  it('stops saying it is retrying once the session is stopped', async () => {
    jest.useFakeTimers();
    const fetchMock = respondInTurn(SERVER_ERROR);
    renderMonitor();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      MONITOR_TEXT.error
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(MONITOR_TEXT.error)).toBeNull();
    expect(screen.getByText(MONITOR_TEXT.stopped)).toBeInTheDocument();
    // And indeed nothing is retried.
    const calls = fetchMock.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('drops the error alert on Stop and keeps the bars', async () => {
    jest.useFakeTimers();
    respondInTurn(noWindowsYet(), measureResponse(), SERVER_ERROR);
    renderMonitor();
    expect(await screen.findByText('OK')).toBeInTheDocument();
    await nextPoll();
    await waitFor(() => expect(bars()).toHaveLength(2));

    await nextPoll();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      MONITOR_TEXT.error
    );
    expect(screen.getAllByText(MONITOR_TEXT.error)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(MONITOR_TEXT.error)).toBeNull();
    expect(bars()).toHaveLength(2);
  });
});

describe('emptyGraphText', () => {
  const state = (extra: Partial<MeasureState>): MeasureState => ({
    ...initialMeasureState(0, VOTE),
    ...extra,
  });

  it('leaves a failed poll to the alert', () => {
    expect(emptyGraphText(state({ phase: 'error' }), true)).toBe(
      MONITOR_TEXT.measuring
    );
    expect(emptyGraphText(state({ phase: 'error' }), false)).toBe(
      MONITOR_TEXT.stopped
    );
    expect(
      emptyGraphText(state({ phase: 'error', response: underReview() }), true)
    ).toBe(MONITOR_TEXT.hidden);
  });
});
