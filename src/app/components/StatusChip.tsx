'use client';

import { FC } from 'react';
import { InclusionStatus } from '@/types/measure.ts';
import { AppThemeColors } from '@/app/components/theme/theming.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Text } from '@/app/components/ui';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import {
  NOT_MEASURABLE_TEXT_COLOR,
  STATUS_CHIP_BACKGROUND,
} from '@/app/components/inclusion-palette.ts';
import { STATUS_LABEL, statusHelp } from '@/app/components/measure-texts.ts';

// Colour of the label and the border of a status chip. Every one keeps 4.5:1
// or more on STATUS_CHIP_BACKGROUND, in the site theme and in the default one.
export function statusColor(
  colors: AppThemeColors,
  status: InclusionStatus
): string {
  switch (status) {
    case 'ok':
      return colors.secondary.greenMedium;
    case 'missing':
      return colors.secondary.yellowMedium;
    case 'not_voting':
    case 'delinquent':
      return colors.secondary.redMedium;
    case 'measuring':
      return colors.background['02'];
    case 'not_measurable':
      return NOT_MEASURABLE_TEXT_COLOR;
  }
}

type StatusChipProps = {
  status: InclusionStatus;
  // Lamports: the "Not measurable" help shows it rounded (spec §6.6).
  minMeasurableStake: string | null;
};

// Status of spec §4.8 with its Appendix A.2 help.
export const StatusChip: FC<StatusChipProps> = ({
  status,
  minMeasurableStake,
}) => {
  const { colors, borderRadius } = useTheme();
  const color = statusColor(colors, status);
  return (
    <div className={'flex items-center gap-5'}>
      <span
        style={{
          backgroundColor: STATUS_CHIP_BACKGROUND,
          border: `1px solid ${color}`,
          borderRadius: borderRadius.chip.reduced,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
        }}
      >
        <Text
          variant={'littleBody'}
          weight={700}
          color={color}
          content={STATUS_LABEL[status]}
        />
      </span>
      <HelpTooltip text={statusHelp(status, minMeasurableStake)} size={'16px'} />
    </div>
  );
};
