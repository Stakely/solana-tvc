'use client';

import { useEffect, useState } from 'react';
import { DataProvider, useData } from '@/app/providers/data.tsx';
import {
  ClusterAvg,
  EpochInfo,
  MeasurementBanner,
  ValidatorMonitor,
  ValidatorsInfo,
  VersionInfo,
} from '@/app/components';
import { versionsToRows } from '@/types/snapshot.ts';
import { useAnalytics } from '@/app/hooks';
import { useIsMobile } from '@/app/hooks/is-mobile.tsx';

export const dynamic = 'force-dynamic';

function Home() {
  const isMobile = useIsMobile();
  const { sendEvent } = useAnalytics();
  const {
    epoch,
    snapshot,
    meta,
    totalValidators,
    currentPage,
    pubKeyFilter,
    setCurrentPage,
    setPubKeyFilter,
    orderCriteria,
    setOrderCriteria,
  } = useData();

  const versions = snapshot ? versionsToRows(snapshot.stakeByVersion) : [];
  // The monitor follows the vote account: an identity switch keeps it.
  const [measuredVote, setMeasuredVote] = useState<string | null>(null);

  const onMeasureClicked = (vote: string) => {
    setMeasuredVote(vote);
    setPubKeyFilter(vote);
    sendEvent('monitoring_started', { vote });
  };

  useEffect(() => {
    sendEvent('home_seen', {});
  }, []);
  return (
    <div className={'w-full flex-col gap-20 p-b-20'}>
      {/* Side by side, both cards take the height of the taller one. */}
      <div
        className={`w-full ${isMobile ? 'flex-col items-center' : 'flex'} content-center gap-15`}
        style={isMobile ? undefined : { alignItems: 'stretch' }}
      >
        <EpochInfo epoch={epoch} />
        <ClusterAvg snapshot={snapshot} cluster={meta?.cluster ?? null} />
      </div>

      {measuredVote === null && (
        <MeasurementBanner
          measurement={meta?.measurement}
          migrationEpoch={meta?.migrationEpoch}
          epoch={meta?.epoch}
          clusterAlert={meta?.cluster?.alert}
        />
      )}

      <div className={'w-full flex'}>
        {measuredVote === null && (
          <ValidatorsInfo
            snapshot={snapshot}
            meta={meta}
            totalValidators={totalValidators}
            pubKeyFilter={pubKeyFilter}
            currentPage={currentPage}
            orderCriteria={orderCriteria}
            setCurrentPageAction={setCurrentPage}
            setPubKeyFilterAction={setPubKeyFilter}
            setOrderCriteriaAction={setOrderCriteria}
            onValidatorMonitorAction={onMeasureClicked}
          />
        )}
        {measuredVote !== null && (
          <ValidatorMonitor
            vote={measuredVote}
            versions={versions}
            snapshot={snapshot}
            onBackClicked={() => {
              setMeasuredVote(null);
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

// The data polling lives here, not in the root layout, so other pages do not
// poll the API.
export default function Page() {
  return (
    <DataProvider>
      <Home />
    </DataProvider>
  );
}
