'use client';

import { FC } from 'react';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Text } from '@/app/components/ui';
import { VersionData } from '@/types/snapshot.ts';
import { clientLabel } from '@/app/client-label.ts';

type Client = VersionData['clients'][number];

// Each client keeps its colour in every version (the colour follows the
// client, not its rank). Dark steps of the validated categorical palette,
// checked against the card surface: adjacent CVD ΔE >= 8.4. The green is
// below 3:1 on the card, so every colour also has its label and numbers in
// the legend.
const CLIENT_COLORS: Record<string, string> = {
  Agave: '#3987e5',
  JitoLabs: '#d95926',
  AgaveBam: '#199e70',
  HarmonicAgave: '#c98500',
  Firedancer: '#d55181',
  HarmonicFiredancer: '#008300',
  Rakurai: '#9085e9',
  FireBAM: '#e66767',
};
const OTHER_COLOR = '#6b6b66';
const OTHER = 'Other';

// Clients with a colour of their own; the rest (unknown ids, small new
// clients) add up to Other, last.
export function clientSegments(
  clients: Client[]
): Array<Client & { label: string; color: string }> {
  const named = clients.filter((c) => CLIENT_COLORS[c.client]);
  const rest = clients.filter((c) => !CLIENT_COLORS[c.client]);
  const segments = named.map((c) => ({
    ...c,
    label: clientLabel(c.client),
    color: CLIENT_COLORS[c.client],
  }));
  if (rest.length > 0) {
    segments.push({
      client: OTHER,
      label: rest.length === 1 ? clientLabel(rest[0].client) || OTHER : OTHER,
      validators: rest.reduce((sum, c) => sum + c.validators, 0),
      stakePercent: rest.reduce((sum, c) => sum + c.stakePercent, 0),
      color: OTHER_COLOR,
    });
  }
  return segments;
}

const describe = (s: { label: string; stakePercent: number; validators: number }) =>
  `${s.label}: ${s.stakePercent.toFixed(2)}% of the stake, ${s.validators} validator${s.validators === 1 ? '' : 's'}`;

// The share of a version's current stake that runs each client, as one
// 100% bar with a legend below.
export const ClientsBar: FC<{ clients: Client[] }> = ({ clients }) => {
  const { colors } = useTheme();
  const segments = clientSegments(clients);
  return (
    <div className={'w-full flex-col gap-10'}>
      <Text content={'Clients (share of stake)'} />
      <div
        role={'img'}
        aria-label={segments.map(describe).join('; ')}
        style={{ display: 'flex', gap: 2, width: '100%', height: 12 }}
      >
        {/* The browser's own tooltip (title): a Tooltip component wraps its
            child in a box with no width, which hid the bar. */}
        {segments.map((s, i) => (
          <div
            key={s.client}
            title={describe(s)}
            style={{
              flexGrow: s.stakePercent,
              flexBasis: 0,
              minWidth: 2,
              height: '100%',
              background: s.color,
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === segments.length - 1 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div className={'w-full flex flex-wrap items-center gap-15'}>
        {segments.map((s) => (
          <div key={s.client} className={'flex items-center gap-5'}>
            <span
              aria-hidden={'true'}
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 3,
                background: s.color,
              }}
            />
            <Text variant={'littleBody'} content={s.label} />
            <Text
              variant={'littleBody'}
              color={colors.background['02']}
              content={`${s.stakePercent.toFixed(2)}% · ${s.validators}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
