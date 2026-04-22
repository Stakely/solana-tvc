'use client';

import { FC } from 'react';
import { Snapshot } from '@/types/snapshot.ts';
import { formatLamportsToSol } from '@/app/utils.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Surface, Text, Tooltip } from '@/app/components/ui';

type ClusterAvgProps = {
  snapshot: Snapshot | null;
};
export const ClusterAvg: FC<ClusterAvgProps> = ({ snapshot }) => {
  const { colors } = useTheme();

  const topStakeVersion = snapshot
    ? Object.entries(snapshot.stakeByVersion).reduce((best, [v, s]) =>
        BigInt(s.currentActiveStake) > BigInt(best[1].currentActiveStake)
          ? [v, s]
          : best
      )[0]
    : '-';
  const topDelegatorsVersion = snapshot
    ? Object.entries(snapshot.stakeByVersion).reduce((best, [v, s]) =>
        s.currentValidators > best[1].currentValidators ? [v, s] : best
      )[0]
    : '-';

  return (
    <Surface
      width={'100%'}
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
              content={`${snapshot?.averageSkipRate?.toFixed(2)}%`}
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
        <div className={'w-full flex gap-30 items-center'}>
          <div className={'flex-col gap-15'} style={{ width: '33%' }}>
            <div className={'w-full flex items-center gap-5'}>
              <Text content={'Top stake version: '} />
              <Tooltip
                content={'Version with the higher % of stake.'}
                backgroundColor={colors.background['03']}
              >
                <Icon name={'help'} size={'18px'} />
              </Tooltip>
            </div>
            <Text
              color={colors.background['02']}
              content={`${topStakeVersion}`}
            />
          </div>
          <div className={'flex-col gap-15'} style={{ width: '67%' }}>
            <div className={'w-full flex items-center gap-5'}>
              <Text content={'Top validators version: '} />
              <Tooltip
                content={
                  'Version with the higher number of validators using it.'
                }
                backgroundColor={colors.background['03']}
              >
                <Icon name={'help'} size={'18px'} />
              </Tooltip>
            </div>
            <Text
              color={colors.background['02']}
              content={topDelegatorsVersion}
            />
          </div>
          <div className={'flex-col gap-15'} />
        </div>
      </div>
    </Surface>
  );
};
