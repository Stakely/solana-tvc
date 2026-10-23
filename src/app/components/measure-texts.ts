import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { formatWholeSol, roundLamportsToHundredSol } from '@/app/utils.ts';
import { InclusionStatus, InclusionWindow } from '@/types/measure.ts';

// Every text of the UI that explains the measurement (spec §6.6, Appendix
// A). Thresholds and timings come from MEASURE, so a calibration changes the
// copy too.

// A threshold as the percentage the rules apply, never rounded to a whole
// number: 0.98 → "98%", 0.985 → "98.5%". toPrecision(12) only cancels the
// float noise of the product (0.29 * 100 is 28.999999999999996).
const percent = (share: number): string =>
  `${Number((share * 100).toPrecision(12))}%`;
const plural = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? '' : 's'}`;
const ratioMinutes = MEASURE.epochRatioRefreshMs / 60_000;

export const SITE_TITLE = 'Solana Vote Inclusion Tracker';
export const HOW_WE_MEASURE_TITLE = 'How we measure';
export const UNDER_REVIEW_TITLE = 'Measurement under review';

export const OK_PERCENT = percent(MEASURE.okInclusion);
export const SHARED_PERCENT = percent(MEASURE.sharedMissStakeShare);
export const CLUSTER_PERCENT = percent(MEASURE.clusterAlertStakeShare);
export const NOT_VOTING_BLOCKS = MEASURE.notVotingBlocks;
export const MEASURING_BLOCKS = MEASURE.measuringMinPayable;
export const RECENT_PERIOD = plural(MEASURE.recentWindowMs / 60_000, 'minute');
export const POLL_SECONDS = MEASURE.measurePollMs / 1_000;
export const RATIO_REFRESH =
  ratioMinutes === 1 ? 'every minute' : `every ${plural(ratioMinutes, 'minute')}`;

// "about 600 SOL" from the server's limit (lamports), rounded to 100 SOL.
export function minStakeText(minMeasurableStake: string | null): string {
  const rounded =
    minMeasurableStake === null
      ? null
      : roundLamportsToHundredSol(minMeasurableStake);
  return rounded === null
    ? 'a few hundred SOL'
    : `about ${formatWholeSol(rounded)}`;
}

// Appendix A.2, plus the two figures of the cluster card (spec §6.2).
export const HELP = {
  votesCounted: `Vote inclusion rate: share of the paying blocks in the period shown in the header (up to ${RECENT_PERIOD}) that included this validator's vote. Counted from its rewards, not estimated.`,
  missed: `Paying blocks in the same period that did not include this validator's vote. Hatched (shared) misses are included.`,
  epochRatio: `Earned so far this epoch ÷ the most its stake could have earned, own leader slots included. Healthy validators sit around 0.999. Updated ${RATIO_REFRESH}.`,
  epochRatioPending: `"…": still learning this validator's reward per block. "—": we could not learn it this epoch.`,
  monitorBar: `One interval (about ${POLL_SECONDS} s). Height: paying blocks that included the vote ÷ all paying blocks.`,
  greyBar: `Interval not measured reliably; never counted as a miss.`,
  purpleBar: `The validator produced a block in this interval; its leader reward hides the vote count, so the interval is left out.`,
  emptyOutline: `No paying blocks in this interval; nobody missed anything.`,
  hatched: `Other validators holding at least ${SHARED_PERCENT} of the stake missed the same number of blocks here, so the leader is the likely cause. Not held against this validator.`,
  clusterBanner: `Validators holding at least ${CLUSTER_PERCENT} of the stake missed blocks in the last interval: a leader or cluster problem.`,
  underReview: `Our method no longer matches how rewards are recorded; numbers are hidden until we update it.`,
  lastVote: `Latest slot in which this validator's vote was counted. A few slots behind the cluster is normal.`,
  skipRate: `Share of its leader slots so far this epoch in which it produced no block.`,
  clusterPayable: `Paying blocks in the last interval (about ${POLL_SECONDS} s): the blocks that paid the votes of an earlier slot.`,
  clusterMissed: `Share of the measured stake whose vote was left out of at least one paying block in the last interval. The cluster banner appears at ${CLUSTER_PERCENT}.`,
} as const;

export const STATUS_LABEL: Record<InclusionStatus, string> = {
  ok: 'OK',
  missing: 'Missing votes',
  not_voting: 'Not voting',
  delinquent: 'Delinquent',
  measuring: 'Measuring',
  not_measurable: 'Not measurable',
};

