import { ChangeEvent, FC } from 'react';
import { TextField as MUIITextField } from '@mui/material';
import React from 'react';
import { Pixel, Rem } from '@/app/components/utils/Measures.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';

type TextFieldProps = {
  /**
   * Current value of the text field.
   * Used to control the input from a parent component.
   * Optional, but required if using the component as a controlled input.
   */
  value?: string;

  /**
   * Label displayed above the input when it's active or focused.
   * If not provided, the input will not display a label.
   */
  label?: string;

  /**
   * Callback function triggered on input value change.
   * Receives the trimmed string value from the input.
   * If not provided, the input will not update any external model.
   */
  updateModel?: (value: string) => void;

  /**
   * Hex or theme-based color used for the underline when input is inactive.
   * Falls back to theme background '03' if not provided.
   */
  inactiveColor?: string;

  /**
   * Hex or theme-based color used for the underline when the input is focused.
   * Falls back to theme primary '02' if not provided.
   */
  activeColor?: string;

  /**
   * Hex or theme-based color used for the underline on hover.
   * Falls back to theme background '00' if not provided.
   */
  hoverColor?: string;

  /**
   * Text color for the input value.
   * Falls back to theme background '00' if not provided.
   */
  textColor?: string;

  /**
   * Placeholder text displayed inside the text field when it's empty.
   * Helps the user understand the expected input format.
   */
  placeholder?: string;

  fontSize?: Pixel | Rem;
};

/**
 * `TextField` is a customizable wrapper around MUI’s `TextField` with full theme support.
 * It allows consistent visual styles and behavior across the app, including colored underline
 * states (inactive, active, hover) and a controlled input model.
 *
 * ## Features
 * - Controlled input via `value` and `updateModel`
 * - Customizable underline colors for inactive, active, and hover states
 * - Themed text styling for input content and placeholder
 * - Optional label and placeholder
 *
 * ## Example (controlled input)
 * ```tsx
 * const [name, setName] = useState('');
 *
 * <TextField
 *   label="Name"
 *   value={name}
 *   updateModel={setName}
 *   placeholder="Enter your name"
 * />
 * ```
 *
 * ## Example (custom colors)
 * ```tsx
 * <TextField
 *   value="read-only"
 *   inactiveColor="#888"
 *   activeColor="#42A5F5"
 *   hoverColor="#FFF"
 *   textColor="#EEE"
 * />
 * ```
 */
export const TextField: FC<TextFieldProps> = ({
  value,
  label,
  updateModel,
  inactiveColor,
  activeColor,
  hoverColor,
  textColor,
  placeholder,
  fontSize,
}) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        marginBottom: label ? '18px' : '0',
      }}
    >
      <MUIITextField
        placeholder={placeholder}
        value={value}
        label={label}
        variant={'standard'}
        sx={{
          width: '100%',
          '& input::placeholder': {
            opacity: 1,
            fontStyle: 'italic',
            fontSize: fontSize ?? '16px',
            fontWeight: 400,
            fontFamily: 'Plus Jakarta Sans',
            color: colors.background['03'],
          },
          '& .MuiInput-root': {
            color: textColor ?? colors.background['00'],
            fontFamily: 'Plus Jakarta Sans',
            fontSize: '1rem',
            fontWeight: 700,
            '&:before': {
              borderBottomColor: inactiveColor ?? colors.background['03'],
            },
            '&:hover:not(.Mui-disabled):before': {
              borderBottomColor: hoverColor ?? colors.background['00'],
            },
            '&:after': {
              borderBottomColor: activeColor ?? colors.primary['02'],
            },
          },
          '& .MuiInputLabel-root': {
            fontFamily: 'Plus Jakarta Sans',
            fontSize: fontSize ?? '1rem',
            color: inactiveColor ?? colors.background['03'],
            transition: 'all 0.2s ease-out',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: inactiveColor ?? colors.background['03'],
            fontSize: fontSize ?? '1rem',
            transform: 'translateY(50px)',
          },
          '& .MuiInputLabel-shrink': {
            color: inactiveColor ?? colors.background['03'],
            fontSize: fontSize ?? '1rem',
            transform: 'translateY(50px)',
          },
        }}
        onChange={(event: ChangeEvent) => {
          if (!updateModel) {
            return;
          }
          updateModel(
            (event.target as unknown as { value: string }).value.trim()
          );
        }}
      />
    </div>
  );
};
