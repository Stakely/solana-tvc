'use client';

import { FC, useEffect, useState } from 'react';
import { Icon, Tooltip } from '@/app/components/ui';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Pixel } from '@/app/components/utils/Measures.ts';

type HelpTooltipProps = {
  // One-line help (spec Appendix A.2); also the icon's accessible name.
  text: string;
  size?: Pixel;
};

// The help icon of ClusterAvg, with one tooltip background everywhere
// (background['04']: white text reaches WCAG AA contrast on it).
// The tooltip is controlled: it opens on hover, on keyboard focus and on a
// tap (MUI's own touch mode needs a long press), and closes on leave, on
// blur, on Escape or on a click elsewhere.
// WCAG 1.4.13: the pointer can move from the icon onto the tooltip, and
// Escape closes it wherever the focus is. React sends mouse enter and leave
// along the component tree, portals included, so the wrapper is left only
// when the pointer is off both the icon and the tooltip, which MUI renders
// in a portal. The wrapper draws no box (display: contents).
export const HelpTooltip: FC<HelpTooltipProps> = ({ text, size = '18px' }) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <span style={{ display: 'contents' }} onMouseLeave={() => setOpen(false)}>
      <Tooltip
        content={text}
        backgroundColor={colors.background['04']}
        isVisible={open}
        onClickAway={() => setOpen(false)}
      >
        <span
          role={'img'}
          aria-label={text}
          tabIndex={0}
          onMouseEnter={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}
          style={{ display: 'flex', cursor: 'help' }}
        >
          <Icon name={'help'} size={size} />
        </span>
      </Tooltip>
    </span>
  );
};