export function statusHelp(
  status: InclusionStatus,
  minMeasurableStake: string | null
): string {
  switch (status) {
    case 'ok':
      return `Counted in at least ${OK_PERCENT} of paying blocks in the last ${RECENT_PERIOD} (hatched misses not held against it).`;
    case 'missing':
      return `Counted in less than ${OK_PERCENT} of paying blocks in the last ${RECENT_PERIOD}, even with hatched misses set aside.`;
    case 'not_voting':
      return `Not counted in any of its last ${NOT_VOTING_BLOCKS} or more paying blocks.`;
    case 'delinquent':
      return `No vote counted in the last 128 slots (about 27 s), or not in this epoch's active set.`;
    case 'measuring':
      return `Not enough data yet. Every measurement needs about 20–30 s; the first one in an epoch also needs 10–30 s to learn this validator's reward per block.`;
    case 'not_measurable':
      return `Stake below ${minStakeText(minMeasurableStake)}: too small to learn its reward per block reliably.`;
  }
}

// Hover text of a monitor bar, exactly as spec §6.2 fixes it. A measured
// window without paying blocks reads like the no_paying_blocks kind, as its
// tone (inclusion-palette toneOf) does.
export function windowText(
  window: Pick<InclusionWindow, 'kind' | 'included' | 'payable' | 'shared'>
): string {
  switch (window.kind) {
    case 'measured':
      return window.payable <= 0
        ? 'No paying blocks'
        : `Counted in ${window.included} of ${window.payable} blocks`;
    case 'leader':
      return 'Produced a block (left out)';
    case 'not_measured':
      return 'Not measured';
    case 'no_paying_blocks':
      return 'No paying blocks';
  }
}

const slotRange = (window: Pick<InclusionWindow, 'fromSlot' | 'toSlot'>) =>
  `${window.fromSlot}–${window.toSlot}`;

// Second line of a monitor bar's hover text: "Slots 1012–1024".
export function windowSlots(
  window: Pick<InclusionWindow, 'fromSlot' | 'toSlot'>
): string {
  return `Slots ${slotRange(window)}`;
}

// Accessible name of a monitor bar: its hover text and its slots, on one
// line ("Counted in 7 of 10 blocks, slots 1024–1036").
export function windowLabel(
  window: Pick<
    InclusionWindow,
    'kind' | 'included' | 'payable' | 'shared' | 'fromSlot' | 'toSlot'
  >
): string {
  return `${windowText(window)}, slots ${slotRange(window)}`;
}

// Spec §6.5: the epoch number comes from the API, never hard-coded.
export function migrationNotice(epoch: number | null): string {
  const from = epoch === null ? 'the next epoch' : `epoch ${epoch + 1}`;
  return `Alpenglow migration epoch: votes counted and the epoch ratio are measured from ${from}`;
}

export const MONITOR_TEXT = {
  measuring: 'Measuring…',
  stopped: 'Measurement stopped.',
  notFound:
    'Validator not found: this vote account is not in the current validator list.',
  error: 'Could not reach the server. Retrying…',
  // Under review or in the migration epoch the banner above explains why.
  hidden: 'No numbers while the notice above is shown.',
  // Legend caption of the bars, next to the HELP.monitorBar tooltip.
  barsCaption: 'One bar per interval',
  // Accessible name of the group of bars.
  barsGroup: 'Measured intervals',
} as const;

export type LegendTone =
  | 'full'
  | 'partial'
  | 'zero'
  | 'leader'
  | 'not_measured'
  | 'no_paying_blocks'
  | 'shared';

export type LegendItem = { tone: LegendTone; label: string; help: string };

export const LEGEND: LegendItem[] = [
  {
    tone: 'full',
    label: 'Counted in all',
    help: 'The vote was in every paying block of the interval.',
  },
  {
    tone: 'partial',
    label: 'Counted in some',
    help: 'The vote was missing from some paying blocks of the interval.',
  },
  {
    tone: 'zero',
    label: 'Counted in none',
    help: 'The vote was in none of the paying blocks of the interval.',
  },
  { tone: 'leader', label: 'Produced a block', help: HELP.purpleBar },
  { tone: 'not_measured', label: 'Not measured', help: HELP.greyBar },
  { tone: 'no_paying_blocks', label: 'No paying blocks', help: HELP.emptyOutline },
  { tone: 'shared', label: 'Shared misses', help: HELP.hatched },
];

// How we measure page (Appendix A.1). Text may use <b>…</b> (see ui/Text).
export type PageBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] };

