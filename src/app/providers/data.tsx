'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Epoch } from '@/types/epoch';
import { GetSnapshotResponse, Snapshot } from '@/types/snapshot';

export type DataContextType = {
  epoch: Epoch | null;
  snapshot: Snapshot | null;
  totalValidators: number;
  currentPage: number;
  setCurrentPage: (currentPage: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (page: number) => void;
  pubKeyFilter: string;
  setPubKeyFilter: (filter: string) => void;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState<Epoch | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalValidators, setTotalValidators] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [pubKeyFilter, setPubKeyFilter] = useState<string>('');

  const _fetchSnapshot = async (page: number): Promise<void> => {
    const response = await fetch(
      `/api/snapshot?page=${page}&size=${itemsPerPage}&identity=${pubKeyFilter}`,
      {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return;

    const result: GetSnapshotResponse = await response.json();
    setSnapshot(result.snapshot);
    setTotalValidators(result.totalItems);
  };

  const _fetchEpoch = async (): Promise<void> => {
    const response = await fetch('/api/epoch', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) return;

    const result: Epoch = await response.json();
    setEpoch(result);
  };

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await Promise.all([_fetchEpoch(), _fetchSnapshot(currentPage)]);
    };

    tick();
    const id = setInterval(tick, 500);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currentPage, itemsPerPage, pubKeyFilter]);

  return (
    <DataContext.Provider
      value={{
        epoch,
        snapshot,
        currentPage,
        setCurrentPage,
        totalValidators,
        itemsPerPage,
        setItemsPerPage,
        pubKeyFilter,
        setPubKeyFilter,
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
