'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { Percentage, Pixel } from '@/app/components/utils/Measures.ts';
import { useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Accordion, Divider, Icon, Surface, Text } from '@/app/components';

export type TableColumn<T> = {
  /**
   * The key of the property in the data object to display in this column.
   * Acts as a pointer to the value in the data row.
   */
  prop: keyof T;

  /**
   * The label shown as the column header.
   */
  label: string | (() => ReactNode);

  /**
   * Optional custom rendering function for the cell content.
   * Receives the full data row and returns a ReactNode.
   * If not provided, the table displays the raw stringified value.
   */
  render?: (c: T) => ReactNode;

  /**
   * Whether the column is sortable or not.
   * If true, a sorting icon will be shown and clicking it toggles ascending/descending order.
   */
  sortable?: boolean;

  /**
   * Optional column width as a percentage string (e.g., '25%').
   * If not specified, widths are evenly distributed.
   */
  width?: Percentage;

  /**
   * Optional alignment of the content within the column.
   * - 'start' (default): left-aligned.
   * - 'center': centered.
   * - 'end': right-aligned.
   */
  align?: 'start' | 'center' | 'end';
};

export type TableProps<T> = {
  /**
   * The array of data items to be rendered in the table.
   */
  data: Array<T>;

  /**
   * Array of column definitions describing how to display the data.
   *
   * Each column must define the `prop` and `label`.
   * Optionally, it can include:
   * - `render`: custom rendering logic for the cell.
   * - `sortable`: if true, adds sorting behavior to the column header.
   * - `width`: sets the column width.
   * - `align`: aligns content within the column.
   *
   * 📌 Special behavior:
   * If an object in `data` includes a function named `onExpand`, the table will render
   * that row inside an `Accordion` and invoke `onExpand(row)` to render nested content.
   * This allows expandable rows with custom detail views.
   */
  columns: Array<TableColumn<T>>;

  /**
   * Number of rows to display per page.
   * If the data exceeds this limit, a paginator will be rendered.
   * Default: 10
   */
  itemsPerPage?: number;

  /**
   * Whether to show the border (divider) after the last row.
   * Default: true
   */
  lastIndexBorder?: boolean;

  /**
   * Function to determine whether a row can be selected.
   * Return true to make the row clickable/selectable.
   */
  isRowSelectable?: (row: T) => boolean;

  /**
   * Function to determine if a row is currently selected.
   * Useful to visually highlight selected rows.
   */
  isRowSelected?: (row: T) => boolean;

  /**
   * Background color applied to selected rows.
   * Only used when `isRowSelected` returns true for a row.
   */
  selectedColor?: string;

  /**
   * Handler invoked when a selectable row is clicked.
   */
  onSelect?: (row: T) => void;

  /**
   * Callback triggered when the paginator changes the page.
   * Useful for external pagination control.
   */
  onPageChange?: (page: number) => void;

  /**
   * Current page index, required if controlling pagination externally.
   */
  currentPage?: number;

  /**
   * Padding to apply inside each row.
   * Useful to control vertical spacing.
   * Example: '16px 0'
   */
  rowPadding?: string;

  mobile?: {
    useCards?: boolean;
    spacingBetweenRows?: Pixel;
    spacingBetweenCols?: Pixel;
    cardBg?: string;
  };
};

