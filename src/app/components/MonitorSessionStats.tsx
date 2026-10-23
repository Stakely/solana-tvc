'use client';

import { FC, useEffect, useState } from 'react';
import { SessionTotals } from '@/app/hooks/use-measure.tsx';
import { useAnimatedNumber } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Surface, Text } from '@/app/components/ui';
import { formatPercent } from '@/app/utils.ts';

type MonitorSessionStatsProps = {
  totals: SessionTotals;
  // 0 until the session starts.
  startedAt: number;
  running: boolean;
  // Under review or in the migration epoch: no inclusion figures (§4.8).
  hidden?: boolean;
};

function msToHms(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Totals since the monitor opened, each server window counted once.
export const MonitorSessionStats: FC<MonitorSessionStatsProps> = ({
  totals,
  startedAt,
  running,
  hidden = false,
}) => {
  const { colors } = useTheme();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const included = useAnimatedNumber(totals.included, 650);
  const payable = useAnimatedNumber(totals.payable, 650);
  const missed = useAnimatedNumber(totals.missed, 650);
  const rate =
    !hidden && totals.payable > 0
      ? formatPercent(totals.included / totals.payable, 2)
      : '—';
  const counted = hidden ? '—' : `${included} of ${payable}`;
  const elapsed = startedAt > 0 ? msToHms(nowMs - startedAt) : '00:00:00';

  return (
    <div className={'flex w-full'}>
      <Surface
        width={'100%'}
        padding={'20px 30px'}
        border={true}
        borderColor={colors.background['03']}
        opacity={0.75}
      >
        <div className={'w-full flex-col gap-30'}>
          <div className={'w-full flex space-between items-center'}>
            <Text variant={'h3'} content={'Session'} />
            <Text content={`Session time: <b>${elapsed}</b>`} />
          </div>
          <div className={'w-full flex-col gap-10'}>
            <Text content={`Votes counted: <b>${rate}</b>`} />
            <Text
              content={`Paying blocks that included the vote: <b>${counted}</b>`}
            />
            <Text
              content={
                hidden
                  ? `Missed: <b>—</b>`
                  : `Missed: <b>${missed}</b> (shared: <b>${totals.sharedMissed}</b>)`
              }
            />
            <Text
              content={`Intervals measured: <b>${totals.measured}</b> · produced a block: <b>${totals.leader}</b> · not measured: <b>${totals.notMeasured}</b> · no paying blocks: <b>${totals.noPayingBlocks}</b>`}
            />
            <Text
              content={`Slots: <b>${totals.firstSlot ?? '—'}</b> to <b>${totals.lastSlot ?? '—'}</b>`}
            />
          </div>
        </div>
      </Surface>
    </div>
  );
};
