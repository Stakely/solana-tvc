'use client';

import { FC, useEffect, useState } from 'react';
import { Snapshot, VersionData } from '@/types/snapshot.ts';
import { ValidatorDeltaGraph } from '@/app/components/ValidatorDeltaGraph.tsx';
import { ValidatorInfo } from '@/app/components/ValidatorInfo.tsx';
import { MonitorSessionStats } from '@/app/components/MonitorSessionStats.tsx';
import { useAnalytics, useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Button, Icon, Text } from '@/app/components/ui';
import { getRgba } from '@/app/components/theme/design-system.ts';
import { Surface } from '@/app/components/ui/Surface.tsx';

type ValidatorMonitorProps = {
  versions: Array<VersionData>;
  snapshot: Snapshot | null;
  onBackClicked: () => void;
};

const CREDITS_PER_SLOT = 16;

export type Sample = {
  lastVote: number;
  epochCredits: number;
};

export type Delta = {
  from: number;
  to: number;
  creditsFrom: number;
  creditsTo: number;
  earnedCredits: number;
  lostCredits: number;
};

export const ValidatorMonitor: FC<ValidatorMonitorProps> = ({
  snapshot,
  onBackClicked,
  versions,
}) => {
  const { sendEvent } = useAnalytics();
  const [samples, setSamples] = useState<Array<Sample>>([]);
  const [deltas, setDeltas] = useState<Array<Delta>>([]);
  const [startedAt, setStartedAt] = useState<Date>(new Date());
  const [isStopped, setStopped] = useState<boolean>(false);
  const [ticksPerSlot, setTicksPerSlot] = useState<[number, number]>([0, 0]);
  const [showNoVoting, setShowNoVoting] = useState<boolean>(false);

  const { colors } = useTheme();
  const isMobile = useIsMobile();

  const validatorIdentity = snapshot?.validators[0]?.identityPubkey ?? '';
  const validatorName =
    snapshot?.validators[0]?.info?.info.name ?? validatorIdentity;

  const validatorVersion = versions.find(
    (v) => v.version === snapshot?.validators[0]?.version
  );

  useEffect(() => {
    setStartedAt(new Date());
  }, []);
  useEffect(() => {
    if (isStopped) {
      return;
    }
    if (!snapshot) {
      return;
    }

    if (!snapshot.validators[0]) {
      return;
    }

    if (ticksPerSlot[1] > 4) {
      setShowNoVoting(true);
    } else {
      setShowNoVoting(false);
    }

    const lastVote = snapshot.validators[0].lastVote;
    setTicksPerSlot((prev) => {
      if (lastVote === prev[0]) {
        return [lastVote, prev[1] + 1];
      }

      return [lastVote, 0];
    });

    setSamples((prev) => {
      const exists = prev.find((s) => s.lastVote === lastVote);
      const isPrevious = prev.find((s) => lastVote < s.lastVote);
      if (!exists && !isPrevious) {
        return [
          ...prev,
          {
            lastVote: snapshot.validators[0].lastVote,
            epochCredits: snapshot.validators[0].epochCredits,
          },
        ];
      }

      const filtered = prev.filter((s) => s.lastVote !== lastVote);
      return [
        ...filtered,
        {
          lastVote: snapshot.validators[0].lastVote,
          epochCredits: snapshot.validators[0].epochCredits,
        },
      ];
    });
  }, [JSON.stringify(snapshot)]);

  useEffect(() => {
    if (isStopped) {
      return;
    }
    if (samples.length <= 1) return;
    const [to, from] = [...samples]
      .sort((a, b) => b.lastVote - a.lastVote)
      .slice(0, 2);

    const earnedCredits = to.epochCredits - from.epochCredits;
    const maxCredits = (to.lastVote - from.lastVote) * CREDITS_PER_SLOT;

    if (Math.abs(earnedCredits) > 1000) {
      return;
    }

    const delta: Delta = {
      from: from.lastVote,
      creditsFrom: from.epochCredits,
      to: to.lastVote,
      creditsTo: to.epochCredits,
      earnedCredits: to.epochCredits - from.epochCredits,
      lostCredits: maxCredits - earnedCredits,
    };

    setDeltas((prev) => [...prev, delta]);
  }, [JSON.stringify(samples)]);

  useEffect(() => {
    console.log(deltas);
  }, [JSON.stringify(deltas)]);

  const onControlButtonClicked = () => {
    const action: 'play' | 'stop' = isStopped ? 'play' : 'stop';

    sendEvent(action === 'play' ? 'monitor_started' : 'monitor_stopped', {
      identity: validatorIdentity,
    });
    if (action === 'play') {
      setDeltas([]);
      setSamples([]);
      setStartedAt(new Date());
      setStopped(false);
      setTicksPerSlot([0, 0]);
      return;
    }

    setStopped(true);
  };

  return (
    <div className={'w-full flex-col gap-15 items-center content-center'}>
      <div className={'flex  w-full items-center space-between'}>
        <div className={'flex  w-full items-center gap-5'}>
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
            content={`Monitoring validator ${validatorName}`}
          />
        </div>
        <div className={'w-50 flex items-center content-end'}>
          <Button
            background={
              isStopped ? colors.background['04'] : colors.secondary.redMedium
            }
            onHoverTextColor={
              isStopped ? colors.background['04'] : colors.secondary.redMedium
            }
            onHoverColor={
              isStopped ? colors.background['01'] : colors.secondary.yellowLow
            }
            icon={isStopped ? 'start' : 'pause'}
            label={isStopped ? 'Start new session' : 'Stop session'}
            reduced
            onClick={onControlButtonClicked}
          />
        </div>
      </div>
      <Surface
        width={'100%'}
        padding={'20px'}
        border={true}
        borderColor={colors.background['03']}
        opacity={0.75}
      >
        <ValidatorDeltaGraph deltas={deltas} />
        {showNoVoting && (
          <div className="w-full flex items-center content-center gap-5 p-t-5">
            <Icon
              name={'exclamationMark'}
              color={colors.secondary.yellowMedium}
              size={'18px'}
            />
            <Text
              color={colors.secondary.yellowMedium}
              content={
                'This identity is probably not voting. If you are responsible for it, you should chek it.'
              }
            />
          </div>
        )}
      </Surface>
      <div className={`w-full ${isMobile ? 'flex-col' : 'flex'} gap-15`}>
        <ValidatorInfo snapshot={snapshot} version={validatorVersion} />
        <MonitorSessionStats
          isStopped={isStopped}
          notVoting={showNoVoting}
          deltas={deltas}
          startedAt={startedAt}
        />
      </div>
    </div>
  );
};
