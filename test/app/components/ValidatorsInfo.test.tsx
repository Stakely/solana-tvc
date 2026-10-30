import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import {
  COLUMN_MIN,
  ColumnMin,
  TableMode,
  ValidatorsInfo,
  ValidatorsInfoProps,
  WidthKey,
  columnMinWidth,
  columnWidths,
  epochRatioCell,
  tableMinWidth,
  tableMode,
  validatorRow,
} from '@/app/components/ValidatorsInfo.tsx';
import { HELP } from '@/app/components/measure-texts.ts';
import { SnapshotMeta, ValidatorInclusion } from '@/types/measure.ts';
import { ValidatorSnapshot } from '@/types/snapshot.ts';
import {
  VOTE,
  meta,
  renderUi,
  setViewportWidth,
  snapshot,
  validator,
} from '../support/fixtures.tsx';

const measuring = (extra: Partial<SnapshotMeta> = {}) =>
  meta({
    measuring: true,
    inclusionCoverageSeconds: 287.4,
    cluster: { payable: 95, stakeShareMissed: 0, alert: false },
    ...extra,
  });

const NBSP = String.fromCharCode(0xa0);

// The Table cell (header or row) around an element: the nearest box with a
// minimum width.
function cellOf(element: HTMLElement): HTMLElement {
  let node: HTMLElement | null = element;
  while (node !== null && node.style.minWidth === '') {
    node = node.parentElement;
  }
  if (node === null) throw new Error('no table cell around the element');
  return node;
}

function renderTable(
  validators: ValidatorSnapshot[],
  metaValue: SnapshotMeta | null,
  extra: Partial<ValidatorsInfoProps> = {}
) {
  const actions = {
    setCurrentPageAction: jest.fn(),
    setPubKeyFilterAction: jest.fn(),
    setOrderCriteriaAction: jest.fn(),
    onValidatorMonitorAction: jest.fn(),
  };
  renderUi(
    <ValidatorsInfo
      snapshot={snapshot(validators)}
      meta={metaValue}
      totalValidators={validators.length}
      currentPage={1}
      pubKeyFilter={''}
      orderCriteria={null}
      {...actions}
      {...extra}
    />
  );
  return actions;
}

describe('validatorRow', () => {
  it('prints the epoch ratio with 4 decimals, "…" while pending and "—" when unavailable', () => {
    expect(epochRatioCell({ epochRatio: 0.99942, epochRatioState: 'ok' })).toBe(
      '0.9994'
    );
    expect(
      epochRatioCell({ epochRatio: null, epochRatioState: 'pending' })
    ).toBe('…');
    expect(
      epochRatioCell({ epochRatio: null, epochRatioState: 'unavailable' })
    ).toBe('—');
    expect(epochRatioCell({})).toBe('…');
  });

  it('never divides by zero and shows the measured status', () => {
    const mode = tableMode(measuring());
    const row = validatorRow(
      validator({
        inclusion: { status: 'measuring', included: 0, payable: 0, missed: 0 },
      }),
      mode,
      20
    );
    expect(row.votesCounted).toBe('—');
    expect(row.missed).toBe('—');
    expect(row.status).toBe('measuring');
    expect(
      validatorRow(
        validator({
          inclusion: { status: 'ok', included: 99, payable: 100, missed: 1 },
        }),
        mode,
        20
      ).votesCounted
    ).toBe('99.00%');
  });

  it('shows "—" in Missed without paying blocks and the count with them', () => {
    const mode = tableMode(measuring());
    const missed = (inclusion: ValidatorInclusion) =>
      validatorRow(validator({ inclusion }), mode, 20).missed;
    expect(
      missed({ status: 'not_measurable', included: 0, payable: 0, missed: 0 })
    ).toBe('—');
    expect(missed({ status: 'ok', included: 99, payable: 100, missed: 1 })).toBe(
      '1'
    );
    expect(
      missed({ status: 'ok', included: 100, payable: 100, missed: 0 })
    ).toBe('0');
  });

  it('reads Measuring and "…" until the first intervals are measured', () => {
    const mode = tableMode(meta());
    expect(mode.inclusionPending).toBe(true);
    expect(validatorRow(validator({ delinquent: true }), mode, 20).status).toBe(
      'delinquent'
    );
    const row = validatorRow(validator(), mode, 20);
    expect(row.status).toBe('measuring');
    expect(row.votesCounted).toBe('…');
    expect(row.missed).toBe('…');
  });

  it('shows only Delinquent, and "—", under review and in the migration epoch', () => {
    for (const metaValue of [
      meta({ measurement: 'under_review' }),
      meta({ migrationEpoch: true }),
    ]) {
      const mode = tableMode(metaValue);
      expect(mode.inclusionPending).toBe(false);
      const row = validatorRow(validator(), mode, 20);
      expect(row.status).toBeNull();
      expect(row.votesCounted).toBe('—');
      expect(
        validatorRow(validator({ delinquent: true }), mode, 20).status
      ).toBe('delinquent');
    }
  });

  it('names the client under the version', () => {
    const mode = tableMode(meta());
    expect(validatorRow(validator({ client: 'JitoLabs' }), mode, 20).client).toBe(
      'Jito'
    );
    expect(validatorRow(validator(), mode, 20).client).toBe('');
  });

  it('hides the epoch ratio under review and in the migration epoch', () => {
    expect(tableMode(meta()).showEpochRatio).toBe(true);
    expect(tableMode(meta({ measurement: 'under_review' })).showEpochRatio).toBe(
      false
    );
    expect(tableMode(meta({ migrationEpoch: true })).showEpochRatio).toBe(false);
  });
});

