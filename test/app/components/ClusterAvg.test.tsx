import { screen } from '@testing-library/react';
import { ClusterAvg } from '@/app/components/ClusterAvg.tsx';
import { HELP } from '@/app/components/measure-texts.ts';
import { renderUi, snapshot, validator } from '../support/fixtures.tsx';

describe('ClusterAvg', () => {
  it('shows paying blocks and the stake that missed while someone measures', () => {
    renderUi(
      <ClusterAvg
        snapshot={snapshot([validator()])}
        cluster={{ payable: 95, stakeShareMissed: 0.2, alert: true }}
      />
    );
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: HELP.clusterPayable })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: HELP.clusterMissed })
    ).toBeInTheDocument();
  });

  it('hides them when nobody measures', () => {
    renderUi(<ClusterAvg snapshot={snapshot([validator()])} cluster={null} />);
    expect(screen.queryByText(/Paying blocks/)).toBeNull();
  });

  it('shows no "undefined" before the first snapshot', () => {
    renderUi(<ClusterAvg snapshot={null} cluster={null} />);
    expect(screen.queryByText('undefined%')).toBeNull();
  });
});
