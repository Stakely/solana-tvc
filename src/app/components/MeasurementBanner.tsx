'use client';

import { FC } from 'react';
import Link from 'next/link';
import { MeasurementHealth } from '@/types/measure.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Text } from '@/app/components/ui';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import {
  HELP,
  HOW_WE_MEASURE_TITLE,
  UNDER_REVIEW_TITLE,
  migrationNotice,
} from '@/app/components/measure-texts.ts';

export type BannerKind = 'under_review' | 'migration' | 'cluster';

type MeasurementBannerProps = {
  measurement?: MeasurementHealth | null;
  migrationEpoch?: boolean;
  epoch?: number | null;
  clusterAlert?: boolean;
};

// One banner at a time, the most serious first (spec §4.8, §6.5).
export function bannerKind(props: MeasurementBannerProps): BannerKind | null {
  if (props.measurement === 'under_review') return 'under_review';
  if (props.migrationEpoch) return 'migration';
  if (props.clusterAlert) return 'cluster';
  return null;
}

function bannerText(kind: BannerKind, epoch: number | null): string {
  switch (kind) {
    case 'under_review':
      return UNDER_REVIEW_TITLE;
    case 'migration':
      return migrationNotice(epoch);
    case 'cluster':
      return HELP.clusterBanner;
  }
}

// The live region is always in the page, even without a banner: screen
// readers only announce a change inside a region that was already there
// (WCAG technique ARIA22), and a banner can appear mid-session ("Measurement
// under review", the cluster banner). Without a banner it is empty and out of
// the layout flow, so it adds no gap to the column around it.
export const MeasurementBanner: FC<MeasurementBannerProps> = (props) => {
  const { colors, borderRadius } = useTheme();
  const kind = bannerKind(props);
  const color = colors.secondary.yellowMedium;

  return (
    <div
      role={'status'}
      className={
        kind === null ? undefined : 'w-full flex flex-wrap items-center gap-10'
      }
      style={
        kind === null
          ? { position: 'absolute' }
          : {
              padding: '10px 16px',
              border: `1px solid ${color}`,
              borderRadius: borderRadius.infoBox,
            }
      }
    >
      {kind !== null && (
        <>
          <Icon name={'exclamationMark'} size={'18px'} color={color} />
          <Text
            color={color}
            weight={700}
            content={bannerText(kind, props.epoch ?? null)}
          />
          {kind === 'under_review' && <HelpTooltip text={HELP.underReview} />}
          <Link href={'/how-we-measure'}>
            <Text color={color} underline content={HOW_WE_MEASURE_TITLE} />
          </Link>
        </>
      )}
    </div>
  );
};
