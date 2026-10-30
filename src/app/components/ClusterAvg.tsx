'use client';

import { FC } from 'react';
import { Snapshot } from '@/types/snapshot.ts';
import { ClusterView } from '@/types/measure.ts';
import { formatLamportsToSol, formatPercent } from '@/app/utils.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Surface, Text } from '@/app/components/ui';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import { HELP } from '@/app/components/measure-texts.ts';

type ClusterAvgProps = {
  snapshot: Snapshot | null;
  // Last window of the measurement; null until the first one is measured.
  cluster?: ClusterView | null;
};

export const ClusterAvg: FC<ClusterAvgProps> = ({ snapshot, cluster }) => {
  const { colors } = useTheme();

  return (
    <Surface
      width={'100%'}
      // auto, not the default 100%: the row stretches both cards to the
      // taller one.
      height={'auto'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-30'}>
        <Text variant={'h3'} content={'Cluster stats'} />
        <div className={'w-full flex gap-30 items-center'}>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Skip rate avg: '} />
            <Text
              color={colors.background['02']}
              content={
                snapshot ? `${snapshot.averageSkipRate.toFixed(2)}%` : '-'
              }
            />
          </div>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Active stake: '} />
            <Text
              color={colors.background['02']}
              content={formatLamportsToSol(snapshot?.totalActiveStake ?? '0')}
            />
          </div>
          <div className={'flex-col gap-15 w-full'}>
            <Text content={'Delinquent stake: '} />
            <Text
              color={colors.background['02']}
              content={formatLamportsToSol(
                snapshot?.totalDelinquentStake ?? '0'
              )}
            />
          </div>
        </div>
        {/* Always there, "…" until the first interval: the card keeps its
            height when the measurement starts. */}
        <div className={'w-full flex gap-30 items-center'}>
            <div className={'flex-col gap-15 w-full'}>
              <div className={'w-full flex items-center gap-5'}>
                <Text content={'Paying blocks (last interval): '} />
                <HelpTooltip text={HELP.clusterPayable} />
              </div>
              <Text
                color={colors.background['02']}
                content={cluster ? String(cluster.payable) : '…'}
              />
            </div>
            <div className={'flex-col gap-15 w-full'}>
              <div className={'w-full flex items-center gap-5'}>
                <Text content={'Stake that missed (last interval): '} />
                <HelpTooltip text={HELP.clusterMissed} />
              </div>
              <Text
                color={
                  cluster?.alert
                    ? colors.secondary.yellowMedium
                    : colors.background['02']
                }
                content={
                  cluster ? formatPercent(cluster.stakeShareMissed, 1) : '…'
                }
              />
            </div>
          </div>
      </div>
    </Surface>
  );
};
