import { getJson } from '@/app/get-json.ts';
import { jsonResponse, mockFetch } from './support/fixtures.tsx';

describe('getJson', () => {
  it('returns the parsed body of a successful response', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ value: 7 }));
    expect(await getJson<{ value: number }>('/api/thing')).toEqual({
      value: 7,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks for fresh JSON with a GET', async () => {
    const fetchMock = mockFetch(() => jsonResponse({}));
    await getJson('/api/thing');
    // mockFetch types its mock with the URL only; the call has two arguments.
    expect(fetchMock.mock.calls).toEqual([
      [
        '/api/thing',
        {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          cache: 'no-store',
        },
      ],
    ]);
  });

  it('returns null for an HTTP error, even when the body has data', async () => {
    mockFetch(() => jsonResponse({ value: 7 }, 503));
    expect(await getJson('/api/thing')).toBeNull();
  });

  it('returns null when the request fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await getJson('/api/thing')).toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    mockFetch(
      () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON');
          },
        }) as unknown as Response
    );
    expect(await getJson('/api/thing')).toBeNull();
  });
});
