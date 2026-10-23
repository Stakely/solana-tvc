import { fireEvent, render, screen } from '@testing-library/react';
import { Button, Tooltip } from '@/app/components/ui';
import { ThemeProvider } from '@/app/components/theme/theme-provider.tsx';

// The ui primitives import each other by path. Through the full barrel
// ('@/app/components'), entering by '@/app/components/ui' first left Text,
// Icon and Spinner undefined under jest (CommonJS `export *` copies only the
// names defined so far).
describe('ui barrel', () => {
  it('renders a button with an icon and a text tooltip when loaded first', async () => {
    render(
      <ThemeProvider>
        <Tooltip content={'Help text'} backgroundColor={'#000000'}>
          <span>{'target'}</span>
        </Tooltip>
        <Button label={'Back'} icon={'leftArrow'} />
      </ThemeProvider>
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText('target'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Help text');
  });
});
