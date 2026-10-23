'use client';

import { FC, useState } from 'react';
import { Snapshot, VersionData } from '@/types/snapshot.ts';
import { InclusionGraph } from '@/app/components/InclusionGraph.tsx';
import { ValidatorInfo } from '@/app/components/ValidatorInfo.tsx';
import { MonitorSessionStats } from '@/app/components/MonitorSessionStats.tsx';
import { MeasurementBanner } from '@/app/components/MeasurementBanner.tsx';
import { StatusChip } from '@/app/components/StatusChip.tsx';
import { useAnalytics, useIsMobile } from '@/app/hooks';
import { MeasureState, useMeasure } from '@/app/hooks/use-measure.tsx';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Button, Icon, Text } from '@/app/components/ui';
import { getRgba } from '@/app/components/theme/design-system.ts';
import { Surface } from '@/app/components/ui/Surface.tsx';
import { MONITOR_TEXT, statusHelp } from '@/app/components/measure-texts.ts';
import { MeasureResponse } from '@/types/measure.ts';

type ValidatorMonitorProps = {
  // The monitor follows the vote account (spec §6.2).
  vote: string;
  snapshot: Snapshot | null;
  versions: Array<VersionData>;
  onBackClicked: () => void;
};

// Under review or in the migration epoch the server sends no windows and
// reports "measuring" (spec §4.8, §6.5): the monitor shows no numbers then,
// not even the ones it already had.
export function numbersHidden(response: MeasureResponse | null): boolean {
  return (
    response !== null &&
    (response.measurement === 'under_review' || response.migrationEpoch)
  );
}

// What the graph says when it has no bars. A failed poll is not here: while
// the session runs it goes in the alert under the graph (a live region, and
// only once), and a stopped session retries nothing.
export function emptyGraphText(state: MeasureState, running: boolean): string {
  if (state.phase === 'not_found') return MONITOR_TEXT.notFound;
  if (numbersHidden(state.response)) return MONITOR_TEXT.hidden;
  if (!running) return MONITOR_TEXT.stopped;
  return MONITOR_TEXT.measuring;
}

type MonitorSessionProps = ValidatorMonitorProps & { onRestart: () => void };

const MonitorSession: FC<MonitorSessionProps> = ({
  vote,
  snapshot,
  versions,
  onBackClicked,
  onRestart,
}) => {
  const { sendEvent } = useAnalytics();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [running, setRunning] = useState<boolean>(true);
  // Polling stops on Stop, on unmount (Back) and while the tab is hidden.
  const measure = useMeasure(running ? vote : null);

  const validator = snapshot?.validators.find(
    (v) => v.voteAccountPubkey === vote
  );
  const validatorName =
    validator?.info?.info.name ?? validator?.identityPubkey ?? vote;
  const validatorVersion = versions.find(
    (v) => v.version === validator?.version
  );
  const response = measure.response;
  const hidden = numbersHidden(response);
  const status = response?.validator?.status ?? null;
  // Hidden numbers turn every status into "measuring"; delinquent stays real.
  const shownStatus = hidden && status !== 'delinquent' ? null : status;
  const notFound = measure.phase === 'not_found';
  // With or without bars; after Stop nothing is retried, so no alert.
  const pollFailed = running && measure.phase === 'error';

  const onControlButtonClicked = () => {
    if (running) {
      sendEvent('monitor_stopped', { vote });
      setRunning(false);
      return;
    }
    sendEvent('monitor_started', { vote });
    onRestart();
  };

  const notice = (text: string) => (
    <div
      role={'alert'}
      className="w-full flex items-center content-center gap-5 p-t-5"
    >
      <Icon
        name={'exclamationMark'}
        color={colors.secondary.yellowMedium}
        size={'18px'}
      />
      <Text color={colors.secondary.yellowMedium} content={text} />
    </div>
  );

  return (
    <div className={'w-full flex-col gap-15 items-center content-center'}>
      <div className={'flex w-full items-center space-between gap-10'}>
        <div className={'flex w-full flex-wrap items-center gap-10'}>
          <Button
            onClick={onBackClicked}
            reduced
            label={'Back'}
            background={getRgba(colors.background['03'], 0.1)}
            icon={'leftArrow'}
            onHoverTextColor={colors.background['00']}
            onHoverColor={getRgba(colors.background['03'], 0.3)}
          />
          <Text
            weight={700}
            content={notFound ? validatorName : `Measuring ${validatorName}`}
          />
          {shownStatus && !notFound && (
            <StatusChip
              status={shownStatus}
              minMeasurableStake={response?.minMeasurableStake ?? null}
            />
          )}
        </div>
        <div className={'flex items-center content-end'}>
          <Button
            background={
              running ? colors.secondary.redMedium : colors.background['04']
            }
            onHoverTextColor={
              running ? colors.secondary.redMedium : colors.background['04']
            }
            onHoverColor={
              running ? colors.secondary.yellowLow : colors.background['01']
            }
            icon={running ? 'pause' : 'start'}
            label={running ? 'Stop session' : 'Start new session'}
            reduced
            onClick={onControlButtonClicked}
          />
        </div>
      </div>
      <MeasurementBanner
        measurement={response?.measurement}
        migrationEpoch={response?.migrationEpoch}
        epoch={response?.epoch}
        clusterAlert={response?.cluster?.alert}
      />
      <Surface
        width={'100%'}
        padding={'20px'}
        border={true}
        borderColor={colors.background['03']}
        opacity={0.75}
      >
        <InclusionGraph
          windows={hidden ? [] : measure.windows}
          emptyText={emptyGraphText(measure, running)}
        />
        {shownStatus === 'not_voting' && notice(statusHelp('not_voting', null))}
        {pollFailed && notice(MONITOR_TEXT.error)}
      </Surface>
      <div className={`w-full ${isMobile ? 'flex-col' : 'flex'} gap-15`}>
        <ValidatorInfo
          vote={vote}
          snapshot={snapshot}
          version={validatorVersion}
        />
        <MonitorSessionStats
          totals={measure.totals}
          startedAt={measure.startedAt}
          running={running}
          hidden={hidden}
        />
      </div>
    </div>
  );
};

// "Start new session" remounts the session, so its measurement state starts
// from scratch.
export const ValidatorMonitor: FC<ValidatorMonitorProps> = (props) => {
  const [session, setSession] = useState<number>(0);
  return (
    <MonitorSession
      key={session}
      {...props}
      onRestart={() => setSession((current) => current + 1)}
    />
  );
};
