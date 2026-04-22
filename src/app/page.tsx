'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/app/providers/data.tsx';
import {
  ClusterAvg,
  EpochInfo,
  ValidatorMonitor,
  ValidatorsInfo,
  VersionInfo,
} from '@/app/components';
import { versionsToRows } from '@/types/snapshot.ts';
import { useAnalytics } from '@/app/hooks';
import { useIsMobile } from '@/app/hooks/is-mobile.tsx';

export const dynamic = 'force-dynamic';

export default function Home() {
  const isMobile = useIsMobile();
  const { sendEvent } = useAnalytics();
  const {
    epoch,
    snapshot,
    totalValidators,
    currentPage,
    pubKeyFilter,
    setCurrentPage,
    setPubKeyFilter,
  } = useData();

  const versions = snapshot ? versionsToRows(snapshot.stakeByVersion) : [];
  const [monitoringValidator, setMonitoringValidator] = useState<string | null>(
    null
  );

  const onMonitoringValidatorClicked = (identity: string) => {
    setMonitoringValidator(identity);
    setPubKeyFilter(identity);
    sendEvent('monitoring_started', { identity });
  };

  useEffect(() => {
    sendEvent('home_seen', {});
  }, []);
  return (
    <div className={'w-full flex-col gap-20 p-b-20'}>
      <div
        className={`w-full ${isMobile ? 'flex-col' : 'flex'} items-center content-center gap-15`}
      >
        <EpochInfo epoch={epoch} />
        <ClusterAvg snapshot={snapshot} />
      </div>

      <div className={'w-full flex'}>
        {!monitoringValidator && (
          <ValidatorsInfo
            snapshot={snapshot}
            totalValidators={totalValidators}
            pubKeyFilter={pubKeyFilter}
            currentPage={currentPage}
            setCurrentPageAction={setCurrentPage}
            setPubKeyFilterAction={setPubKeyFilter}
            onValidatorMonitorAction={onMonitoringValidatorClicked}
          />
        )}
        {monitoringValidator && (
          <ValidatorMonitor
            versions={versions}
            snapshot={snapshot}
            onBackClicked={() => {
              setMonitoringValidator('');
              setPubKeyFilter('');
            }}
          />
        )}
      </div>
      <div className={'w-full flex'}>
        <VersionInfo versions={versions} />
      </div>
    </div>
  );
}
