'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Epoch } from '@/types/epoch.ts';
import { ProgressBar } from '@/app/components/ProgressBar.tsx';
import { useAnimatedBigInt, useAnimatedNumber, useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Surface, Text } from '@/app/components/ui';

type EpochInfoProps = {
  epoch: Epoch | null;
};

const SLOT_MS = 400;

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
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!epoch) return;
    if (
      typeof epoch.slotIndex !== 'number' ||
      typeof epoch.slotsInEpoch !== 'number'
    )
      return;

    const remainingSlots = Math.max(0, epoch.slotsInEpoch - epoch.slotIndex);
    const remainingMs = remainingSlots * SLOT_MS;

    initializedRef.current = true;
    setDeadlineMs(Date.now() + remainingMs);
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
