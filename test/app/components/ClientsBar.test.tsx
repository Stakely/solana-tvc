import { clientSegments } from '@/app/components/ClientsBar.tsx';

describe('clientSegments', () => {
  it('keeps each client its colour and folds the rest into Other, last', () => {
    const segments = clientSegments([
      { client: 'AgaveBam', validators: 357, stakePercent: 44.6 },
      { client: 'JitoLabs', validators: 139, stakePercent: 26.51 },
      { client: 'Raiku', validators: 1, stakePercent: 0.1 },
      { client: 'Unknown(28598)', validators: 1, stakePercent: 0.1 },
    ]);
    expect(segments.map((s) => [s.label, s.color])).toEqual([
      ['Agave BAM', '#199e70'],
      ['Jito', '#d95926'],
      ['Other', '#6b6b66'],
    ]);
    expect(segments[2].validators).toBe(2);
    expect(segments[2].stakePercent).toBeCloseTo(0.2, 6);
  });

  it('names a lone unlisted client instead of calling it Other', () => {
    const [segment] = clientSegments([
      { client: 'Raiku', validators: 1, stakePercent: 100 },
    ]);
    expect(segment.label).toBe('Raiku');
  });

  it('keeps the colour of a client whatever its rank', () => {
    const a = clientSegments([
      { client: 'JitoLabs', validators: 1, stakePercent: 60 },
      { client: 'Agave', validators: 1, stakePercent: 40 },
    ]);
    const b = clientSegments([
      { client: 'Agave', validators: 1, stakePercent: 70 },
      { client: 'JitoLabs', validators: 1, stakePercent: 30 },
    ]);
    const colorOf = (s: typeof a, label: string) =>
      s.find((x) => x.label === label)?.color;
    expect(colorOf(a, 'Jito')).toBe(colorOf(b, 'Jito'));
    expect(colorOf(a, 'Agave')).toBe(colorOf(b, 'Agave'));
  });
});