/**
 * `Table` is a fully-featured, **responsive data grid** that adapts to both desktop
 * and mobile screens.
 *
 * ### Key capabilities
 * 1. **Sorting** – any column can toggle ascending / descending order with a single click.
 * 2. **Pagination** – rows are automatically paged and navigated with the built-in
 *    `<Paginator>` component.
 * 3. **Expandable rows** – if a data object exposes an `onExpand` function, that row
 *    is rendered inside an `<Accordion>` and can reveal arbitrary nested content.
 * 4. **Custom cell renderers** – pass a `render` callback per column to inject
 *    completely bespoke JSX.
 * 5. **Row selection** – optional callbacks let you mark rows as selectable and
 *    visually highlight the current selection.
 * 6. **CSV export** – a single click can export the table (or a subset of props) to CSV.
 * 7. **Mobile layout** – on narrow viewports the grid collapses into stacked
 *    card-like rows that remain readable and tappable.
 *
 * ### Basic example
 * ```tsx
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 *
 * const users: User[] = [
 *   { id: 1, name: 'Alice', email: 'alice@example.com' },
 *   { id: 2, name: 'Bob',   email: 'bob@example.com'   },
 * ];
 *
 * <Table
 *   data={users}
 *   columns={[
 *     { prop: 'id',    label: 'ID',    sortable: true },
 *     { prop: 'name',  label: 'Name',  sortable: true },
 *     { prop: 'email', label: 'Email' }
 *   ]}
 * />
 * ```
 *
 * ### Custom cell, expandable rows & CSV export
 * ```tsx
 * interface Validator {
 *   index: number;
 *   balance: number;
 *   status: string;
 *   onExpand?: (v: Validator) => ReactNode;
 * }
 *
 * <Table
 *   data={validators}
 *   columns={[
 *     { prop: 'index',   label: 'Index',   sortable: true },
 *     { prop: 'balance', label: 'Balance', sortable: true,
 *       render: v => <BalanceCell value={v.balance} /> },
 *     { prop: 'status',  label: 'Status'  },
 *   ]}
 *   itemsPerPage={15}
 * />
 * ```
 *
 * > **Note**: this component is generic (`<T,>`).
 * > The type you pass (`User`, `Validator`, etc.) defines the keys available for
 * > column `prop` and for the CSV exporter.
 */
