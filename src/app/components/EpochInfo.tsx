'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Epoch } from '@/types/epoch.ts';
import { ProgressBar } from '@/app/components/ProgressBar.tsx';
import { useAnimatedBigInt, useAnimatedNumber, useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Surface, Text } from '@/app/components/ui';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  SlotSample,
  addReading,
  addSlotSample,
  isSlotSample,
  slotSeconds,
} from '@/app/components/slot-time.ts';

type EpochInfoProps = {
  epoch: Epoch | null;
};

function msToHms(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export const EpochInfo: FC<EpochInfoProps> = ({ epoch }) => {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const samples = useRef<SlotSample[]>([]);
  // The last readings of /api/epoch, samples or not: the polling rhythm.
  const readings = useRef<SlotSample[]>([]);
  // The epoch the countdown is anchored on.
  const anchoredEpoch = useRef<number | null>(null);
  // Last measured slot time: kept when the samples expire (hidden tab).
  const measuredSlotSeconds = useRef<number>(MEASURE.fallbackSlotSeconds);

  // Runs on every reading: the data provider sets a new `epoch` object on
  // each poll. A new sample measures the slot time and re-anchors the
  // countdown; the first reading and a new epoch re-anchor it too, even when
  // they are not samples (see isSlotSample). A reading after a pause in the
  // same epoch does not: it may be stale, and the deadline is absolute.
  useEffect(() => {
    if (!epoch) return;
    const slot = Number(epoch.absoluteSlot);
    if (!Number.isFinite(slot)) return;
    const now = Date.now();
    const reading: SlotSample = { t: now, slot };
    const before = samples.current;
    if (isSlotSample(readings.current, reading)) {
      samples.current = addSlotSample(samples.current, reading);
      measuredSlotSeconds.current = slotSeconds(
        samples.current,
        measuredSlotSeconds.current
      );
    }
    readings.current = addReading(readings.current, reading);
    const newSample = samples.current !== before;
    if (!newSample && anchoredEpoch.current === epoch.epoch) return;
    anchoredEpoch.current = epoch.epoch;
    const remainingSlots = Math.max(0, epoch.slotsInEpoch - epoch.slotIndex);
    setDeadlineMs(
      now + Math.round(remainingSlots * measuredSlotSeconds.current * 1_000)
    );
    setNowMs(now);
  }, [epoch]);

  useEffect(() => {
    if (deadlineMs == null) return;

    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const remainingMs = deadlineMs == null ? 0 : Math.max(0, deadlineMs - nowMs);
  const remainingHms = useMemo(() => msToHms(remainingMs), [remainingMs]);

  const animatedSlotIndex = useAnimatedNumber(epoch?.slotIndex ?? 0, 1500);
  const animatedTransactionCount = useAnimatedBigInt(
    epoch?.transactionCount ?? '0',
    1500
  );
  return (
    <Surface
      width={'100%'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-30'}>
        <Text variant={'h3'} content={'Epoch info'} />
        <div className={'w-full flex gap-30 items-center space-between'}>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Current Epoch: '} />
            <Text
              color={colors.background['02']}
              content={epoch?.epoch?.toString()}
            />
          </div>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Completed slots: '} />
            <Text
              color={colors.background['02']}
              content={`${animatedSlotIndex}/${epoch?.slotsInEpoch}`}
            />
          </div>
          {!isMobile && (
            <>
              <div className={'flex-col gap-15 w-full'}>
                <Text content={'Epoch Progress: '} />
                <ProgressBar value={epoch?.epochCompletedPercent ?? 0} />
              </div>
            </>
          )}
        </div>
        <div className={'w-full flex gap-30 items-center space-between'}>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Transactions: '} />
            <Text
              color={colors.background['02']}
              content={animatedTransactionCount}
            />
          </div>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Time left (est.): '} />
            <Text color={colors.background['02']} content={remainingHms} />
          </div>
          {!isMobile && <div className={'flex-col gap-15 w-full'}></div>}
        </div>
        {isMobile && (
          <div className={'w-full flex gap-30 items-center space-between'}>
            <div className={'flex-col gap-15 w-full'}>
              <Text content={'Epoch Progress: '} />
              <ProgressBar value={epoch?.epochCompletedPercent ?? 0} />
            </div>
          </div>
        )}
      </div>
    </Surface>
  );
};
