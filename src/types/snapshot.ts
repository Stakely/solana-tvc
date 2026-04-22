export type Lamports = string;

export type StakeByVersionStats = {
  currentActiveStake: Lamports;
  currentValidators: number;
  delinquentActiveStake: Lamports;
  delinquentValidators: number;
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
  info?: ValidatorInfo;
  ranking?: number;
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

export type GetSnapshotArgs = {
  orderDirection?: 'asc' | 'desc';
  orderCriteria?: 'credits' | 'commission' | 'version';
  size?: number;
  page?: number;
  publicKey?: string;
};

export type GetSnapshotResponse = {
  snapshot: Snapshot;
  totalItems: number;
  itemsPerPage: number;
};

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
      };
    })
    .sort((a, b) => b.currentActiveStake - a.currentActiveStake);
}
