'use client';

import { FC } from 'react';
import {
  OrderCriteria,
  OrderDirection,
  Snapshot,
  ValidatorSnapshot,
  defaultDirection,
} from '@/types/snapshot.ts';
import { InclusionStatus, SnapshotMeta } from '@/types/measure.ts';
import {
  formatLamportsCompact,
  formatPercent,
  formatRatio,
} from '@/app/utils.ts';
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
import { clientLabel } from '@/app/client-label.ts';

export type ValidatorsInfoProps = {
  totalValidators: number;
  currentPage: number;
  pubKeyFilter: string;
  snapshot: Snapshot | null;
  meta: SnapshotMeta | null;
  // Picked by the user; null shows the server default.
  orderCriteria: OrderCriteria | null;
  orderDirection?: OrderDirection;
  setCurrentPageAction: (page: number) => void;
  setPubKeyFilterAction: (key: string) => void;
  setOrderCriteriaAction: (
    criteria: OrderCriteria,
    direction?: OrderDirection
  ) => void;
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
  version: string;
  // Short client name (Agave, Jito, Firedancer…), '' when unknown.
  client: string;
  skipRate: string;
  status: InclusionStatus | null;
};

export type TableMode = {
  // VIR and the full status have numbers to show.
  showInclusion: boolean;
  // Not yet: the first intervals since the table was opened are being
  // measured, so the cells read "…" and the status Measuring.
  inclusionPending: boolean;
  showEpochRatio: boolean;
};

// VIR and the full status come while the table is open on this
// replica and the measurement is trusted (spec §5.1, §6.3); their columns
// stay in place meanwhile, so the table does not jump. The epoch ratio is
// hidden under review and in the migration epoch (§4.8, §5.2).
export function tableMode(meta: SnapshotMeta | null): TableMode {
  const showInclusion = meta?.inclusionCoverageSeconds !== undefined;
  const hidden = meta?.measurement === 'under_review' || !!meta?.migrationEpoch;
  return {
    showInclusion,
    inclusionPending: !showInclusion && !hidden,
    showEpochRatio: !hidden,
  };
}

export type WidthKey =
  | 'ranking'
  | 'identity'
  | 'stake'
  | 'epochRatio'
  | 'votesCounted'
  | 'missed'
  | 'version'
  | 'skipRate'
  | 'status'
  | 'measure';

type FixedWidths = Record<Exclude<WidthKey, 'identity'>, number>;

// Ten columns: each one gets the smallest quarter percent that holds its
// minimum with either root font on the table of a 1280px wide screen
// (1158px), so it holds on every wider one up to the widest (1288px), and
// Identity takes the rest (21%). A column cannot grow past its share: its
// width caps the minimum of its content.
const SHARES: FixedWidths = {
  ranking: 5,
  stake: 7.75,
  epochRatio: 10,
  votesCounted: 9.5,
  missed: 7.75,
  version: 6.25,
  skipRate: 8.5,
  status: 13,
  measure: 11.25,
};

// Desktop column widths in percent. Identity takes what the shown columns
// leave, so every mode adds up to 100% and the header stays aligned with the
// rows (Table lays them out with flex and nowrap cells).
export function columnWidths(mode: TableMode): Record<WidthKey, number> {
  const shown: FixedWidths = {
    ...SHARES,
    epochRatio: mode.showEpochRatio ? SHARES.epochRatio : 0,
  };
  const used = Object.values(shown).reduce((sum, width) => sum + width, 0);
  return { ...shown, identity: 100 - used };
}

const pct = (width: number): Percentage => `${width}%`;

export type ColumnMin = { rem: number; px: number };

// The desktop header text is 13px with either root font (12px up to 1440px
// wide, 16px above). Grown by a third, the headers of the twelve columns left
// Identity 11% of the row while measuring. The line height is body1's 1.26rem
// at the 12px root.
const HEADER_FONT_SIZE: Pixel = '13px';
const HEADER_LINE_HEIGHT = 1.26;
// The client under the version, at any root font.
const CLIENT_FONT_SIZE: Pixel = '11px';

