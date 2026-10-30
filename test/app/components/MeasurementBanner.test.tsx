import { screen, waitFor } from '@testing-library/react';
import {
  MeasurementBanner,
  bannerKind,
} from '@/app/components/MeasurementBanner.tsx';
import { HELP, migrationNotice } from '@/app/components/measure-texts.ts';
import { useMeasure } from '@/app/hooks/use-measure.tsx';
import {
  VOTE,
  jsonResponse,
  measureResponse,
  mockFetch,
  renderUi,
  setVisibility,
} from '../support/fixtures.tsx';

// Mounted the way the validator monitor mounts it: before the first
// /api/measure response, so the empty region is already in the page.
function MonitorBanner() {
  const { response } = useMeasure(VOTE);
  return (
    <MeasurementBanner
      measurement={response?.measurement}
      migrationEpoch={response?.migrationEpoch}
      epoch={response?.epoch}
      clusterAlert={response?.cluster?.alert}
    />
  );
}

describe('bannerKind', () => {
  it('shows the most serious banner first', () => {
    expect(
      bannerKind({
        measurement: 'under_review',
        migrationEpoch: true,
        clusterAlert: true,
      })
    ).toBe('under_review');
    expect(
      bannerKind({ measurement: 'ok', migrationEpoch: true, clusterAlert: true })
    ).toBe('migration');
    expect(
      bannerKind({ measurement: 'ok', migrationEpoch: false, clusterAlert: true })
    ).toBe('cluster');
    expect(
      bannerKind({ measurement: 'ok', migrationEpoch: false, clusterAlert: false })
    ).toBeNull();
    expect(bannerKind({})).toBeNull();
  });
});

describe('MeasurementBanner', () => {
  it('announces the epoch after the migration epoch and links the method', () => {
    renderUi(
      <MeasurementBanner measurement={'ok'} migrationEpoch={true} epoch={1064} />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Alpenglow migration epoch: votes counted and the epoch ratio are measured from epoch 1065'
    );
    expect(screen.getByRole('link', { name: 'How we measure' })).toHaveAttribute(
      'href',
      '/how-we-measure'
    );
  });

  it('explains "Measurement under review" with its tooltip', () => {
    renderUi(<MeasurementBanner measurement={'under_review'} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Measurement under review'
    );
    expect(
      screen.getByRole('img', { name: HELP.underReview })
    ).toBeInTheDocument();
  });

  it('shows the cluster banner text', () => {
    renderUi(<MeasurementBanner measurement={'ok'} clusterAlert={true} />);
    expect(screen.getByRole('status')).toHaveTextContent(HELP.clusterBanner);
  });

  // Screen readers only announce a change inside a live region that was
  // already in the page (WCAG technique ARIA22), so the region stays mounted:
  // empty, and out of the layout flow so that it adds no gap around it.
  it('keeps an empty live region, out of the layout, when all is well', () => {
    renderUi(<MeasurementBanner measurement={'ok'} />);
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveStyle({ position: 'absolute' });
  });

  it('fills the region that was already there when a banner appears', () => {
    const { rerender } = renderUi(<MeasurementBanner measurement={'ok'} />);
    const region = screen.getByRole('status');

    rerender(<MeasurementBanner measurement={'ok'} clusterAlert={true} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent(HELP.clusterBanner);
    expect(region).not.toHaveStyle({ position: 'absolute' });

    rerender(<MeasurementBanner measurement={'under_review'} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Measurement under review');

    rerender(<MeasurementBanner measurement={'ok'} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toBeEmptyDOMElement();
  });

  it('takes the banner of a later response into the region it already had', async () => {
    setVisibility('visible');
    mockFetch(() =>
      jsonResponse(measureResponse({ epoch: 1064, migrationEpoch: true }))
    );
    renderUi(<MonitorBanner />);
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();

    // Wait for the text, not for the region: findByRole('status') would
    // resolve at once with the empty one.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        migrationNotice(1064)
      )
    );
    expect(screen.getByRole('status')).toBe(region);
  });
});