describe('columnWidths', () => {
  it('adds up to 100% in every mode and leaves room for the name', () => {
    for (const metaValue of [
      meta(),
      measuring(),
      meta({ migrationEpoch: true }),
      meta({ measuring: true, measurement: 'under_review' }),
    ]) {
      const widths = columnWidths(tableMode(metaValue));
      expect(Object.values(widths).reduce((sum, w) => sum + w, 0)).toBe(100);
      expect(widths.identity).toBeGreaterThanOrEqual(14);
    }
  });
});

// The widest the desktop table gets: main is at most 1280px wide, minus its
// 30px side padding and the card's 30px padding and 1px border on each side.
// Above 1440px (the 16px root) every table is this wide.
const WIDEST_TABLE_PX = 1280 - 2 * 30 - 2 * 30 - 2;
// Table rows have 8px of padding on each side.
const ROW_PADDING_PX = 16;
const WIDEST_ROW_PX = WIDEST_TABLE_PX - ROW_PADDING_PX;
// The root font is 12px up to 1440px wide and 16px above (globals.css).
const ROOT_FONTS = [12, 16] as const;
// What every minimum keeps over what was measured, for other browsers.
const SPARE_PX = 1;

// Room each column needs, in px with the 12px and with the 16px root font,
// measured with Plus Jakarta Sans in Edge on a replica of the table: its
// header (12px text with either root) with the help icon, wrapped on up to 3
// lines, or its widest usual cell, plus the gap to the next column. With
// less, a header spills over its neighbours or the cell is cut off (Table
// cells do not grow with their content).
const MEASURED: Record<WidthKey, readonly [number, number]> = {
  ranking: [42, 54], // "#1234"
  identity: [52, 52], // "Identity"
  stake: [65, 85], // "12.3M SOL"
  epochRatio: [67, 67], // "Epoch" over "ratio" and the help icon
  votesCounted: [96, 96], // "(VIR) · 300 s" and the help icon
  missed: [70, 70], // "Missed" and the help icon
  commission: [80, 80], // "Commission"
  lastVote: [69, 90], // "412345678"
  // "Version", "26.10.4" with the 16px root, and "Harmonic FD" in 11px.
  version: [68, 68],
  skipRate: [55, 62], // "Skip" over "rate" and the help icon, and "12.34%"
  status: [120, 145], // the "Not measurable" chip and its help icon
  measure: [106, 123], // the Measure button with its icon
};

const MODES: TableMode[] = [
  meta(),
  measuring(),
  meta({ migrationEpoch: true }),
  meta({ measuring: true, measurement: 'under_review' }),
].map(tableMode);

const inPx = (min: ColumnMin, rootFont: number) => min.rem * rootFont + min.px;

function parseCalc(css: string): ColumnMin {
  const match = /^calc\(([\d.]+)rem \+ ([\d.]+)px\)$/.exec(css);
  if (match === null) throw new Error(`not a rem + px length: ${css}`);
  return { rem: Number(match[1]), px: Number(match[2]) };
}

const shownColumns = (mode: TableMode): WidthKey[] => {
  const widths = columnWidths(mode);
  return (Object.keys(widths) as WidthKey[]).filter((key) => widths[key] > 0);
};