// The narrowest each desktop column can get: text that scales with the root
// font (12px up to 1440px wide, 16px above) in rem, and icons, paddings, the
// gap to the next column, 1px to spare (4px for the button) and the 13px
// header text in px. Measured with Plus Jakarta Sans in a browser with both
// root sizes. Table cells do not grow with their content: without these
// minimums a header spills over its neighbours and the Measure button is cut
// off.
export const COLUMN_MIN: Record<WidthKey, ColumnMin> = {
  ranking: { rem: 3, px: 7 }, // "#1234"
  identity: { rem: 4, px: 47 }, // the 32px avatar, its gap and a few letters
  stake: { rem: 5, px: 6 }, // "12.3M", still sized for "12.3M SOL"
  // The sortable headers below keep room for the sort arrow.
  epochRatio: { rem: 0, px: 113 }, // "Epoch ratio" and the help icon
  votesCounted: { rem: 0, px: 106 }, // "VIR · 300 s" and the help icon
  missed: { rem: 0, px: 86 }, // "Missed" and the help icon
  // "Version", "26.10.4" with the 16px root, and the client below it in
  // 11px ("Harmonic FD"); longer ones end in "…".
  version: { rem: 0, px: 69 },
  // "Skip rate" and the help icon; "12.34%" with the 16px root is narrower.
  skipRate: { rem: 0, px: 96 },
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

// The order the server applies when the user picked none: stake, so the
// table does not reorder when VIR arrives.
export function defaultOrder(): OrderCriteria {
  return 'stake';
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
  // VIR and Missed show "—", not 0 (types/measure.ts). While the
  // first intervals are measured they show "…".
  const counted = inclusion && inclusion.payable > 0 ? inclusion : undefined;
  const noCount = mode.inclusionPending ? '…' : '—';
  const skipRate = v.skipRate ?? 0;
  return {
    voteAccountPubkey: v.voteAccountPubkey,
    identity,
    identityPubKey: v.identityPubkey,
    icon: v.info?.info?.iconUrl,
    ranking: v.ranking ? `#${v.ranking}` : '-',
    stake: formatLamportsCompact(v.activatedStake),
    epochRatio: epochRatioCell(v),
    votesCounted: counted
      ? formatPercent(counted.included / counted.payable, 2)
      : noCount,
    missed: counted ? String(counted.missed) : noCount,
    version: v.version,
    client: clientLabel(v.client),
    skipRate: `${Number.isInteger(skipRate) ? skipRate : skipRate.toFixed(2)}%`,
    status: inclusion
      ? inclusion.status
      : v.delinquent
        ? 'delinquent'
        : mode.inclusionPending
          ? 'measuring'
          : null,
  };
}


// A sortable header: clicking it orders the table by its column, and
// clicking it again flips the direction.
export type HeaderSort = {
  active: boolean;
  direction: OrderDirection;
  onClick: () => void;
};

type HeaderLabelProps = {
  text: string;
  help?: string;
  // Desktop header row: the text keeps 13px on one line, and a label with a
  // help icon keeps 4px from each neighbour.
  inHeaderRow: boolean;
  sort?: HeaderSort;
};

const PLAIN_BUTTON = {
  background: 'none',
  border: 0,
  padding: 0,
  margin: 0,
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  whiteSpace: 'inherit',
} as const;

// The desktop headers never wrap: COLUMN_MIN holds each one on a line.
const ONE_LINE = { whiteSpace: 'nowrap' } as const;

const HeaderLabel: FC<HeaderLabelProps> = ({
  text,
  help,
  inHeaderRow,
  sort,
}) => {
  const { colors } = useTheme();
  const textLabel = (
    <Text
      color={sort?.active ? colors.primary['03'] : colors.background['01']}
      align={inHeaderRow ? 'center' : 'left'}
      forceSize={inHeaderRow ? HEADER_FONT_SIZE : undefined}
      forceLineHeight={inHeaderRow ? HEADER_LINE_HEIGHT : undefined}
      content={text}
    />
  );
  // The arrow goes right of the text; COLUMN_MIN keeps room for it.
  const label = sort ? (
    <button
      type={'button'}
      onClick={sort.onClick}
      aria-label={`Order by ${text}`}
      aria-pressed={sort.active}
      style={PLAIN_BUTTON}
    >
      {textLabel}
      {sort.active && (
        <span
          aria-hidden={'true'}
          style={{
            fontSize: 9,
            lineHeight: 1,
            color: colors.primary['03'],
          }}
        >
          {sort.direction === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </button>
  ) : (
    textLabel
  );
  if (help === undefined) {
    return inHeaderRow ? <div style={ONE_LINE}>{label}</div> : label;
  }
  return (
    <div
      className={'flex items-center gap-5'}
      style={inHeaderRow ? { ...ONE_LINE, padding: '0 4px' } : undefined}
    >
      {label}
      <HelpTooltip text={help} size={'16px'} />
    </div>
  );
};

// The version and, below it in small type, the client that runs it.
const VersionCell: FC<{ version: string; client: string }> = ({
  version,
  client,
}) => {
  const { colors } = useTheme();
  return (
    <div className={'flex-col items-center'} style={{ minWidth: 0 }}>
      <Text content={version} alt={version} />
      {client !== '' && (
        <Text
          color={colors.background['01']}
          forceSize={CLIENT_FONT_SIZE}
          forceLineHeight={HEADER_LINE_HEIGHT}
          content={client}
          alt={client}
        />
      )}
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
  orderDirection,
  setCurrentPageAction,
  setPubKeyFilterAction,
  setOrderCriteriaAction,
  onValidatorMonitorAction,
}) => {
  // Out of the React Compiler: the Table calls the header and cell functions
  // below as plain functions, not mounted as components. Named like
  // components, they got a memo cache that lived in the Table and kept
  // serving the header of the first render.
  'use no memo';
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
      : defaultOrder();
  const direction: OrderDirection =
    order === orderCriteria && orderDirection
      ? orderDirection
      : defaultDirection(order);
  // A header of the column the table is ordered by flips the direction.
  const sortBy = (criteria: OrderCriteria): HeaderSort | undefined =>
    isMobile || migrationEpoch || !available(criteria)
      ? undefined
      : {
          active: order === criteria,
          direction,
          onClick: () =>
            setOrderCriteriaAction(
              criteria,
              order === criteria
                ? direction === 'asc'
                  ? 'desc'
                  : 'asc'
                : defaultDirection(criteria)
            ),
        };
  const coverage = meta?.inclusionCoverageSeconds;
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

  const headerLabel = (
    text: string,
    help?: string,
    sortKey?: OrderCriteria
  ) => {
    const sort = sortKey ? sortBy(sortKey) : undefined;
    const HeaderCell = () => (
      <HeaderLabel
        text={text}
        help={help}
        inHeaderRow={!isMobile}
        sort={sort}
      />
    );
    return HeaderCell;
  };

  const epochRatioColumn: TableColumn<ValidatorRow> = {
    label: headerLabel('Epoch ratio', HELP.epochRatio, 'epochRatio'),
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
    label: headerLabel(
      coverage === undefined
        ? 'VIR'
        : `VIR\u00a0·\u00a0${Math.round(coverage)}\u00a0s`,
      HELP.votesCounted,
      'inclusion'
    ),
    prop: 'votesCounted',
    align: 'center',
    width: pct(widths.votesCounted),
    minWidth: columnMinWidth('votesCounted'),
    sortable: false,
  };
  const missedColumn: TableColumn<ValidatorRow> = {
    label: headerLabel('Missed', HELP.missed, 'missed'),
    prop: 'missed',
    align: 'center',
    width: pct(widths.missed),
    minWidth: columnMinWidth('missed'),
    sortable: false,
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
    votesCountedColumn,
    missedColumn,
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
      label: headerLabel('Identity', undefined, 'name'),
      prop: 'identity',
      align: 'start',
      width: pct(widths.identity),
      minWidth: columnMinWidth('identity'),
      render: identityCell('32px', false),
    },
    {
      label: headerLabel('Stake', undefined, 'stake'),
      prop: 'stake',
      align: 'center',
      width: pct(widths.stake),
      minWidth: columnMinWidth('stake'),
    },
    ...measurementColumns,
    {
      label: headerLabel('Version', undefined, 'version'),
      prop: 'version',
      align: 'center',
      width: pct(widths.version),
      minWidth: columnMinWidth('version'),
      render: (row) => <VersionCell version={row.version} client={row.client} />,
    },
    {
      label: headerLabel('Skip rate', HELP.skipRate, 'skipRate'),
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
    statusColumn,
    measureColumn,
  ];

  const rows = (snapshot?.validators ?? []).map((v) =>
    validatorRow(v, mode, isMobile ? 15 : 20)
  );
  const columns = isMobile ? mobileColumns : desktopColumns;
  // When VIR and Missed come and go (someone starts or stops
  // measuring) the header kept the labels of the old columns while the rows
  // moved on. A new set of columns mounts a new Table.
  const columnsKey = columns.map((c) => String(c.prop)).join('|');

  return (
    <Surface
      width={'100%'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-15 items-center content-center'}>
        <div className="w-full">
          <TextField
            placeholder={'Filter by identity, vote account or name'}
            updateModel={setPubKeyFilterAction}
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
              key={columnsKey}
              itemsPerPage={15}
              columns={columns}
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
