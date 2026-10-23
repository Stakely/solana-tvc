import { fireEvent, screen } from '@testing-library/react';
import { VersionInfo } from '@/app/components/VersionInfo.tsx';
import { renderUi, versionData } from '../support/fixtures.tsx';

const NAMES = ['4.3.2', '4.3.1', '4.2.0', '4.1.0', '4.0.0'];

describe('VersionInfo', () => {
  it('shows the top 3 versions, then all of them, without changing its input', () => {
    const versions = NAMES.map((name, index) => versionData(name, 100 - index));
    renderUi(<VersionInfo versions={versions} />);
    expect(screen.getByText('4.3.2')).toBeInTheDocument();
    expect(screen.queryByText('4.1.0')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show all versions' }));
    for (const name of NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(versions).toHaveLength(5);
  });
});