describe('column minimums', () => {
  it('give every column the room its header and cells were measured to need, and some to spare', () => {
    const tooNarrow: string[] = [];
    for (const key of Object.keys(MEASURED) as WidthKey[]) {
      ROOT_FONTS.forEach((rootFont, i) => {
        if (inPx(COLUMN_MIN[key], rootFont) < MEASURED[key][i] + SPARE_PX) {
          tooNarrow.push(`${key} with the ${rootFont}px root`);
        }
      });
      expect(parseCalc(columnMinWidth(key))).toEqual(COLUMN_MIN[key]);
    }
    expect(tooNarrow).toEqual([]);
  });

  it('add up, with the row padding, to the narrowest table of each mode', () => {
    for (const mode of MODES) {
      const narrowest = parseCalc(tableMinWidth(mode));
      for (const rootFont of ROOT_FONTS) {
        const expected = shownColumns(mode).reduce(
          (sum, key) => sum + inPx(COLUMN_MIN[key], rootFont),
          ROW_PADDING_PX
        );
        expect(inPx(narrowest, rootFont)).toBeCloseTo(expected, 6);
      }
    }
    expect(shownColumns(tableMode(measuring()))).toHaveLength(12);
  });

  it('fit in the widest table with either root font, so wide screens never scroll', () => {
    for (const mode of MODES) {
      for (const rootFont of ROOT_FONTS) {
        const narrowest = inPx(parseCalc(tableMinWidth(mode)), rootFont);
        expect(narrowest).toBeLessThanOrEqual(WIDEST_TABLE_PX);
      }
    }
  });

  // A column whose share is below its minimum takes the room from the others:
  // on the widest table every column, Identity included, keeps its share.
  it('stay below the column shares on the widest table with either root font', () => {
    const squeezed: string[] = [];
    for (const mode of MODES) {
      const widths = columnWidths(mode);
      for (const key of shownColumns(mode)) {
        const share = (widths[key] / 100) * WIDEST_ROW_PX;
        for (const rootFont of ROOT_FONTS) {
          if (share < inPx(COLUMN_MIN[key], rootFont)) {
            squeezed.push(`${key} with the ${rootFont}px root`);
          }
        }
      }
    }
    expect(squeezed).toEqual([]);
  });

  it('leave Identity at least 14% of the widest row with either root font', () => {
    const narrow: string[] = [];
    for (const mode of MODES) {
      const widths = columnWidths(mode);
      for (const rootFont of ROOT_FONTS) {
        // Each other column takes its share, or its minimum when larger.
        const others = shownColumns(mode)
          .filter((key) => key !== 'identity')
          .reduce(
            (sum, key) =>
              sum +
              Math.max(
                (widths[key] / 100) * WIDEST_ROW_PX,
                inPx(COLUMN_MIN[key], rootFont)
              ),
            0
          );
        const identity = (WIDEST_ROW_PX - others) / WIDEST_ROW_PX;
        if (identity < 0.14) {
          narrow.push(`${(identity * 100).toFixed(1)}% with the ${rootFont}px root`);
        }
      }
    }
    expect(narrow).toEqual([]);
  });
});

