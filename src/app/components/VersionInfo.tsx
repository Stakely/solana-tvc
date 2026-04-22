'use client';

import { FC, useState } from 'react';
import { VersionData } from '@/types/snapshot.ts';
import { formatLamportsToSol } from '@/app/utils.ts';
import { useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Button, Surface, Text } from '@/app/components/ui';

type VersionInfoProps = {
  versions: Array<VersionData>;
};

export const VersionInfo: FC<VersionInfoProps> = ({ versions }) => {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [showMore, setShowMore] = useState<boolean>(false);

  const mainVersions = versions.splice(0, 3);
  const versionsToShow = showMore ? versions : mainVersions;

  return (
    <Surface
      width={'100%'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-30'}>
        <Text variant={'h3'} content={'Stats by version'} />
        {versionsToShow.map((v) => (
          <div
            key={`key-${v.version}`}
            className={'w-full flex flex-col gap-20 p-8 bg-translucent'}
            style={{
              borderRadius: '12px',
            }}
          >
            <div className={'w-full flex space-between'}>
              <div className={'w-full flex-col items-center'}>
                <Text content={'Version'} />
                <Text
                  content={v.version}
                  weight={700}
                  color={colors.primary['03']}
                />
              </div>
              <div className={'w-full flex-col items-center'}>
                <Text content={'Validators'} />
                <Text
                  content={v.currentValidators.toString()}
                  color={colors.background['02']}
                />
              </div>
              <div className={'w-full flex-col items-center'}>
                <Text content={'Validators %'} />
                <Text
                  content={`${v.currentValidatorsPercent.toFixed(2)}%`}
                  color={colors.background['02']}
                />
              </div>
              {!isMobile && (
                <>
                  <div className={'w-full flex-col items-center'}>
                    <Text content={'Total stake'} />
                    <Text
                      content={`${formatLamportsToSol(v.currentActiveStake.toString())}`}
                      color={colors.background['02']}
                    />
                  </div>
                  <div className={'w-full flex-col items-center'}>
                    <Text content={'Stake %'} />
                    <Text
                      content={`${v.stakePercent.toFixed(2)}%`}
                      color={colors.background['02']}
                    />
                  </div>
                </>
              )}
            </div>
            {isMobile && (
              <div className={'w-full flex space-between'}>
                <div className={'w-full flex-col items-center'}>
                  <Text content={'Total stake'} />
                  <Text
                    content={`${formatLamportsToSol(v.currentActiveStake.toString())}`}
                    color={colors.background['02']}
                  />
                </div>
                <div className={'w-full flex-col items-center'}>
                  <Text content={'Stake %'} />
                  <Text
                    content={`${v.stakePercent.toFixed(2)}%`}
                    color={colors.background['02']}
                  />
                </div>
              </div>
            )}
            <div className={'w-full flex space-between'}>
              <div className={'w-full flex-col items-center'}>
                <Text content={'Delinquent validators'} />
                <Text
                  content={v.delinquentValidators.toString()}
                  color={colors.background['02']}
                />
              </div>
              {!isMobile && (
                <div className={'w-full flex-col items-center'}>
                  <Text content={'Delinquent stake'} />
                  <Text
                    content={formatLamportsToSol(v.delinquentStake.toString())}
                    color={colors.background['02']}
                  />
                </div>
              )}
              <div className={'w-full flex-col items-center'}>
                <Text content={'Delinquent stake %'} />
                <Text
                  content={`${v.delinquentPercent.toFixed(2)}%`}
                  color={colors.background['02']}
                />
              </div>
              {!isMobile && (
                <>
                  <div className={'w-full flex-col items-center'} />
                  <div className={'w-full flex-col items-center'} />
                </>
              )}
            </div>
          </div>
        ))}
        {!showMore && (
          <div className={'flex w-full items-center content-center'}>
            <Button
              label={'Show all versions'}
              onClick={() => setShowMore(true)}
            />
          </div>
        )}
      </div>
    </Surface>
  );
};
