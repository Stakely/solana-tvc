import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import { StakelyTheme } from '@/app/components/theme/design-system.ts';
import { renderUi, setViewportWidth } from '../support/fixtures.tsx';

const TEXT = 'Shown on demand';
const icon = () => screen.getByRole('img', { name: TEXT });

// Waits longer than the tooltip's exit transition (MUI: 200 ms): a tooltip
// that has started to close is gone by the time the test looks again.
const outlastExit = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });

describe('HelpTooltip', () => {
  afterEach(() => setViewportWidth(1024));

  it('names the icon after its text and shows the text on hover', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.mouseOver(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.mouseLeave(icon());
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('opens with the keyboard and closes on Escape', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    expect(icon()).toHaveAttribute('tabindex', '0');
    fireEvent.focus(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.keyDown(icon(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('opens on a tap on a phone', async () => {
    setViewportWidth(375);
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.click(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
  });

  it('always uses the help background', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.focus(icon());
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.querySelector('.MuiTooltip-tooltip')).toHaveStyle({
      backgroundColor: StakelyTheme.colors.background['04'],
    });
  });

  it('closes when the icon loses focus', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.focus(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.blur(icon());
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('closes on a tap elsewhere', async () => {
    setViewportWidth(375);
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.click(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  // WCAG 1.4.13, hoverable. MUI renders the tooltip in a portal, outside the
  // icon's DOM tree, so the pointer leaves the icon to reach it.
  it('stays open while the pointer moves from the icon onto the tooltip', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.mouseOver(icon());
    const tooltip = await screen.findByRole('tooltip');
    fireEvent.mouseOut(icon(), { relatedTarget: tooltip });
    fireEvent.mouseOver(tooltip, { relatedTarget: icon() });
    await outlastExit();
    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXT);
    fireEvent.mouseLeave(tooltip);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  // WCAG 1.4.13, dismissible: a tooltip opened by the pointer closes on
  // Escape although the icon does not have the focus.
  it('closes on Escape wherever the focus is, and only on Escape', async () => {
    renderUi(<HelpTooltip text={TEXT} />);
    fireEvent.mouseOver(icon());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    expect(icon()).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    await outlastExit();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});