describe('ValidatorsInfo', () => {
  it('keeps the Votes counted columns, measuring, before the first intervals', () => {
    renderTable([validator({ client: 'Firedancer' })], meta());
    expect(screen.queryByText('Earned credits')).toBeNull();
    expect(screen.getByText('0.9994')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: HELP.epochRatio })).toBeInTheDocument();
    expect(screen.getByText('Votes counted (VIR)')).toBeInTheDocument();
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByText('Firedancer')).toBeInTheDocument();
  });

  it('adds votes counted and missed, with the seconds covered, while measuring', () => {
    renderTable(
      [
        validator({
          inclusion: { status: 'missing', included: 95, payable: 100, missed: 5 },
        }),
      ],
      measuring()
    );
    expect(screen.getByText('Votes counted (VIR) · 287 s')).toBeInTheDocument();
    expect(screen.getByText('95.00%')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Missing votes')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: HELP.votesCounted })
    ).toBeInTheDocument();
  });

  it('keeps the header in step with the rows when a column comes and goes', () => {
    const props = {
      snapshot: snapshot([
        validator({
          inclusion: { status: 'ok', included: 100, payable: 100, missed: 0 },
        }),
      ]),
      totalValidators: 1,
      currentPage: 1,
      pubKeyFilter: '',
      orderCriteria: null,
      setCurrentPageAction: jest.fn(),
      setPubKeyFilterAction: jest.fn(),
      setOrderCriteriaAction: jest.fn(),
      onValidatorMonitorAction: jest.fn(),
    };
    const headers = () =>
      // The header row holds the columns, each with its minimum width.
      [...cellOf(screen.getByText('Rank')).parentElement!.children].map(
        // Without the arrow of the column the table is ordered by.
        (cell) => cell.textContent?.replace(/[▲▼]/g, '')
      );
    // The epoch ratio column leaves under review and comes back.
    const view = renderUi(<ValidatorsInfo {...props} meta={measuring()} />);
    const busy = headers();
    expect(busy).toContain('Epoch ratio');
    expect(busy.indexOf('Missed')).toBe(busy.indexOf('Commission') - 1);

    const review = meta({ measuring: true, measurement: 'under_review' });
    view.rerender(<ValidatorsInfo {...props} meta={review} />);
    const reviewed = headers();
    expect(reviewed).toHaveLength(busy.length - 1);
    expect(reviewed).not.toContain('Epoch ratio');
    expect(reviewed.indexOf('Stake')).toBe(reviewed.indexOf('Votes counted (VIR)') - 1);

    view.rerender(<ValidatorsInfo {...props} meta={measuring()} />);
    expect(headers()).toEqual(busy);
  });

  it('hides the epoch ratio while the measurement is under review', () => {
    renderTable(
      [validator()],
      meta({ measuring: true, measurement: 'under_review' })
    );
    expect(screen.queryByRole('img', { name: HELP.epochRatio })).toBeNull();
    expect(screen.queryByText('0.9994')).toBeNull();
  });

  it('shows the Delinquent chip from the CLI flag', () => {
    renderTable([validator({ delinquent: true })], meta());
    expect(screen.getByText('Delinquent')).toBeInTheDocument();
  });

  it('measures by vote account', () => {
    const actions = renderTable([validator()], meta());
    fireEvent.click(screen.getByRole('button', { name: 'Measure' }));
    expect(actions.onValidatorMonitorAction).toHaveBeenCalledWith(VOTE);
  });

  it('scrolls the table sideways below its narrowest width', () => {
    renderTable([validator()], measuring());
    const box = screen.getByTestId('validators-table');
    expect(box.style.overflowX).toBe('auto');
    expect((box.firstElementChild as HTMLElement).style.minWidth).toBe(
      tableMinWidth(tableMode(measuring()))
    );
  });

  it('keeps headers and the Measure button at their minimum width', () => {
    renderTable(
      [
        validator({
          inclusion: { status: 'ok', included: 99, payable: 100, missed: 1 },
        }),
      ],
      measuring()
    );
    expect(cellOf(screen.getByText('Commission')).style.minWidth).toBe(
      columnMinWidth('commission')
    );
    expect(cellOf(screen.getByText('Missed')).style.minWidth).toBe(
      columnMinWidth('missed')
    );
    expect(
      cellOf(screen.getByRole('button', { name: 'Measure' })).style.minWidth
    ).toBe(columnMinWidth('measure'));
    expect(cellOf(screen.getByText('99.00%')).style.minWidth).toBe(
      columnMinWidth('votesCounted')
    );
  });

  it('keeps a wrapped header off its neighbours, with "(VIR) · N s" whole', () => {
    renderTable([validator()], measuring());
    const missed = screen.getByText('Missed');
    expect(missed).toHaveStyle({ textAlign: 'center' });
    expect(missed.closest('div')).toHaveStyle({
      paddingLeft: '4px',
      paddingRight: '4px',
    });
    expect(screen.getByText('Votes counted (VIR) · 287 s').textContent).toBe(
      `Votes counted (VIR)${NBSP}·${NBSP}287${NBSP}s`
    );
  });

  // The 12px of the root font up to 1440px wide, also with the 16px root:
  // the minimums of the columns sized by their header do not grow with it.
  it('keeps the header text at 12px with either root font', () => {
    renderTable([validator()], measuring());
    // The order buttons outside the table say "Stake" and "Epoch ratio" too.
    const table = within(screen.getByTestId('validators-table'));
    for (const header of [
      'Rank',
      'Identity',
      'Stake',
      'Epoch ratio',
      'Votes counted (VIR) · 287 s',
      'Missed',
      'Commission',
      'Last vote',
      'Version',
      'Skip rate',
      'Status',
    ]) {
      expect(table.getByText(header)).toHaveStyle({ fontSize: '12px' });
    }
    expect(table.getByText('Puffin Validator')).not.toHaveStyle({
      fontSize: '12px',
    });
  });

  it('ends a name cut by its cell in "…" and keeps the avatar whole', () => {
    renderTable([validator()], measuring());
    const nameBox = screen.getByText('Puffin Validator')
      .parentElement as HTMLElement;
    expect(nameBox.style.overflow).toBe('hidden');
    expect(nameBox.style.textOverflow).toBe('ellipsis');
    expect(parseFloat(nameBox.style.minWidth)).toBe(0);
    expect(
      (nameBox.previousElementSibling as HTMLElement).style.flexShrink
    ).toBe('0');
  });

  it('shows the server default order and sends the one the user picks', () => {
    const actions = renderTable([validator()], measuring());
    expect(
      screen.getByRole('button', { name: 'Stake', pressed: true })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Epoch ratio' }));
    expect(actions.setOrderCriteriaAction).toHaveBeenCalledWith(
      'epochRatio',
      'desc'
    );
  });

  it('orders by a column when its header is clicked, and flips on a second click', () => {
    const actions = renderTable([validator()], measuring());
    fireEvent.click(screen.getByRole('button', { name: 'Order by Commission' }));
    expect(actions.setOrderCriteriaAction).toHaveBeenLastCalledWith(
      'commission',
      'asc'
    );
    cleanup();
    const again = renderTable([validator()], measuring(), {
      orderCriteria: 'commission',
      orderDirection: 'asc',
    });
    const header = screen.getByRole('button', { name: 'Order by Commission' });
    expect(header).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(header);
    expect(again.setOrderCriteriaAction).toHaveBeenLastCalledWith(
      'commission',
      'desc'
    );
  });

  it('does not offer the measured columns as orders when the server cannot rank them', () => {
    renderTable([validator()], meta());
    expect(
      screen.queryByRole('button', { name: /Order by Votes counted/ })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Order by Missed' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Order by Stake' })
    ).toBeInTheDocument();
  });

  it('fixes the order on stake and hides the epoch ratio in the migration epoch', () => {
    renderTable(
      [validator({ epochRatio: null, epochRatioState: 'unavailable' })],
      meta({ migrationEpoch: true }),
      { orderCriteria: 'epochRatio' }
    );
    const stake = screen.getByRole('button', { name: 'Stake', pressed: true });
    expect(stake).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Epoch ratio' })).toBeDisabled();
    expect(screen.queryByRole('img', { name: HELP.epochRatio })).toBeNull();
    expect(
      screen.queryByRole('img', { name: HELP.epochRatioPending })
    ).toBeNull();
    // Only Votes counted and Missed, with nothing to count.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('disables the orders the server cannot rank', () => {
    renderTable([validator()], meta());
    expect(
      screen.getByRole('button', { name: 'Stake', pressed: true })
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Votes counted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Epoch ratio' })).toBeEnabled();
  });

  it('disables votes counted and epoch ratio under review', () => {
    renderTable(
      [validator()],
      meta({ measuring: true, measurement: 'under_review' })
    );
    expect(screen.getByRole('button', { name: 'Votes counted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Epoch ratio' })).toBeDisabled();
  });

  it('filters and pages through the server', () => {
    const actions = renderTable([validator()], meta(), { totalValidators: 25 });
    fireEvent.change(
      screen.getByPlaceholderText('Filter by identity, vote account or name'),
      { target: { value: ' abc ' } }
    );
    expect(actions.setPubKeyFilterAction).toHaveBeenCalledWith('abc');
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(actions.setCurrentPageAction).toHaveBeenCalledWith(2);
  });
});

