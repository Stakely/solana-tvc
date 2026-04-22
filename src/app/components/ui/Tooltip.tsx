import React, { FC, ReactNode } from 'react';
import { ClickAwayListener, Tooltip as MUITooltip } from '@mui/material';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Text } from '@/app/components';

type TooltipProps = {
  /**
   * The content to be displayed inside the tooltip.
   * Can be a string or a custom ReactNode for rich content.
   */
  content: ReactNode | string;

  /**
   * Controls whether the tooltip is visible.
   * If true, the tooltip is shown; if false, it is hidden.
   * @default undefined (controlled externally)
   */
  isVisible?: boolean;

  /**
   * Callback triggered when the user clicks outside of the tooltip.
   * Useful for closing tooltips manually controlled via `isVisible`.
   * @default () => {}
   */
  onClickAway?: () => void;

  /**
   * The element that triggers the tooltip.
   * Typically, a React element like a button, icon, or text.
   */
  children: ReactNode;

  /**
   * Optional background color for the tooltip.
   * If not provided, a default theme-based color will be used.
   */
  backgroundColor?: string;
};

/**
 * `Tooltip` is a wrapper component that displays additional content when the user interacts with its child.
 * It leverages Material UI's tooltip system with support for custom content, colors, and visibility control.
 **
 * ## Features
 * - Supports both **controlled** (`isVisible`) and **automatic** visibility (via MUI defaults).
 * - Customizable background color via `backgroundColor`.
 * - Custom content rendering: plain text or JSX.
 * - Click-away handling via `onClickAway`.

 * ## Example (simple usage)
 * ```tsx
 * <Tooltip content="This is a tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 * ```

 * ## Example (controlled visibility)
 * ```tsx
 * const [open, setOpen] = useState(true);
 *
 * <Tooltip
 *   content="Manual control"
 *   isVisible={open}
 *   onClickAway={() => setOpen(false)}
 * >
 *   <IconButton onClick={() => setOpen(true)} />
 * </Tooltip>
 * ```

 * ## Example (custom JSX content)
 * ```tsx
 * <Tooltip
 *   content={<div><b>Custom</b> content<br />with formatting</div>}
 * >
 *   <span>Hover me</span>
 * </Tooltip>
 * ```
 */
export const Tooltip: FC<TooltipProps> = ({
  isVisible,
  content,
  children,
  onClickAway = () => {},
  backgroundColor,
}) => {
  const { colors } = useTheme();
  const getContent = () => {
    if (typeof content === 'string') {
      return <Text variant={'body2'} content={content} />;
    }

    return content;
  };
  return (
    <ClickAwayListener onClickAway={() => onClickAway()}>
      <div>
        <MUITooltip
          title={getContent()}
          open={isVisible}
          slotProps={{
            tooltip: {
              sx: {
                backgroundColor: backgroundColor ?? colors.primary['01'],
                color: backgroundColor ?? colors.primary['01'],
                padding: '14px 16px',
                fontSize: '0.875rem',
                borderRadius: '15px',
                fontFamily: 'Plus Jakarta Sans',
              },
            },
          }}
        >
          <div>{children}</div>
        </MUITooltip>
      </div>
    </ClickAwayListener>
  );
};
