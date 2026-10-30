import { act, screen, waitFor } from '@testing-library/react';
import { HowWeMeasure } from '@/app/how-we-measure/HowWeMeasure.tsx';
import { metadata } from '@/app/how-we-measure/page.tsx';
import {
  FetchHandler,
  jsonResponse,
  mockFetch,
  renderUi,
  snapshotResponse,
  validator,
} from '../support/fixtures.tsx';

// The page starts with the vague text, so seeing it proves nothing by itself:
// wait for the one request, then let every promise it started settle.
async function settle(fetchMock: ReturnType<typeof mockFetch>): Promise<void> {
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(fetchMock).toHaveBeenCalledTimes(1);
}

describe('How we measure', () => {
  it('renders the method with the thresholds and the current minimum stake', async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(
        snapshotResponse([validator()], { minMeasurableStake: '612000000000' })
      )
    );
    renderUi(<HowWeMeasure />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'How we measure' })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/below about 600 SOL today/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/counted in at least 98% of paying blocks/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/any of its last 32 or more paying blocks/)
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/snapshot?size=1');
  });

  // The HTTP error carries a real stake in its body, so a page that read the
  // body without checking the status would show "about 600 SOL".
  it.each<[string, FetchHandler]>([
    [
      'the API answers with an HTTP error',
      () =>
        jsonResponse(
          snapshotResponse([validator()], {
            minMeasurableStake: '612000000000',
          }),
          500
        ),
    ],
    [
      'the request fails',
      () => Promise.reject(new TypeError('Failed to fetch')),
    ],
    ['the response has no minimum stake', () => jsonResponse({})],
    [
      'the minimum stake is null',
      () =>
        jsonResponse(
          snapshotResponse([validator()], { minMeasurableStake: null })
        ),
    ],
    ['the response body is null', () => jsonResponse(null)],
  ])('stays vague about the minimum stake when %s', async (_case, handler) => {
    const fetchMock = mockFetch(handler);
    renderUi(<HowWeMeasure />);
    await settle(fetchMock);
    expect(
      screen.getByText(/below a few hundred SOL today/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/below about/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'How we measure' })
    ).toBeInTheDocument();
  });

  it('has its own title', () => {
    expect(metadata.title).toBe(
      'How we measure - Solana Vote Inclusion Tracker'
    );
  });
});
