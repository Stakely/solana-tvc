/**
 * Smoke tests: @mui/material and @emotion, rendered.
 *
 * Renders the MUI components the app imports (Pagination, Tooltip,
 * ClickAwayListener, TextField, Button) and an emotion-styled element, so an
 * upgrade that breaks rendering or styling fails here rather than in the UI.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Button,
  ClickAwayListener,
  Pagination,
  PaginationItem,
  TextField,
  Tooltip,
} from '@mui/material';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';

describe('@mui/material', () => {
  test('renders Pagination with custom PaginationItem and reports page changes', () => {
    const onChange = jest.fn();
    render(
      <Pagination
        count={3}
        onChange={onChange}
        renderItem={(item) => <PaginationItem {...item} />}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 2);
  });

  test('renders Button, TextField and Tooltip', () => {
    render(
      <Tooltip title="hint">
        <Button>Refresh</Button>
      </Tooltip>
    );
    render(<TextField label="Validator" defaultValue="vote" />);

    // Tooltip names its child after the title for assistive technology
    expect(screen.getByRole('button', { name: 'hint' })).toHaveTextContent(
      'Refresh'
    );
    expect(screen.getByLabelText('Validator')).toHaveValue('vote');
  });

  test('ClickAwayListener fires when clicking outside its child', async () => {
    const onClickAway = jest.fn();
    render(
      <div>
        <ClickAwayListener onClickAway={onClickAway}>
          <span>inside</span>
        </ClickAwayListener>
        <span>outside</span>
      </div>
    );

    // It only starts listening on the tick after mounting
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByText('inside'));
    expect(onClickAway).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('outside'));
    expect(onClickAway).toHaveBeenCalledTimes(1);
  });
});

describe('@emotion', () => {
  test('styled applies its styles to the rendered element', () => {
    const Box = styled.div`
      color: rgb(255, 0, 0);
    `;
    render(<Box>styled</Box>);
    expect(getComputedStyle(screen.getByText('styled')).color).toBe(
      'rgb(255, 0, 0)'
    );
  });

  test('exports css and keyframes', () => {
    expect(typeof css).toBe('function');
    expect(typeof keyframes).toBe('function');
  });
});
