import { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { StatusChip, statusColor } from '@/app/components/StatusChip.tsx';
import { NOT_MEASURABLE_TEXT_COLOR } from '@/app/components/inclusion-palette.ts';
import { STATUS_LABEL } from '@/app/components/measure-texts.ts';
import { StakelyTheme } from '@/app/components/theme/design-system.ts';
import Providers from '@/app/providers/providers.tsx';
import { InclusionStatus } from '@/types/measure.ts';
import { contrast, over, paint } from '../support/contrast.ts';
import { renderUi } from '../support/fixtures.tsx';

const STATUSES = Object.keys(STATUS_LABEL) as InclusionStatus[];

// The site theme (providers.tsx), which the pages use, and the default one.
const THEMES: Array<[string, (ui: ReactElement) => void]> = [
  ['site theme', (ui) => render(<Providers>{ui}</Providers>)],
  ['default theme', (ui) => renderUi(ui)],
];

describe('StatusChip', () => {
  it('shows the status with its Appendix A.2 help', () => {
    renderUi(
      <StatusChip status={'not_measurable'} minMeasurableStake={'612000000000'} />
    );
    expect(screen.getByText('Not measurable')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Stake below about 600 SOL: too small to learn its reward per block reliably.',
      })
    ).toBeInTheDocument();
  });

  it('colours OK green and Not voting red', () => {
    const colors = StakelyTheme.colors;
    expect(statusColor(colors, 'ok')).toBe(colors.secondary.greenMedium);
    expect(statusColor(colors, 'not_voting')).toBe(colors.secondary.redMedium);
  });

  it('colours Missing votes amber, Delinquent red and the unmeasured ones apart', () => {
    const colors = StakelyTheme.colors;
    expect(statusColor(colors, 'missing')).toBe(colors.secondary.yellowMedium);
    expect(statusColor(colors, 'delinquent')).toBe(colors.secondary.redMedium);
    expect(statusColor(colors, 'measuring')).toBe(colors.background['02']);
    expect(statusColor(colors, 'not_measurable')).toBe(
      NOT_MEASURABLE_TEXT_COLOR
    );
  });
});

// WCAG 1.4.3: the labels are 13 px bold, which is not large text, so they
// need 4.5:1. The chip paints its own opaque background, so the ratio does
// not depend on what lies behind it: the table surface, the mobile cards or
// the page gradient behind the monitor header.
describe.each(THEMES)('StatusChip contrast, %s', (_theme, renderChip) => {
  it.each(STATUSES)('keeps the %s label at 4.5:1 or more', (status) => {
    renderChip(
      <StatusChip status={status} minMeasurableStake={'612000000000'} />
    );
    const label = screen.getByText(STATUS_LABEL[status]);
    const chip = label.parentElement as HTMLElement;
    const background = paint(chip.style.backgroundColor);
    expect(background.alpha).toBe(1);
    const text = over(background.rgb, paint(label.style.color));
    expect(contrast(text, background.rgb)).toBeGreaterThanOrEqual(4.5);
  });
});
