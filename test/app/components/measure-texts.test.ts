import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  HELP,
  LEGEND,
  MONITOR_TEXT,
  SITE_TITLE,
  STATUS_LABEL,
  howWeMeasureSections,
  migrationNotice,
  minStakeText,
  statusHelp,
  windowLabel,
  windowSlots,
  windowText,
} from '@/app/components/measure-texts.ts';

const pageText = (
  min: string | null,
  sectionsOf: typeof howWeMeasureSections = howWeMeasureSections
): string =>
  sectionsOf(min)
    .flatMap((section) => [
      section.heading ?? '',
      ...section.blocks.flatMap((block) =>
        block.kind === 'p' ? [block.text] : block.items
      ),
    ])
    .join('\n');

describe('measure texts', () => {
  it('names the site after vote inclusion', () => {
    expect(SITE_TITLE).toBe('Solana Vote Inclusion Tracker');
  });

  it('rounds the minimum measurable stake, or stays vague without it', () => {
    expect(minStakeText('612000000000')).toBe('about 600 SOL');
    expect(minStakeText(null)).toBe('a few hundred SOL');
    expect(minStakeText('not a number')).toBe('a few hundred SOL');
  });

  it('renders the Appendix A.2 tooltips with the current constants', () => {
    expect(HELP.votesCounted).toBe(
      "VIR, the vote inclusion rate: share of the paying blocks in the period shown in the header (up to 5 minutes) that included this validator's vote. Counted from its rewards, not estimated."
    );
    expect(HELP.missed).toBe(
      "Paying blocks in the same period that did not include this validator's vote. Hatched (shared) misses are included."
    );
    expect(HELP.epochRatio).toBe(
      'Earned so far this epoch ÷ the most its stake could have earned, own leader slots included. Healthy validators sit around 0.999. Updated every minute.'
    );
    expect(HELP.epochRatioPending).toBe(
      '"…": still learning this validator\'s reward per block. "—": we could not learn it this epoch.'
    );
    expect(HELP.monitorBar).toBe(
      'One interval (about 5 s). Height: paying blocks that included the vote ÷ all paying blocks.'
    );
    expect(HELP.greyBar).toBe(
      'Interval not measured reliably; never counted as a miss.'
    );
    expect(HELP.purpleBar).toBe(
      'The validator produced a block in this interval; its leader reward hides the vote count, so the interval is left out.'
    );
    expect(HELP.emptyOutline).toBe(
      'No paying blocks in this interval; nobody missed anything.'
    );
    expect(HELP.hatched).toBe(
      'Other validators holding at least 5% of the stake missed the same number of blocks here, so the leader is the likely cause. Not held against this validator.'
    );
    expect(HELP.clusterBanner).toBe(
      'Validators holding at least 20% of the stake missed blocks in the last interval: a leader or cluster problem.'
    );
    expect(HELP.underReview).toBe(
      'Our method no longer matches how rewards are recorded; numbers are hidden until we update it.'
    );
    expect(HELP.skipRate).toBe(
      'Share of its leader slots so far this epoch in which it produced no block.'
    );
  });

  it('renders the status tooltips with the current constants', () => {
    expect(statusHelp('ok', null)).toBe(
      'Counted in at least 98% of paying blocks in the last 5 minutes (hatched misses not held against it).'
    );
    expect(statusHelp('missing', null)).toBe(
      'Counted in less than 98% of paying blocks in the last 5 minutes, even with hatched misses set aside.'
    );
    expect(statusHelp('not_voting', null)).toBe(
      'Not counted in any of its last 32 or more paying blocks.'
    );
    expect(statusHelp('delinquent', null)).toBe(
      "No vote counted in the last 128 slots (about 27 s), or not in this epoch's active set."
    );
    expect(statusHelp('measuring', null)).toBe(
      "Not enough data yet. Every measurement needs about 20–30 s; the first one in an epoch also needs 10–30 s to learn this validator's reward per block."
    );
    expect(statusHelp('not_measurable', '612000000000')).toBe(
      'Stake below about 600 SOL: too small to learn its reward per block reliably.'
    );
    expect(STATUS_LABEL.missing).toBe('Missing votes');
  });

  it('describes each kind of window', () => {
    const measured = { kind: 'measured', shared: false } as const;
    expect(windowText({ ...measured, included: 95, payable: 95 })).toBe(
      'Counted in 95 of 95 blocks'
    );
    // Spec §6.2 fixes the hover texts: the hatching and the legend tell the
    // shared misses apart.
    expect(
      windowText({ ...measured, included: 90, payable: 95, shared: true })
    ).toBe('Counted in 90 of 95 blocks');
    expect(windowText({ ...measured, included: 0, payable: 0 })).toBe(
      'No paying blocks'
    );
    expect(
      windowText({ kind: 'leader', included: 0, payable: 0, shared: false })
    ).toBe('Produced a block (left out)');
    expect(
      windowText({ kind: 'not_measured', included: 0, payable: 0, shared: false })
    ).toBe('Not measured');
    expect(
      windowText({
        kind: 'no_paying_blocks',
        included: 0,
        payable: 0,
        shared: false,
      })
    ).toBe('No paying blocks');
  });

  it('names the monitor bars and the slots of each one', () => {
    expect(MONITOR_TEXT.barsCaption).toBe('One bar per interval');
    expect(MONITOR_TEXT.barsGroup).toBe('Measured intervals');
    const window = {
      kind: 'measured',
      included: 7,
      payable: 10,
      shared: true,
      fromSlot: 1024,
      toSlot: 1036,
    } as const;
    expect(windowSlots(window)).toBe('Slots 1024–1036');
    // The hover text of the bar (spec §6.2) and its slots, on one line.
    expect(windowLabel(window)).toBe(
      'Counted in 7 of 10 blocks, slots 1024–1036'
    );
    expect(windowLabel({ ...window, kind: 'leader', included: 0 })).toBe(
      'Produced a block (left out), slots 1024–1036'
    );
  });

  it('announces the first measured epoch after the migration', () => {
    expect(migrationNotice(1064)).toBe(
      'Alpenglow migration epoch: votes counted and the epoch ratio are measured from epoch 1065'
    );
    expect(migrationNotice(null)).toBe(
      'Alpenglow migration epoch: votes counted and the epoch ratio are measured from the next epoch'
    );
  });

  it('has one legend entry per bar style, with its help', () => {
    expect(LEGEND.map((item) => item.tone)).toEqual([
      'full',
      'partial',
      'zero',
      'leader',
      'not_measured',
      'no_paying_blocks',
      'shared',
    ]);
    expect(LEGEND.find((item) => item.tone === 'shared')?.help).toBe(
      HELP.hatched
    );
    expect(MONITOR_TEXT.measuring).toBe('Measuring…');
  });

  it('renders the How we measure page with the current constants', () => {
    const text = pageText('612000000000');
    expect(text).toContain('about every 5 seconds');
    expect(text).toContain('over the last 5 minutes of measuring');
    expect(text).toContain('(100 paying blocks)');
    expect(text).toContain('at least 5% of the stake missed the same number');
    expect(text).toContain('counted in at least 98% of paying blocks');
    expect(text).toContain('any of its last 32 or more paying blocks');
    expect(text).toContain('below about 600 SOL today');
    expect(text).toContain('The ratio is updated every minute.');
    expect(text).toContain('at least 20% of the stake missed blocks');
    expect(text).toContain('the table keeps only the last 5 minutes');
    expect(pageText(null)).toContain('below a few hundred SOL today');
  });
});