export type PageSection = { heading?: string; blocks: PageBlock[] };

export function howWeMeasureSections(
  minMeasurableStake: string | null
): PageSection[] {
  const minStake = minStakeText(minMeasurableStake);
  return [
    {
      blocks: [
        {
          kind: 'p',
          text: `Since epoch 1064 (21 October 2026), Solana mainnet runs <b>Alpenglow</b>, a new consensus protocol. Validators no longer send their votes as on-chain transactions. For each slot, the leader eight slots later (the validator chosen to produce that block) puts the votes it has received into its block. We call that block a <b>paying block</b>. Every validator whose vote is in it earns a fixed amount, set for the whole epoch and proportional to its stake. The leader earns, on top, about as much as all those voters together. If that block is skipped, or its leader does not add the votes in time, nobody is paid for that slot. That is a loss for the whole cluster, not a miss for any one validator.`,
        },
      ],
    },
    {
      heading: 'Why we no longer rank by vote credits',
      blocks: [
        {
          kind: 'p',
          text: `Before Alpenglow, a validator earned 1 to 16 credits for each slot it voted on, depending on how quickly its vote landed. This was called Timely Vote Credits (TVC). Every healthy validator ended an epoch with about the same number of credits. Now the same counter holds the validator's rewards in lamports (1 SOL = 1,000,000,000 lamports), before commission: its rewards for votes plus its rewards for producing blocks. A validator with more stake shows more credits, even if it votes exactly as well. Ranking by credits would mostly rank validators by stake, so this site no longer does it. The site's address still says TVC, but it no longer measures TVC.`,
        },
      ],
    },
    {
      heading: 'Votes counted (vote inclusion rate, VIR)',
      blocks: [
        {
          kind: 'p',
          text: `The vote inclusion rate (VIR) is the share of paying blocks that included a validator's vote. The <b>Votes counted</b> column shows it as a percentage, and <b>Missed</b> shows how many paying blocks left the vote out. VIR does not depend on stake: a small validator and a large one that are both in every paying block both score 100%. A healthy validator is counted in every paying block, or very close to it, so many validators tie at or near the top.`,
        },
        {
          kind: 'p',
          text: `When you click <b>Measure</b>, we read every validator's reward counter from a Solana RPC server (a server that answers queries about the chain) about every ${POLL_SECONDS} seconds. We call the time between two readings an <b>interval</b>. For each interval we work out how many paying blocks there were (the same number for every validator) and how many of them included each validator's vote. Each validator earns its own fixed amount for every block that includes its vote. So, if it produced no block in the interval, the increase in its counter divided by that amount is the number of blocks that included it. It is a count, not an estimate.`,
        },
        {
          kind: 'p',
          text: `Each bar in the monitor is one interval, labelled "counted in X of Y blocks". The monitor also adds up every interval since you opened it. The table shows the result over the last ${RECENT_PERIOD} of measuring; the column header says how many seconds that covers. When you measure, we measure every validator at once, so the table also shows Votes counted for all of them.`,
        },
        {
          kind: 'p',
          text: `The first measurement of each epoch takes 10 to 30 seconds, because we need to learn each validator's reward per block, which changes every epoch. After that, every new measurement needs about 20 to 30 seconds (${MEASURING_BLOCKS} paying blocks) before it shows a status. Until then the validator shows <b>Measuring</b>.`,
        },
      ],
    },
    {
      heading: 'Colours in the monitor',
      blocks: [
        {
          kind: 'ul',
          items: [
            `<b>Green</b>: the vote was in every paying block of the interval.`,
            `<b>Amber</b>: it was missing from some of them.`,
            `<b>Red</b>: it was in none of them.`,
            `<b>Purple</b>: the validator produced a block in the interval. Its extra reward as leader hides the vote count, so we leave the interval out.`,
            `<b>Grey</b>: we could not measure the interval reliably (for example, the two readings came from different RPC servers, or we are still learning the validator's reward per block). It never counts as a miss.`,
            `<b>Empty outline</b>: there were no paying blocks in the interval, so nobody missed anything.`,
            `<b>Hatched</b> (on an amber or red bar): other validators holding at least ${SHARED_PERCENT} of the stake missed the same number of blocks in the same interval. That usually means the leader of those blocks left their votes out, not that this validator failed. These misses are shown, but they are not held against the validator in its status.`,
          ],
        },
      ],
    },
    {
      heading: 'Status',
      blocks: [
        {
          kind: 'p',
          text: `Statuses appear while someone is measuring. Otherwise the table shows only whether a validator is delinquent.`,
        },
        {
          kind: 'ul',
          items: [
            `<b>OK</b>: in the last ${RECENT_PERIOD}, counted in at least ${OK_PERCENT} of paying blocks, with hatched misses not held against it.`,
            `<b>Missing votes</b>: below ${OK_PERCENT} on the same basis.`,
            `<b>Not voting</b>: not counted in any of its last ${NOT_VOTING_BLOCKS} or more paying blocks. The validator is offline, or its votes are not reaching the leaders.`,
            `<b>Delinquent</b>: none of its votes has been counted in the last 128 slots (about 27 seconds). Under Alpenglow, a vote counts only when a block includes it or when the validator signs the finalization of a block. A validator outside this epoch's active set (the validators that can earn rewards this epoch; for example, because its vote account could not pay the 0.8 SOL per-epoch Validator Admission Ticket, or it has no BLS key) is always delinquent.`,
            `<b>Measuring</b>: not enough data yet (see above).`,
            `<b>Not measurable</b>: its stake is too small (below ${minStake} today; the limit moves a little each epoch) to learn its reward per block reliably.`,
          ],
        },
        {
          kind: 'p',
          text: `Validators that are delinquent, not voting, not measurable or still measuring are listed below the ranked ones.`,
        },
      ],
    },
    {
      heading: 'Epoch ratio',
      blocks: [
        {
          kind: 'p',
          text: `The epoch ratio compares what a validator has earned so far this epoch with the most its stake could have earned in the same period. That maximum is its reward for every block produced so far, plus the full leader reward for each block it was scheduled to produce. Commission does not affect it.`,
        },
        {
          kind: 'p',
          text: `About half of what a validator can earn comes from the blocks it produces, so each skipped leader slot weighs as much as thousands of missed votes.`,
        },
        {
          kind: 'p',
          text: `1.00 means it earned everything it could. Missing votes and skipped own blocks lower it. A healthy validator sits around 0.999, just under 1.00, because its own blocks can only carry the votes that reach it in time, and other leaders sometimes leave its vote out.`,
        },
        {
          kind: 'p',
          text: `Differences of a few hundredths of a percent are normal, so positions change often. Use the epoch ratio to compare validators over the epoch, and <b>Votes counted</b> to see what is happening right now. The ratio is updated ${RATIO_REFRESH}. It shows "…" until we know the validator's reward per block, and "—" if we cannot learn it this epoch.`,
        },
        {
          kind: 'p',
          text: `JPool's credit rank also ranks validators by a ratio of rewards earned to rewards possible, with its own formula. Its numbers will differ slightly from ours. Because healthy validators are so close to each other, a small difference in method can move a validator many places.`,
        },
      ],
    },
    {
      heading: 'What you can still compare with older numbers',
      blocks: [
        {
          kind: 'p',
          text: `Skip rate, stake and version mean what they meant before (in epoch 1064 the protocol itself skipped 8 slots during the switch). Delinquency still uses 128 slots, but a vote now counts only when a block includes it or the validator signs a finalization. Last vote is now the latest slot in which the validator's vote was counted; use it only to check that the validator is alive. Vote credits, credit ranks and vote latency cannot be compared across the switch: credits are now rewards in lamports, and votes are no longer on-chain transactions. Epoch 1064, the migration epoch, mixes both systems and is not measured.`,
        },
      ],
    },
    {
      heading: 'Was it the validator or the measurement?',
      blocks: [
        {
          kind: 'ol',
          items: [
            `Grey intervals, or a "Measurement under review" or migration banner: the measurement.`,
            `Hatched misses, or the cluster banner (shown when validators holding at least ${CLUSTER_PERCENT} of the stake missed blocks in the last interval): the leader of those blocks, or the cluster.`,
            `Only this validator is missing votes, or its last vote stopped moving: the validator, or its setup.`,
          ],
        },
      ],
    },
    {
      heading: 'Limitations',
      blocks: [
        {
          kind: 'p',
          text: `We only measure while someone has a monitor open, and the table keeps only the last ${RECENT_PERIOD}. Measuring stops when you close the monitor or switch to another tab. The numbers start again at the beginning of each epoch. The data comes from public Solana RPC servers and relies on how Agave, the main validator software, currently records rewards. If that changes, we show a "Measurement under review" banner instead of numbers until we update the method.`,
        },
      ],
    },
  ];
}
