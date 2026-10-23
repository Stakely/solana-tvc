import { fireEvent, screen } from '@testing-library/react';
import { ValidatorInfo } from '@/app/components/ValidatorInfo.tsx';
import {
  IDENTITY,
  OTHER_VOTE,
  VOTE,
  renderUi,
  snapshot,
  validator,
} from '../support/fixtures.tsx';

// The visible text, without the CSS of the link's <style> tag.
const textOf = (container: HTMLElement) => {
  const copy = container.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('style').forEach((style) => style.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ');
};

describe('ValidatorInfo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the validator of the vote account', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = renderUi(
      <ValidatorInfo
        vote={VOTE}
        snapshot={snapshot([validator()])}
        version={undefined}
      />
    );
    const text = textOf(container);
    expect(text).toContain('Version: 4.3.2');
    expect(text).toContain('Commission: 5%');
    expect(text).toContain('Delinquent: No');
    fireEvent.click(screen.getByText(IDENTITY));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining(`/validators/${IDENTITY}?`),
      '_blank'
    );
  });

  // An unknown vote account, or no snapshot yet: nothing is known about it.
  it.each([
    ['an unknown vote account', snapshot([validator()])],
    ['no snapshot yet', null],
  ])('shows dashes and no link for %s', (_, data) => {
    const { container } = renderUi(
      <ValidatorInfo vote={OTHER_VOTE} snapshot={data} version={undefined} />
    );
    const text = textOf(container);
    expect(text).toContain('Identity: —');
    expect(text).toContain('Stake: —');
    expect(text).toContain('Version: —');
    expect(text).toContain('Commission: —');
    expect(text).toContain('Delinquent: —');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('Delinquent: No');
    expect(container.querySelector('.underline-animation')).toBeNull();
  });
});