// A calibration (spec §8) changes the thresholds in MEASURE. The texts read
// them once, on import, so each case loads the module again against the new
// values instead of repeating the module's own formula.
describe('measure texts after a calibration', () => {
  // The path of a mock goes straight to jest, which does not know the `@/`
  // alias: the compiler only rewrites the paths of imports.
  const CONSTANTS = '../../../src/core/measure/domain/Constants.ts';

  type Calibration = { [K in keyof typeof MEASURE]?: number };

  const loadTexts = async (calibration: Calibration) => {
    jest.resetModules();
    jest.doMock(CONSTANTS, () => ({
      MEASURE: { ...MEASURE, ...calibration },
    }));
    return import('@/app/components/measure-texts.ts');
  };

  afterEach(() => {
    jest.dontMock(CONSTANTS);
    jest.resetModules();
  });

  it.each([
    [0.98, '98%'],
    [0.985, '98.5%'],
    [0.975, '97.5%'],
    [0.9875, '98.75%'],
    [0.999, '99.9%'],
    // The product carries float noise (0.07 * 100 is 7.000000000000001), which
    // must not reach the text.
    [0.07, '7%'],
    [0.29, '29%'],
  ])('prints a threshold of %s as %s', async (okInclusion, expected) => {
    const texts = await loadTexts({ okInclusion });
    expect(texts.OK_PERCENT).toBe(expected);
    expect(texts.statusHelp('ok', null)).toContain(
      `at least ${expected} of paying blocks`
    );
    expect(texts.statusHelp('missing', null)).toContain(
      `less than ${expected} of paying blocks`
    );
  });

  it('takes every threshold from MEASURE, without rounding it', async () => {
    const texts = await loadTexts({
      okInclusion: 0.985,
      sharedMissStakeShare: 0.025,
      clusterAlertStakeShare: 0.075,
      notVotingBlocks: 40,
    });
    expect(texts.OK_PERCENT).toBe('98.5%');
    expect(texts.SHARED_PERCENT).toBe('2.5%');
    expect(texts.CLUSTER_PERCENT).toBe('7.5%');
    expect(texts.NOT_VOTING_BLOCKS).toBe(40);

    expect(texts.HELP.hatched).toContain('at least 2.5% of the stake');
    expect(texts.HELP.clusterBanner).toContain('at least 7.5% of the stake');
    expect(texts.HELP.clusterMissed).toContain('appears at 7.5%.');
    expect(texts.statusHelp('not_voting', null)).toContain('last 40 or more');

    const page = pageText(null, texts.howWeMeasureSections);
    expect(page).toContain('at least 2.5% of the stake missed the same number');
    expect(page).toContain('counted in at least 98.5% of paying blocks');
    expect(page).toContain('below 98.5% on the same basis');
    expect(page).toContain('at least 7.5% of the stake missed blocks');
    expect(page).toContain('any of its last 40 or more paying blocks');
  });
});
