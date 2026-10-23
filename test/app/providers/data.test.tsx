import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Providers from '@/app/providers/providers.tsx';
import {
  DataProvider,
  orderAvailable,
  snapshotUrl,
  useData,
} from '@/app/providers/data.tsx';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  VOTE,
  epochFixture,
  jsonResponse,
  meta,
  mockFetch,
  renderUi,
  setVisibility,
  snapshotResponse,
  validator,
} from '../support/fixtures.tsx';

function Probe() {
  const data = useData();
  return (
    <div>
      <span data-testid={'validators'}>
        {data.snapshot?.validators.map((v) => v.voteAccountPubkey).join(',') ??
          ''}
      </span>
      <span data-testid={'instance'}>{data.meta?.instance ?? ''}</span>
      <span data-testid={'order'}>{data.orderCriteria ?? 'default'}</span>
      <span data-testid={'epoch'}>{data.epoch?.epoch ?? ''}</span>
      <button onClick={() => data.setPubKeyFilter('a&b c')}>{'filter'}</button>
      <button onClick={() => data.setOrderCriteria('epochRatio')}>
        {'order'}
      </button>
      <button onClick={() => data.setOrderCriteria('inclusion')}>
        {'order by inclusion'}
      </button>
      <button onClick={() => data.setCurrentPage(2)}>{'page 2'}</button>
    </div>
  );
}

const renderProvider = () =>
  renderUi(
    <DataProvider>
      <Probe />
    </DataProvider>
  );

const snapshotCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith('/api/snapshot'));

describe('snapshotUrl', () => {
  it('encodes every parameter and sends the order only when picked', () => {
    expect(snapshotUrl(2, 10, 'a&b c', 'epochRatio')).toBe(
      '/api/snapshot?page=2&size=10&identity=a%26b%20c&orderCriteria=epochRatio'
    );
    expect(snapshotUrl(1, 10, '', null)).toBe(
      '/api/snapshot?page=1&size=10&identity='
    );
  });
});

describe('orderAvailable', () => {
  const measuringMeta = meta({ measuring: true, inclusionCoverageSeconds: 60 });

  it('offers votes counted only while the snapshot carries it', () => {
    expect(orderAvailable('inclusion', measuringMeta)).toBe(true);
    expect(orderAvailable('inclusion', meta())).toBe(false);
  });

  it('hides the measured orders under review and keeps only stake in the migration epoch', () => {
    const review = meta({ measuring: true, measurement: 'under_review' });
    expect(orderAvailable('epochRatio', meta())).toBe(true);
    expect(orderAvailable('epochRatio', review)).toBe(false);
    expect(orderAvailable('inclusion', review)).toBe(false);
    const migration = meta({ migrationEpoch: true });
    expect(orderAvailable('stake', migration)).toBe(true);
    expect(orderAvailable('epochRatio', migration)).toBe(false);
    expect(orderAvailable('stake', null)).toBe(true);
    expect(orderAvailable('epochRatio', null)).toBe(false);
  });
});

describe('DataProvider', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => {
    jest.useRealTimers();
    setVisibility('visible');
  });

  it('stores the snapshot, its measurement fields and the epoch', async () => {
    mockFetch((url) =>
      url === '/api/epoch'
        ? jsonResponse(epochFixture())
        : jsonResponse(snapshotResponse([validator()], { instance: 'abc' }))
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('abc')
    );
    expect(screen.getByTestId('validators')).toHaveTextContent(VOTE);
    expect(screen.getByTestId('epoch')).toHaveTextContent('1065');
  });

  it('survives network errors', async () => {
    mockFetch((url) => {
      if (url === '/api/epoch') throw new TypeError('Failed to fetch');
      return jsonResponse(snapshotResponse([validator()]));
    });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('test')
    );
    expect(screen.getByTestId('epoch')).toBeEmptyDOMElement();
  });

  it('polls every measurePollMs and pauses while the tab is hidden', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch((url) =>
      url === '/api/epoch'
        ? jsonResponse(epochFixture())
        : jsonResponse(snapshotResponse([validator()]))
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('test')
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    act(() => setVisibility('hidden'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MEASURE.measurePollMs);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Async act: the poll that resumes lands inside act.
    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });

  it('ignores a response that arrives after a newer request', async () => {
    let releaseFirst: (response: Response) => void = () => undefined;
    mockFetch((url) => {
      if (url === '/api/epoch') return jsonResponse(epochFixture());
      if (url.endsWith('identity=')) {
        return new Promise<Response>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return jsonResponse(
        snapshotResponse([validator({ voteAccountPubkey: 'B' })])
      );
    });
    renderProvider();
    fireEvent.click(screen.getByText('filter'));
    await waitFor(() =>
      expect(screen.getByTestId('validators')).toHaveTextContent('B')
    );
    await act(async () => {
      releaseFirst(
        jsonResponse(snapshotResponse([validator({ voteAccountPubkey: 'A' })]))
      );
    });
    expect(screen.getByTestId('validators')).toHaveTextContent(/^B$/);
  });

  it('sends the picked order, and drops it in the migration epoch', async () => {
    const fetchMock = mockFetch((url) =>
      url === '/api/epoch'
        ? jsonResponse(epochFixture())
        : jsonResponse(
            snapshotResponse([validator()], {
              migrationEpoch: url.includes('orderCriteria='),
            })
          )
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('test')
    );
    expect(snapshotCalls(fetchMock)).toEqual([
      '/api/snapshot?page=1&size=10&identity=',
    ]);
    fireEvent.click(screen.getByText('order'));
    await waitFor(() =>
      expect(snapshotCalls(fetchMock)).toContain(
        '/api/snapshot?page=1&size=10&identity=&orderCriteria=epochRatio'
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId('order')).toHaveTextContent('default')
    );
  });

  it('drops a picked order the server can no longer rank', async () => {
    // Nobody measures: the snapshot has no inclusionCoverageSeconds.
    const fetchMock = mockFetch((url) =>
      url === '/api/epoch'
        ? jsonResponse(epochFixture())
        : jsonResponse(snapshotResponse([validator()]))
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('test')
    );
    fireEvent.click(screen.getByText('order by inclusion'));
    await waitFor(() =>
      expect(snapshotCalls(fetchMock)).toContain(
        '/api/snapshot?page=1&size=10&identity=&orderCriteria=inclusion'
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId('order')).toHaveTextContent('default')
    );
    await waitFor(() =>
      expect(snapshotCalls(fetchMock).at(-1)).toBe(
        '/api/snapshot?page=1&size=10&identity='
      )
    );
  });

  it('asks for the picked page and goes back to page 1 on a new filter', async () => {
    const fetchMock = mockFetch((url) =>
      url === '/api/epoch'
        ? jsonResponse(epochFixture())
        : jsonResponse(snapshotResponse([validator()]))
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('instance')).toHaveTextContent('test')
    );
    fireEvent.click(screen.getByText('page 2'));
    await waitFor(() =>
      expect(snapshotCalls(fetchMock)).toContain(
        '/api/snapshot?page=2&size=10&identity='
      )
    );
    fireEvent.click(screen.getByText('filter'));
    await waitFor(() =>
      expect(snapshotCalls(fetchMock).at(-1)).toBe(
        '/api/snapshot?page=1&size=10&identity=a%26b%20c'
      )
    );
  });
});

describe('Providers', () => {
  it('no longer polls the API: the data provider wraps only the home page', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <Providers>
          <Probe />
        </Providers>
      )
    ).toThrow('useData() must be used within DataProvider');
    jest.restoreAllMocks();
  });
});
