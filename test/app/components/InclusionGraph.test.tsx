import { fireEvent, screen, within } from '@testing-library/react';
import { InclusionGraph } from '@/app/components/InclusionGraph.tsx';
import {
  GRAPH_BACKGROUND,
  GRAPH_BORDER,
} from '@/app/components/inclusion-palette.ts';
import {
  HELP,
  MONITOR_TEXT,
  windowSlots,
  windowText,
} from '@/app/components/measure-texts.ts';
import { inclusionWindow, renderUi } from '../support/fixtures.tsx';

const barsGroup = () =>
  screen.getByRole('group', { name: MONITOR_TEXT.barsGroup });

const describeBars = () =>
  screen
    .getAllByTestId('inclusion-bar')
    .map((bar) => [
      bar.getAttribute('aria-label'),
      bar.dataset.tone,
      bar.dataset.shared,
    ]);

describe('InclusionGraph', () => {
  it('draws one bar per window, labelled with its hover text', () => {
    renderUi(
      <InclusionGraph
        emptyText={'Measuring…'}
        windows={[
          inclusionWindow(1),
          inclusionWindow(2, { included: 7, shared: true }),
          inclusionWindow(3, { included: 0 }),
          inclusionWindow(4, { kind: 'leader', included: 0 }),
          inclusionWindow(5, { kind: 'not_measured', included: 0 }),
          inclusionWindow(6, { kind: 'no_paying_blocks', payable: 0, included: 0 }),
        ]}
      />
    );
    expect(describeBars()).toEqual([
      ['Counted in 10 of 10 blocks, slots 1012–1024', 'full', 'false'],
      ['Counted in 7 of 10 blocks, slots 1024–1036', 'partial', 'true'],
      ['Counted in 0 of 10 blocks, slots 1036–1048', 'zero', 'false'],
      ['Produced a block (left out), slots 1048–1060', 'leader', 'false'],
      ['Not measured, slots 1060–1072', 'not_measured', 'false'],
      ['No paying blocks, slots 1072–1084', 'no_paying_blocks', 'false'],
    ]);
    expect(within(barsGroup()).getAllByTestId('inclusion-bar')).toHaveLength(6);
  });

  // The track hatch keeps its 3:1 contrast over GRAPH_BACKGROUND (palette
  // test), so the frame must take its colours from the palette.
  it('frames the bars in the graph colours of the palette', () => {
    renderUi(<InclusionGraph emptyText={''} windows={[inclusionWindow(1)]} />);
    const expected = document.createElement('div').style;
    expected.background = GRAPH_BACKGROUND;
    expected.border = GRAPH_BORDER;
    expect(expected.background).not.toBe('');
    expect(expected.border).not.toBe('');
    const frame = barsGroup().style;
    expect([frame.background, frame.border]).toEqual([
      expected.background,
      expected.border,
    ]);
  });

  it('shows the slots of a bar on hover over the whole bar', async () => {
    const first = inclusionWindow(1);
    renderUi(<InclusionGraph emptyText={''} windows={[first]} />);
    fireEvent.mouseOver(screen.getByTestId('inclusion-bar'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Slots 1012–1024');
    expect(tooltip).toHaveTextContent(windowText(first));
    expect(tooltip).toHaveTextContent(windowSlots(first));
  });

  it('keeps only the newest windows that fit', () => {
    renderUi(
      <InclusionGraph
        emptyText={''}
        maxBars={2}
        windows={[
          inclusionWindow(1),
          inclusionWindow(2, { included: 9 }),
          inclusionWindow(3, { included: 8 }),
        ]}
      />
    );
    expect(describeBars().map(([label]) => label)).toEqual([
      'Counted in 9 of 10 blocks, slots 1024–1036',
      'Counted in 8 of 10 blocks, slots 1036–1048',
    ]);
  });

  it('shows the empty text and the legend with its help', () => {
    renderUi(<InclusionGraph emptyText={'Measuring…'} windows={[]} />);
    expect(screen.getByText('Measuring…')).toBeInTheDocument();
    expect(within(barsGroup()).getByText('Measuring…')).toBeInTheDocument();
    expect(screen.queryByTestId('inclusion-bar')).toBeNull();
    expect(screen.getByText(MONITOR_TEXT.barsCaption)).toBeInTheDocument();
    for (const help of [
      HELP.monitorBar,
      HELP.greyBar,
      HELP.purpleBar,
      HELP.emptyOutline,
      HELP.hatched,
    ]) {
      expect(screen.getByRole('img', { name: help })).toBeInTheDocument();
    }
  });
});