describe('ValidatorsInfo on a phone', () => {
  beforeEach(() => setViewportWidth(375));
  // Unmount first: a resize with the table mounted re-renders it outside act.
  afterEach(() => {
    cleanup();
    setViewportWidth(1024);
  });

  it('shows the same measurement data in the cards', () => {
    renderTable(
      [
        validator({
          inclusion: { status: 'missing', included: 95, payable: 100, missed: 5 },
        }),
      ],
      measuring()
    );
    expect(screen.getByText('0.9994')).toBeInTheDocument();
    expect(screen.getByText('95.00%')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Missing votes')).toBeInTheDocument();
    expect(screen.getByText('Votes counted (VIR) · 287 s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Measure' })).toBeInTheDocument();
    expect(screen.queryByText(/Commission/)).toBeNull();
    expect(screen.queryByText(/Version/)).toBeNull();
    expect(screen.queryByText(/Skip rate/)).toBeNull();
  });

  it('fits the cards to the screen, with no minimum width', () => {
    renderTable([validator()], measuring());
    const box = screen.getByTestId('validators-table');
    expect(box.style.overflowX).toBe('visible');
    expect((box.firstElementChild as HTMLElement).style.minWidth).toBe('');
    expect(screen.getByText('Missed').parentElement?.style.paddingLeft).toBe(
      ''
    );
    expect(screen.getByText('Missed')).not.toHaveStyle({ fontSize: '12px' });
  });
});
