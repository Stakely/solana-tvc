'use client';

import { FC } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import {
  OrderCriteria,
  Snapshot,
  ValidatorSnapshot,
} from '@/types/snapshot.ts';
import { InclusionStatus, SnapshotMeta } from '@/types/measure.ts';
import { formatLamportsToSol, formatPercent, formatRatio } from '@/app/utils.ts';
import { Paginator } from '@/app/components/ui/Paginator.tsx';
import { useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import {
  Avatar,
  Button,
  Surface,
  Table,
  TableColumn,
  Text,
  TextField,
} from '@/app/components/ui';
import { Percentage, Pixel } from '@/app/components/utils/Measures.ts';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import { StatusChip } from '@/app/components/StatusChip.tsx';
import { HELP } from '@/app/components/measure-texts.ts';
import { PAGE_SIZE, orderAvailable } from '@/app/providers/data.tsx';

export type ValidatorsInfoProps = {
  totalValidators: number;
  currentPage: number;
  pubKeyFilter: string;
  snapshot: Snapshot | null;
  meta: SnapshotMeta | null;
  // Picked by the user; null shows the server default.
  orderCriteria: OrderCriteria | null;
  setCurrentPageAction: (page: number) => void;
  setPubKeyFilterAction: (key: string) => void;
  setOrderCriteriaAction: (criteria: OrderCriteria) => void;
  // Receives the vote account: the monitor follows it (spec §6.2).
  onValidatorMonitorAction: (vote: string) => void;
};

export type ValidatorRow = {
  voteAccountPubkey: string;
  identity: string;
  identityPubKey: string;
  icon?: string;
  ranking: string;
  stake: string;
  epochRatio: string;
  votesCounted: string;
  missed: string;
  commission: string;
  lastVote: string;
  version: string;
  skipRate: string;
  status: InclusionStatus | null;
};

export type TableMode = { showInclusion: boolean; showEpochRatio: boolean };

// Votes counted and the full status exist only while someone measures on
// this replica and the measurement is trusted (spec §5.1, §6.3). The epoch
// ratio is hidden under review and in the migration epoch (§4.8, §5.2).
export function tableMode(meta: SnapshotMeta | null): TableMode {
  return {
    showInclusion: meta?.inclusionCoverageSeconds !== undefined,
    showEpochRatio:
      meta?.measurement !== 'under_review' && !meta?.migrationEpoch,
  };
}

export type WidthKey =
  | 'ranking'
  | 'identity'
  | 'stake'
  | 'epochRatio'
  | 'votesCounted'
  | 'missed'
  | 'commission'
  | 'lastVote'
  | 'version'
  | 'skipRate'
  | 'status'
  | 'measure';

type FixedWidths = Record<Exclude<WidthKey, 'identity'>, number>;

// On the widest table (1158px: every table above 1440px wide) each share
// holds its column's minimum with either root font, so no column takes room
// from Identity there.
const WIDE: FixedWidths = {
  ranking: 5,
  stake: 9,
  epochRatio: 9,
  votesCounted: 0,
  missed: 0,
  commission: 8,
  lastVote: 9,
  version: 7,
  skipRate: 7,
  status: 14,
  measure: 12,
};

// Twelve columns while measuring: each one gets the smallest quarter percent
// that holds its minimum, and Identity keeps 16.25%.
const COMPACT: FixedWidths = {
  ranking: 5,
  stake: 7.75,
  epochRatio: 6,
  votesCounted: 8.5,
  missed: 6.25,
  commission: 7.25,
  lastVote: 8,
  version: 5,
  skipRate: 5.75,
  status: 13,
  measure: 11.25,
};

// Desktop column widths in percent. Identity takes what the shown columns
// leave, so every mode adds up to 100% and the header stays aligned with the
// rows (Table lays them out with flex and nowrap cells).
export function columnWidths(mode: TableMode): Record<WidthKey, number> {
  const base = mode.showInclusion ? COMPACT : WIDE;
  const shown: FixedWidths = {
    ...base,
    epochRatio: mode.showEpochRatio ? base.epochRatio : 0,
    votesCounted: mode.showInclusion ? base.votesCounted : 0,
    missed: mode.showInclusion ? base.missed : 0,
  };
  const used = Object.values(shown).reduce((sum, width) => sum + width, 0);
  return { ...shown, identity: 100 - used };
}

const pct = (width: number): Percentage => `${width}%`;

export type ColumnMin = { rem: number; px: number };

// The desktop header text keeps the 12px of the root font up to 1440px wide
// on wider screens too, where the root is 16px. Grown by a third, the headers
// of the twelve columns left Identity 11% of the row while measuring. The
// line height is body1's 1.26rem at the 12px root.
const HEADER_FONT_SIZE: Pixel = '12px';
const HEADER_LINE_HEIGHT = 1.26;

// The narrowest each desktop column can get: text that scales with the root
// font (12px up to 1440px wide, 16px above) in rem, and icons, paddings, the
// gap to the next column, 1px to spare (4px for the button) and the 12px
// header text in px. Measured with Plus Jakarta Sans in a browser with both
// root sizes. Table cells do not grow with their content: without these
// minimums a header spills over its neighbours and the Measure button is cut
// off.
export const COLUMN_MIN: Record<WidthKey, ColumnMin> = {
  ranking: { rem: 3, px: 7 }, // "#1234"
  identity: { rem: 4, px: 47 }, // the 32px avatar, its gap and a few letters
  stake: { rem: 5, px: 6 }, // "12.3M SOL"
  epochRatio: { rem: 0, px: 68 }, // "Epoch" over "ratio" and the help icon
  votesCounted: { rem: 0, px: 97 }, // "(VIR) · 300 s", never split
  missed: { rem: 0, px: 71 }, // "Missed" and the help icon
  commission: { rem: 0, px: 81 }, // "Commission"
  lastVote: { rem: 5.25, px: 7 }, // a 9-digit slot
  // "Version", and "3.0.10" with the 16px root; longer ones end in "…".
  version: { rem: 0.75, px: 43 },
  // "Skip" over "rate" and the help icon, and "12.34%" with the 16px root.
  skipRate: { rem: 1.75, px: 35 },
  status: { rem: 6.25, px: 46 }, // the "Not measurable" chip and its help icon
  measure: { rem: 4.25, px: 59 }, // the Measure button with its icon
};

// Table rows have 8px of padding on each side.
const ROW_PADDING_PX = 16;

const round2 = (value: number) => Math.round(value * 100) / 100;

const cssLength = ({ rem, px }: ColumnMin): string =>
  `calc(${round2(rem)}rem + ${round2(px)}px)`;

export const columnMinWidth = (key: WidthKey): string =>
  cssLength(COLUMN_MIN[key]);

// The narrowest desktop table: every shown column at its minimum. Below it
// the table scrolls sideways inside its card.
export function tableMinWidth(mode: TableMode): string {
  const widths = columnWidths(mode);
  const shown = (Object.keys(widths) as WidthKey[]).filter(
    (key) => widths[key] > 0
  );
  return cssLength(
    shown.reduce(
      (sum, key) => ({
        rem: sum.rem + COLUMN_MIN[key].rem,
        px: sum.px + COLUMN_MIN[key].px,
      }),
      { rem: 0, px: ROW_PADDING_PX }
    )
  );
}

// The order the server applies when the user picked none.
export function defaultOrder(meta: SnapshotMeta | null): OrderCriteria {
  return meta !== null &&
    meta.measuring &&
    meta.measurement === 'ok' &&
    !meta.migrationEpoch
    ? 'inclusion'
    : 'stake';
}

export function epochRatioCell(
  v: Pick<ValidatorSnapshot, 'epochRatio' | 'epochRatioState'>
): string {
  const state = v.epochRatioState ?? 'pending';
  if (state === 'ok' && typeof v.epochRatio === 'number') {
    return formatRatio(v.epochRatio);
  }
  return state === 'unavailable' ? '—' : '…';
}

export function validatorRow(
  v: ValidatorSnapshot,
  mode: TableMode,
  maxChars: number
): ValidatorRow {
  const fullName = v.info?.info.name ?? v.identityPubkey;
  let identity = fullName.slice(0, maxChars);
  if (fullName.length > maxChars) identity = identity.concat('...');
  if (identity === '') identity = 'Unnamed';
  const inclusion = mode.showInclusion ? v.inclusion : undefined;
  // No paying blocks counted (Not measurable, Delinquent, or none yet):
  // Votes counted and Missed show "—", not 0 (types/measure.ts).
  const counted = inclusion && inclusion.payable > 0 ? inclusion : undefined;
  const skipRate = v.skipRate ?? 0;
  return {
    voteAccountPubkey: v.voteAccountPubkey,
    identity,
    identityPubKey: v.identityPubkey,
    icon: v.info?.info?.iconUrl,
    ranking: v.ranking ? `#${v.ranking}` : '-',
    stake: formatLamportsToSol(v.activatedStake),
    epochRatio: epochRatioCell(v),
    votesCounted: counted
      ? formatPercent(counted.included / counted.payable, 2)
      : '—',
    missed: counted ? String(counted.missed) : '—',
    commission: `${v.commission}%`,
    lastVote: String(v.lastVote),
    version: v.version,
    skipRate: `${Number.isInteger(skipRate) ? skipRate : skipRate.toFixed(2)}%`,
    status: inclusion ? inclusion.status : v.delinquent ? 'delinquent' : null,
  };
}

const ORDER_OPTIONS: Array<{ value: OrderCriteria; label: string }> = [
  { value: 'stake', label: 'Stake' },
  { value: 'inclusion', label: 'Votes counted' },
  { value: 'epochRatio', label: 'Epoch ratio' },
];

type HeaderLabelProps = {
  text: string;
  help?: string;
  // Desktop header row: the text keeps 12px, and a label that wraps fills its
  // whole cell, so it keeps 4px from each neighbour and centres its lines.
  inHeaderRow: boolean;
};

const HeaderLabel: FC<HeaderLabelProps> = ({ text, help, inHeaderRow }) => {
  const { colors } = useTheme();
  const label = (
    <Text
      color={colors.background['01']}
      align={inHeaderRow ? 'center' : 'left'}
      forceSize={inHeaderRow ? HEADER_FONT_SIZE : undefined}
      forceLineHeight={inHeaderRow ? HEADER_LINE_HEIGHT : undefined}
      content={text}
    />
  );
  if (help === undefined) return label;
  return (
    <div
      className={'flex items-center gap-5'}
      style={inHeaderRow ? { padding: '0 4px' } : undefined}
    >
      {label}
      <HelpTooltip text={help} size={'16px'} />
    </div>
  );
};

type OrderSelectorProps = {
  value: OrderCriteria;
  // The whole selector (migration epoch).
  disabled: boolean;
  // Orders the server can rank with the current snapshot (B4).
  available: (criteria: OrderCriteria) => boolean;
  isMobile: boolean;
  onChange: (criteria: OrderCriteria) => void;
};

// The order is the server's (rank, unranked last): no client-side sorting.
// On a phone the label goes above and the buttons share the full width.
const OrderSelector: FC<OrderSelectorProps> = ({
  value,
  disabled,
  available,
  isMobile,
  onChange,
}) => {
  const { colors } = useTheme();
  return (
    <div
      className={isMobile ? 'w-full flex-col gap-10' : 'flex items-center gap-10'}
    >
      <Text color={colors.background['01']} content={'Order by'} />
      <ToggleButtonGroup
        exclusive
        size={'small'}
        fullWidth={isMobile}
        value={value}
        disabled={disabled}
        aria-label={'Order by'}
        onChange={(_, next: OrderCriteria | null) => {
          if (next) onChange(next);
        }}
        sx={{
          '& .MuiToggleButton-root': {
            color: colors.background['00'],
            borderColor: colors.background['03'],
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: 700,
            textTransform: 'none',
            whiteSpace: isMobile ? 'normal' : 'nowrap',
          },
          '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover':
            {
              backgroundColor: colors.primary['02'],
              color: colors.background['00'],
            },
          '& .MuiToggleButton-root.Mui-disabled': {
            color: colors.background['03'],
          },
        }}
      >
        {ORDER_OPTIONS.map((option) => (
          // An explicit disabled on a button overrides the group's, so it
          // carries the group's too.
          <ToggleButton
            key={option.value}
            value={option.value}
            disabled={disabled || !available(option.value)}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
};

export const ValidatorsInfo: FC<ValidatorsInfoProps> = ({
  snapshot,
  meta,
  totalValidators,
  currentPage,
  pubKeyFilter,
  orderCriteria,
  setCurrentPageAction,
  setPubKeyFilterAction,
  setOrderCriteriaAction,
  onValidatorMonitorAction,
}) => {
  const { colors } = useTheme();
  const isMobile = useIsMobile();

  const mode = tableMode(meta);
  const widths = columnWidths(mode);
  const migrationEpoch = meta?.migrationEpoch ?? false;
  const available = (criteria: OrderCriteria) => orderAvailable(criteria, meta);
  // The migration epoch is ordered by stake (spec §6.5); a picked order the
  // server cannot rank shows its default until DataProvider drops it.
  const order: OrderCriteria = migrationEpoch
    ? 'stake'
    : orderCriteria !== null && available(orderCriteria)
      ? orderCriteria
      : defaultOrder(meta);
  const coverage = Math.round(meta?.inclusionCoverageSeconds ?? 0);
  const minMeasurableStake = meta?.minMeasurableStake ?? null;

  // A name cut by its cell ends in "…" (the cell's own ellipsis does not
  // reach text inside this flex row), and the avatar keeps its size.
  const identityCell = (size: Pixel, bold: boolean) => {
    const IdentityCell = (row: ValidatorRow) => (
    <div className={`w-full flex ${bold ? 'gap-5' : 'gap-15'} items-center`}>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {row.icon ? (
          <img
            alt={row.identityPubKey}
            src={row.icon}
            width={size}
            style={{ borderRadius: 9999 }}
          />
        ) : (
          <Avatar name={row.identity} size={size} />
        )}
      </div>
      <div
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        <Text weight={bold ? 700 : undefined} content={row.identity} />
      </div>
    </div>
    );
    return IdentityCell;
  };

  const headerLabel = (text: string, help?: string) => {
    const HeaderCell = () => (
      <HeaderLabel text={text} help={help} inHeaderRow={!isMobile} />
    );
    return HeaderCell;
  };

  const epochRatioColumn: TableColumn<ValidatorRow> = {
    label: headerLabel('Epoch ratio', HELP.epochRatio),
    prop: 'epochRatio',
    align: 'center',
    width: pct(widths.epochRatio),
    minWidth: columnMinWidth('epochRatio'),
    sortable: false,
    render: (row) =>
      row.epochRatio === '…' || row.epochRatio === '—' ? (
        <div className={'flex items-center gap-5'}>
          <Text content={row.epochRatio} />
          <HelpTooltip text={HELP.epochRatioPending} size={'16px'} />
        </div>
      ) : (
        <Text content={row.epochRatio} />
      ),
  };
  const votesCountedColumn: TableColumn<ValidatorRow> = {
    // No-break spaces keep "(VIR) · 287 s" on one line when the header wraps.
    label: headerLabel(
      `Votes counted (VIR)\u00a0·\u00a0${coverage}\u00a0s`,
      HELP.votesCounted
    ),
    prop: 'votesCounted',
    align: 'center',
    width: pct(widths.votesCounted),
    minWidth: columnMinWidth('votesCounted'),
    sortable: false,
  };
  const missedColumn: TableColumn<ValidatorRow> = {
    label: headerLabel('Missed', HELP.missed),
    prop: 'missed',
    align: 'center',
    width: pct(widths.missed),
    minWidth: columnMinWidth('missed'),
    sortable: false,
  };
  const lastVoteColumn: TableColumn<ValidatorRow> = {
    label: headerLabel('Last vote', HELP.lastVote),
    prop: 'lastVote',
    align: 'center',
    width: pct(widths.lastVote),
    minWidth: columnMinWidth('lastVote'),
  };
  const statusColumn: TableColumn<ValidatorRow> = {
    label: 'Status',
    prop: 'status',
    align: 'center',
    width: pct(widths.status),
    minWidth: columnMinWidth('status'),
    render: (row) =>
      row.status ? (
        <StatusChip
          status={row.status}
          minMeasurableStake={minMeasurableStake}
        />
      ) : null,
  };
  const measureColumn: TableColumn<ValidatorRow> = {
    label: '',
    prop: 'voteAccountPubkey',
    align: 'end',
    width: pct(widths.measure),
    minWidth: columnMinWidth('measure'),
    render: (row) => (
      <Button
        reduced
        icon={'start'}
        label={'Measure'}
        onClick={() => onValidatorMonitorAction(row.voteAccountPubkey)}
      />
    ),
  };
  const measurementColumns: TableColumn<ValidatorRow>[] = [
    ...(mode.showEpochRatio ? [epochRatioColumn] : []),
    ...(mode.showInclusion ? [votesCountedColumn, missedColumn] : []),
  ];

  const desktopColumns: TableColumn<ValidatorRow>[] = [
    {
      label: headerLabel('Rank'),
      prop: 'ranking',
      align: 'start',
      width: pct(widths.ranking),
      minWidth: columnMinWidth('ranking'),
    },
    {
      label: headerLabel('Identity'),
      prop: 'identity',
      align: 'start',
      width: pct(widths.identity),
      minWidth: columnMinWidth('identity'),
      render: identityCell('32px', false),
    },
    {
      label: headerLabel('Stake'),
      prop: 'stake',
      align: 'center',
      width: pct(widths.stake),
      minWidth: columnMinWidth('stake'),
    },
    ...measurementColumns,
    {
      label: headerLabel('Commission'),
      prop: 'commission',
      align: 'center',
      width: pct(widths.commission),
      minWidth: columnMinWidth('commission'),
    },
    lastVoteColumn,
    {
      label: headerLabel('Version'),
      prop: 'version',
      align: 'center',
      width: pct(widths.version),
      minWidth: columnMinWidth('version'),
    },
    {
      label: headerLabel('Skip rate', HELP.skipRate),
      prop: 'skipRate',
      align: 'center',
      width: pct(widths.skipRate),
      minWidth: columnMinWidth('skipRate'),
    },
    // The cards keep the plain "Status:" label.
    { ...statusColumn, label: headerLabel('Status') },
    measureColumn,
  ];

  const mobileColumns: TableColumn<ValidatorRow>[] = [
    {
      label: '',
      prop: 'identity',
      align: 'start',
      render: identityCell('20px', true),
    },
    { label: 'Rank', prop: 'ranking' },
    { label: 'Stake', prop: 'stake' },
    ...measurementColumns,
    lastVoteColumn,
    statusColumn,
    measureColumn,
  ];

  const rows = (snapshot?.validators ?? []).map((v) =>
    validatorRow(v, mode, isMobile ? 15 : 20)
  );

  return (
    <Surface
      width={'100%'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-15 items-center content-center'}>
        <div
          className={`w-full ${isMobile ? 'flex-col' : 'flex'} gap-15 items-center`}
        >
          <div className="w-full">
            <TextField
              placeholder={'Filter by identity, vote account or name'}
              updateModel={setPubKeyFilterAction}
            />
          </div>
          <OrderSelector
            value={order}
            disabled={migrationEpoch}
            available={available}
            isMobile={isMobile}
            onChange={setOrderCriteriaAction}
          />
        </div>
        {/* Below its narrowest width the desktop table scrolls sideways
            inside the card. A phone shows cards instead. */}
        <div
          data-testid={'validators-table'}
          style={{ width: '100%', overflowX: isMobile ? 'visible' : 'auto' }}
        >
          <div style={{ minWidth: isMobile ? undefined : tableMinWidth(mode) }}>
            <Table
              itemsPerPage={15}
              columns={isMobile ? mobileColumns : desktopColumns}
              data={rows}
              mobile={{
                useCards: true,
                spacingBetweenCols: '12px',
                spacingBetweenRows: '10px',
                cardBg: colors.background['03'],
              }}
            />
          </div>
        </div>
        <Paginator
          key={`${pubKeyFilter}|${order}`}
          elements={totalValidators}
          itemsPerPage={PAGE_SIZE}
          page={currentPage}
          onPageChange={setCurrentPageAction}
        />
      </div>
    </Surface>
  );
};
