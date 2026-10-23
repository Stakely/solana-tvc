import { MonitorSessionStats } from '@/app/components/MonitorSessionStats.tsx';
import { EMPTY_TOTALS } from '@/app/hooks/use-measure.tsx';
import { renderUi } from '../support/fixtures.tsx';

describe('MonitorSessionStats', () => {
  it('adds up the session, each window once', () => {
    renderUi(
      <MonitorSessionStats
        totals={{
          ...EMPTY_TOTALS,
          windows: 4,
          measured: 2,
          included: 18,
          payable: 20,
          missed: 2,
          sharedMissed: 2,
          leader: 1,
          notMeasured: 1,
          firstSlot: 1012,
          lastSlot: 1060,
        }}
        startedAt={Date.now()}
        running={false}
      />
    );
    expect(document.body).toHaveTextContent('Votes counted: 90.00%');
    expect(document.body).toHaveTextContent(
      'Paying blocks that included the vote: 18 of 20'
    );
    expect(document.body).toHaveTextContent('Missed: 2 (shared: 2)');
    expect(document.body).toHaveTextContent(
      'Intervals measured: 2 · produced a block: 1 · not measured: 1 · no paying blocks: 0'
    );
    expect(document.body).toHaveTextContent('Slots: 1012 to 1060');
  });

  it('shows a dash before the first paying block', () => {
    renderUi(
      <MonitorSessionStats
        totals={EMPTY_TOTALS}
        startedAt={Date.now()}
        running={true}
      />
    );
    expect(document.body).toHaveTextContent('Votes counted: —');
  });

  it('hides the numbers while the measurement is under review', () => {
    renderUi(
      <MonitorSessionStats
        totals={{ ...EMPTY_TOTALS, measured: 2, included: 18, payable: 20, missed: 2 }}
        startedAt={Date.now()}
        running={true}
        hidden={true}
      />
    );
    expect(document.body).toHaveTextContent('Votes counted: —');
    expect(document.body).toHaveTextContent(
      'Paying blocks that included the vote: —'
    );
    expect(document.body).toHaveTextContent('Missed: —');
    expect(document.body).not.toHaveTextContent('90.00%');
  });
});
