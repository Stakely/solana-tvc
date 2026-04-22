'use client';

import { FC, useEffect, useMemo, useState } from 'react';
import { Delta } from '@/app/components/ValidatorMonitor.tsx';
import { useAnimatedNumber } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Surface, Text } from '@/app/components/ui';

type MonitorStatsProps = {
  notVoting: boolean;
  deltas: Array<Delta>;
  startedAt: Date;
  isStopped: boolean;
};

export const MonitorSessionStats: FC<MonitorStatsProps> = ({
  notVoting,
  deltas,
  startedAt,
  isStopped,
}) => {
  const { colors } = useTheme();
  const [elapsedMs, setElapsedMs] = useState<number>(
    () => Date.now() - startedAt.getTime()
  );

  useEffect(() => {
    if (isStopped) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.getTime());
    }, 1000);

    return () => clearInterval(id);
  }, [startedAt, isStopped]);

  const elapsedHms = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [elapsedMs]);

  const sessionStartSlot = deltas.length
    ? Math.min(...deltas.map((d) => d.to))
    : 0;
  const sessionLastSampleSlot = deltas.length
    ? Math.max(...deltas.map((d) => d.to))
    : 0;
  const sessionLostCredits = deltas.length
    ? deltas.slice(1).reduce((sum, d) => sum + d.lostCredits, 0)
    : 0;

  const sessionSlots = Math.max(sessionLastSampleSlot - sessionStartSlot, 0);
  const maxCredits = Math.max(sessionSlots * 16, 0);
  const sessionEarnedCredits = Math.max(maxCredits - sessionLostCredits, 0);

  const animatedSlots = useAnimatedNumber(sessionSlots, 650);
  const animatedEarned = useAnimatedNumber(sessionEarnedCredits, 650);
  const animatedMissed = useAnimatedNumber(sessionLostCredits, 650);

  const creditsPerSlotAvg = sessionEarnedCredits / sessionSlots;

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
            <Text variant={'h3'} content={'Monitor session stats'} />
            <Text
              variant={'body1'}
              content={`Session time: <b>${elapsedHms}</b>`}
            />
          </div>
          <div className={'w-full flex-col gap-10'}>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Session start slot: <b>${sessionStartSlot}</b>`}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Last sample slot: <b>${sessionLastSampleSlot}</b>`}
              />
              {notVoting && (
                <Icon
                  name={'exclamationMark'}
                  color={colors.secondary.yellowMedium}
                  size={'18px'}
                />
              )}
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Session credits earned: <b>${animatedEarned}</b>`}
              />
              {notVoting && (
                <Icon
                  name={'exclamationMark'}
                  color={colors.secondary.yellowMedium}
                  size={'18px'}
                />
              )}
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Session credits missed: <b>${animatedMissed}</b>`}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Session duration slots: <b>${animatedSlots}</b>`}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Session avg.: <b>${isNaN(creditsPerSlotAvg) ? '-' : creditsPerSlotAvg.toFixed(4)}</b>`}
              />
              {notVoting && (
                <Icon
                  name={'exclamationMark'}
                  color={colors.secondary.yellowMedium}
                  size={'18px'}
                />
              )}
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
};
