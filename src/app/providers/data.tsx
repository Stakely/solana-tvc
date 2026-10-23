'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Epoch } from '@/types/epoch.ts';
import {
  GetSnapshotResponse,
  OrderCriteria,
  Snapshot,
} from '@/types/snapshot.ts';
import { SnapshotMeta } from '@/types/measure.ts';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { getJson } from '@/app/get-json.ts';
import { usePageVisible } from '@/app/hooks/page-visible.tsx';

// Rows per page of the validators table.
export const PAGE_SIZE = 10;

export type DataContextType = {
  epoch: Epoch | null;
  snapshot: Snapshot | null;
  // Measurement fields of the last /api/snapshot response.
  meta: SnapshotMeta | null;
  totalValidators: number;
  currentPage: number;
  setCurrentPage: (currentPage: number) => void;
  itemsPerPage: number;
  pubKeyFilter: string;
  setPubKeyFilter: (filter: string) => void;
  // The order the user picked; null leaves the server default.
  orderCriteria: OrderCriteria | null;
  setOrderCriteria: (criteria: OrderCriteria | null) => void;
};

const DataContext = createContext<DataContextType | null>(null);

// Every parameter goes through encodeURIComponent. The order is sent only
// when the user picked one, so the server applies its own default.
export function snapshotUrl(
  page: number,
  size: number,
  filter: string,
  orderCriteria: OrderCriteria | null
): string {
  const params: Array<[string, string]> = [
    ['page', String(page)],
    ['size', String(size)],
    ['identity', filter],
  ];
  if (orderCriteria) {
    params.push(['orderCriteria', orderCriteria]);
  }
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `/api/snapshot?${query}`;
}

// Whether the server can rank by `criteria` with this meta (spec §5.1, §6.5):
// otherwise every row comes back unranked ("-"), ordered by stake.
export function orderAvailable(
  criteria: OrderCriteria,
  meta: SnapshotMeta | null
): boolean {
  if (meta === null || meta.migrationEpoch) return criteria === 'stake';
  switch (criteria) {
    case 'inclusion':
      // Sent only while someone measures and the measurement is trusted.
      return meta.inclusionCoverageSeconds !== undefined;
    case 'epochRatio':
      return meta.measurement !== 'under_review';
    default:
      return true;
  }
}

export function metaOf(response: GetSnapshotResponse): SnapshotMeta {
  return {
    instance: response.instance,
    epoch: response.epoch,
    migrationEpoch: response.migrationEpoch,
    measurement: response.measurement,
    measuring: response.measuring,
    minMeasurableStake: response.minMeasurableStake,
    inclusionCoverageSeconds: response.inclusionCoverageSeconds,
    cluster: response.cluster,
  };
}

// Polls /api/epoch and /api/snapshot every MEASURE.measurePollMs while the
// tab is visible. Wraps only the home page.
export function DataProvider({ children }: { children: ReactNode }) {
  const visible = usePageVisible();
  const [epoch, setEpoch] = useState<Epoch | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [meta, setMeta] = useState<SnapshotMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalValidators, setTotalValidators] = useState<number>(0);
  const [pubKeyFilter, setPubKeyFilterState] = useState<string>('');
  const [orderCriteria, setOrderCriteriaState] =
    useState<OrderCriteria | null>(null);
  const latestRequest = useRef(0);

  const setPubKeyFilter = (filter: string) => {
    setPubKeyFilterState(filter);
    setCurrentPage(1);
  };

  const setOrderCriteria = (criteria: OrderCriteria | null) => {
    setOrderCriteriaState(criteria);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async (): Promise<void> => {
      const request = ++latestRequest.current;
      const [nextEpoch, result] = await Promise.all([
        getJson<Epoch>('/api/epoch'),
        getJson<GetSnapshotResponse>(
          snapshotUrl(currentPage, PAGE_SIZE, pubKeyFilter, orderCriteria)
        ),
      ]);
      // A newer request (other page, filter or order) owns the state now.
      if (cancelled || request !== latestRequest.current) return;
      if (nextEpoch) setEpoch(nextEpoch);
      if (result) {
        const nextMeta = metaOf(result);
        setSnapshot(result.snapshot);
        setTotalValidators(result.totalItems);
        setMeta(nextMeta);
        // A picked order this response cannot rank goes back to the server
        // default; the migration epoch keeps only stake (spec §6.5).
        setOrderCriteriaState((picked) =>
          picked !== null && !orderAvailable(picked, nextMeta) ? null : picked
        );
      }
      timer = setTimeout(tick, MEASURE.measurePollMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [visible, currentPage, pubKeyFilter, orderCriteria]);

  return (
    <DataContext.Provider
      value={{
        epoch,
        snapshot,
        meta,
        currentPage,
        setCurrentPage,
        totalValidators,
        itemsPerPage: PAGE_SIZE,
        pubKeyFilter,
        setPubKeyFilter,
        orderCriteria,
        setOrderCriteria,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = (): DataContextType => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData() must be used within DataProvider');
  return ctx;
};
