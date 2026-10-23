import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import Page from '@/app/page.tsx';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  OTHER_IDENTITY,
  OTHER_VOTE,
  VOTE,
  clearUmami,
  epochFixture,
  jsonResponse,
  measureResponse,
  mockFetch,
  mockUmami,
  renderUi,
  setVisibility,
  snapshotResponse,
  validator,
} from './support/fixtures.tsx';

// Puffin (VOTE) is the second row: the monitor must follow the clicked one.
const handler = (url: string) => {
  if (url === '/api/epoch') return jsonResponse(epochFixture());
  if (url.startsWith('/api/measure')) return jsonResponse(measureResponse());
  return jsonResponse(
    snapshotResponse([
      validator({
        voteAccountPubkey: OTHER_VOTE,
        identityPubkey: OTHER_IDENTITY,
        info: undefined,
        ranking: 1,
      }),
      validator({ ranking: 2 }),
    ])
  );
};

const urlsOf = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([url]) => String(url));

describe('home page', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => {
    jest.useRealTimers();
    clearUmami();
  });

  it('measures the clicked validator by its vote account', async () => {
    const track = mockUmami();
    const fetchMock = mockFetch(handler);
    renderUi(<Page />);
    expect(track).toHaveBeenCalledWith('home_seen', {});
    const measureButtons = await screen.findAllByRole('button', {
      name: 'Measure',
    });
    fireEvent.click(measureButtons[1]);

    expect(track).toHaveBeenCalledWith('monitoring_started', { vote: VOTE });
    expect(
      await screen.findByText('Measuring Puffin Validator')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(urlsOf(fetchMock)).toContain(`/api/measure?vote=${VOTE}`)
    );
    expect(urlsOf(fetchMock)).toContain(
      `/api/snapshot?page=1&size=10&identity=${VOTE}`
    );
  });

  it('stops measuring when the monitor closes', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(handler);
    renderUi(<Page />);
    const measureButtons = await screen.findAllByRole('button', {
      name: 'Measure',
    });
    fireEvent.click(measureButtons[1]);
    await waitFor(() =>
      expect(urlsOf(fetchMock)).toContain(`/api/measure?vote=${VOTE}`)
    );

    const callsBeforeBack = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    const after = urlsOf(fetchMock).slice(callsBeforeBack);
    expect(after.find((url) => url.startsWith('/api/snapshot'))).toBe(
      '/api/snapshot?page=1&size=10&identity='
    );
    expect(after.filter((url) => url.startsWith('/api/measure'))).toEqual([]);
  });
});