export const Table = <T,>({
  data,
  columns,
  itemsPerPage = 10,
  lastIndexBorder = true,
  isRowSelected,
  isRowSelectable,
  selectedColor,
  onSelect,
  rowPadding,
  mobile,
}: TableProps<T>): ReactNode => {
  const isMobile = useIsMobile();
  const { colors } = useTheme();

  const [sortedData, setSortedData] = useState<Array<T>>(data);
  const [order, setOrder] = useState<'asc' | 'desc' | null>(null);
  const [orderProp, setOrderProp] = useState<keyof T | null>(null);

  const shouldRenderCards = (): boolean => {
    if (!mobile) {
      return true;
    }

    return Boolean(mobile.useCards);
  };

  useEffect(() => {
    if (order !== null && orderProp !== null) {
      const dataToSort = [...data];
      const sorted = dataToSort.sort((a, b) => {
        if (a[orderProp] < b[orderProp]) return order === 'asc' ? -1 : 1;
        if (a[orderProp] > b[orderProp]) return order === 'asc' ? 1 : -1;
        return 0;
      });

      setSortedData(sorted);
    } else {
      setSortedData(data);
    }
  }, [JSON.stringify(data)]);

  const onSortColumnClicked = (prop: keyof T, forceOder?: 'asc' | 'desc') => {
    const dataToSort = [...sortedData];
    const newOrder = forceOder ? forceOder : order === 'asc' ? 'desc' : 'asc';
    setOrder(newOrder);

    const sorted = dataToSort.sort((a, b) => {
      if (a[prop] < b[prop]) return newOrder === 'asc' ? -1 : 1;
      if (a[prop] > b[prop]) return newOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setSortedData(sorted);
    setOrderProp(prop);
  };

  const getColumnWidth = (column: TableColumn<T>): Percentage => {
    if (column.width) {
      return column.width;
    }

    return `${100 / columns.length}%`;
  };

  const getColumnAlignment = (
    column: TableColumn<T>
  ): 'end' | 'center' | 'start' => {
    if (column.align) {
      return column.align;
    }

    return 'start';
  };

  const renderCell = (data: T, column: TableColumn<T>): ReactNode => {
    if (column.render) {
      return column.render(data);
    }

    return (
      <Text
        content={String(data[column.prop])}
        alt={String(data[column.prop])}
      />
    );
  };

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const renderRows = () => {
    const isHovered = (key: string) => {
      return hoveredKey === key;
    };

    return sortedData.map((d, d_idx) => (
      <div
        onMouseEnter={() => setHoveredKey(`r-${d_idx}`)}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={() => {
          if (isRowSelectable?.(d)) {
            onSelect?.(d);
          }
        }}
        style={{
          cursor: isRowSelectable?.(d) ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          boxSizing: 'border-box',
          background: isRowSelected?.(d)
            ? selectedColor
            : isRowSelectable?.(d) && isHovered(`r-${d_idx}`)
              ? 'rgba(255,255,255,0.1)'
              : 'transparent',
        }}
        key={`r-${d_idx}`}
      >
        {Object.prototype.hasOwnProperty.call(d, 'onExpand') && (
          <Accordion
            variant={'transparent'}
            summary={renderCells(d, d_idx)}
            onlyCollapseOnIcon
          >
            {(d as { onExpand: (i: T) => ReactNode }).onExpand(d)}
          </Accordion>
        )}
        {!Object.prototype.hasOwnProperty.call(d, 'onExpand') &&
          renderCells(d, d_idx)}
        {(lastIndexBorder || d_idx !== sortedData.length - 1) && (
          <Divider
            color={colors.background['03']}
            opacity={0.5}
            thickness={'1px'}
          />
        )}
      </div>
    ));
  };

  const renderCells = (d: T, d_idx: number) => {
    return (
      <div className={'flex w-full p-8'}>
        {columns.map((c, c_idx) => (
          <div
            key={`d-${d_idx}-c-${c_idx}`}
            style={{
              width: getColumnWidth(c),
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'white',
              }}
            >
              {renderCell(d, c)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMobileRows = () => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: mobile?.spacingBetweenRows ?? '12px',
          width: '100%',
        }}
      >
        {sortedData.map((d, d_idx) => (
          <Surface
            key={`r-${d_idx}`}
            width={'100%'}
            padding={'6px 10px'}
            opacity={0.4}
            background={mobile?.cardBg ?? 'transparent'}
          >
            {Object.prototype.hasOwnProperty.call(d, 'onExpand') && (
              <Accordion
                summary={renderMobileCells(d, d_idx)}
                onlyCollapseOnIcon
              >
                {(d as { onExpand: (i: T) => ReactNode }).onExpand(d)}
              </Accordion>
            )}
            {!Object.prototype.hasOwnProperty.call(d, 'onExpand') &&
              renderMobileCells(d, d_idx)}
          </Surface>
        ))}
      </div>
    );
  };

  const renderMobileCells = (d: T, d_idx: number) => {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          gap: mobile?.spacingBetweenRows ?? '12px',
        }}
      >
        {columns.map((c, c_idx) => (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'start',
              alignItems: 'center',
              gap: '10px',
            }}
            key={`d-${d_idx}-c-${c_idx}`}
          >
            {typeof c.label === 'string' && (
              <Text weight={700} content={`${c.label ? c.label + ':' : ''}`} />
            )}
            {typeof c.label !== 'string' && c.label()}
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {renderCell(d, c)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getSortIcon = (c: TableColumn<T>) => {
    const isActive = c.prop === orderProp;

    if (isActive) {
      if (order === 'asc') {
        return (
          <Icon
            data-testid="sort-icon"
            name={'leftArrow'}
            rotation={90}
            color={colors.primary['02']}
            size={'18px'}
            clickable
            onClick={() => onSortColumnClicked(c.prop)}
          />
        );
      }

      return (
        <Icon
          data-testid="sort-icon"
          name={'leftArrow'}
          color={colors.primary['02']}
          size={'18px'}
          rotation={270}
          clickable
          onClick={() => onSortColumnClicked(c.prop)}
        />
      );
    }

    return (
      <Icon
        data-testid="sort-icon"
        name={'arrows'}
        size={'14px'}
        clickable
        onClick={() => onSortColumnClicked(c.prop)}
      />
    );
  };

  return isMobile && shouldRenderCards() ? (
    renderMobileRows()
  ) : (
    <div
      style={{
        width: '100%',
      }}
    >
      {/* Render Headers*/}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          padding: rowPadding ?? '0 0 16px 0',
        }}
      >
        {columns.map((c) => (
          <div
            style={{
              width: getColumnWidth(c),
              display: 'flex',
              flexDirection: 'row',
              justifyContent: getColumnAlignment(c),
              alignItems: 'center',
              gap: '4px',
            }}
            key={`t-${c.prop.toString()}`}
          >
            {c.sortable && getSortIcon(c)}
            {typeof c.label === 'string' && (
              <Text color={colors.background['01']} content={c.label} />
            )}
            {typeof c.label !== 'string' && c.label()}
          </div>
        ))}
      </div>
      <Divider
        color={colors.background['03']}
        opacity={0.5}
        thickness={'1px'}
      />
      {/* Render cells */}
      {data.length <= itemsPerPage && renderRows()}
    </div>
  );
};
