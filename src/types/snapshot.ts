import { EpochRatioState, SnapshotMeta, ValidatorInclusion } from '@/types/measure.ts';

export type Lamports = string;

// The current (not delinquent) validators of a version that run one client.
export type ClientStats = {
  // Gossip client id; '' when the identity reports none.
  client: string;
  validators: number;
  activeStake: Lamports;
};

export type StakeByVersionStats = {
  currentActiveStake: Lamports;
  currentValidators: number;
  delinquentActiveStake: Lamports;
  delinquentValidators: number;
  // Added by the API from getClusterNodes, most stake first.
  clients?: ClientStats[];
};

export type ValidatorSnapshot = {
  activatedStake: Lamports;
  commission: number;
  credits: number;
  delinquent: boolean;
  epochCredits: number;
  identityPubkey: string;
  lastVote: number;
  rootSlot: number;
  skipRate: number | null;
  version: string;
  voteAccountPubkey: string;
  // The gossip client id of the identity (getClusterNodes), when known:
  // Agave, JitoLabs, Firedancer…
  client?: string;
  info?: ValidatorInfo;
  ranking?: number;
  epochRatio?: number | null;
  epochRatioState?: EpochRatioState;
  inclusion?: ValidatorInclusion;
};

export type Snapshot = {
  averageSkipRate: number;
  averageStakeWeightedSkipRate: number;
  stakeByVersion: Record<string, StakeByVersionStats>;
  totalActiveStake: Lamports;
  totalCurrentStake: Lamports;
  totalDelinquentStake: Lamports;
  validators: ValidatorSnapshot[];
};

export type OrderCriteria =
  | 'stake'
  | 'inclusion'
  | 'epochRatio'
  | 'commission'
  | 'version';

export type GetSnapshotArgs = {
  orderDirection?: 'asc' | 'desc';
  orderCriteria?: OrderCriteria;
  size?: number;
  page?: number;
  publicKey?: string;
};

export type GetSnapshotResponse = {
  snapshot: Snapshot;
  totalItems: number;
  itemsPerPage: number;
} & SnapshotMeta;

export type ValidatorInfo = {
  identityPubkey: string;
  infoPubkey: string;
  info: {
    name?: string;
    website?: string;
    iconUrl?: string;
    details?: string;
    keybaseUsername?: string;
  };
};

export type VersionData = {
  version: string;
  currentActiveStake: number;
  stakePercent: number;
  delinquentStake: number;
  delinquentPercent: number;
  delinquentValidators: number;
  currentValidators: number;
  currentValidatorsPercent: number;
  // Share of the version's current stake per client, most stake first.
  clients: Array<{ client: string; validators: number; stakePercent: number }>;
};

export function versionsToRows(
  versions: Record<string, StakeByVersionStats> | undefined
): VersionData[] {
  if (!versions) return [];

  const entries = Object.entries(versions);

  const totalStake = entries.reduce(
    (sum, [, s]) => sum + Number(s.currentActiveStake),
    0
  );

  const totalValidators = entries.reduce(
    (sum, [, s]) => sum + Number(s.currentValidators),
    0
  );
  const totalDelinqStake = entries.reduce(
    (sum, [, s]) => sum + Number(s.delinquentActiveStake),
    0
  );

  return entries
    .map(([version, s]) => {
      const currentActiveStake = Number(s.currentActiveStake);
      const delinquentStake = Number(s.delinquentActiveStake);
      const currentValidators = Number(s.currentValidators);

      return {
        version,
        currentActiveStake,
        stakePercent: totalStake ? (currentActiveStake / totalStake) * 100 : 0,
        delinquentStake,
        delinquentPercent: totalDelinqStake
          ? (delinquentStake / totalDelinqStake) * 100
          : 0,
        delinquentValidators: s.delinquentValidators,
        currentValidators: s.currentValidators,
        currentValidatorsPercent: totalValidators
          ? (currentValidators / totalValidators) * 100
          : 0,
        clients: (s.clients ?? []).map((c) => ({
          client: c.client,
          validators: c.validators,
          stakePercent: currentActiveStake
            ? (Number(c.activeStake) / currentActiveStake) * 100
            : 0,
        })),
      };
    })
    .sort((a, b) => b.currentActiveStake - a.currentActiveStake);
}
