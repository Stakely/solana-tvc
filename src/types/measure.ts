// Types of /api/measure and of the measurement fields of /api/snapshot
// (spec §6.3). Shared by the server and the UI.

export type InclusionStatus =
  | 'ok'
  | 'missing'
  | 'measuring'
  | 'not_voting'
  | 'not_measurable'
  | 'delinquent';

export type WindowKind =
  | 'measured'
  | 'leader'
  | 'not_measured'
  | 'no_paying_blocks';

export type MeasurementHealth = 'ok' | 'under_review';

export type EpochRatioState = 'ok' | 'pending' | 'unavailable';

export type InclusionWindow = {
  seq: number;
  fromSlot: number;
  toSlot: number;
  kind: WindowKind;
  included: number;
  payable: number;
  shared: boolean;
};

export type InclusionTotals = {
  included: number;
  payable: number;
  missed: number;
  sharedMissed: number;
};

export type ClusterView = {
  payable: number;
  stakeShareMissed: number;
  alert: boolean;
};

export type EpochRatio = { value: number | null; state: EpochRatioState };

export type MeasureResponse = {
  instance: string;
  epoch: number;
  migrationEpoch: boolean;
  measurement: MeasurementHealth;
  minMeasurableStake: string | null;
  coverageSeconds: number;
  cluster: ClusterView | null;
  validator: {
    votePubkey: string;
    status: InclusionStatus;
    last5m: InclusionTotals | null;
    offlineRun: number;
    epochRatio: number | null;
    epochRatioState: EpochRatioState;
    recent: InclusionWindow[];
  } | null;
};

export type ValidatorInclusion = {
  status: InclusionStatus;
  included: number;
  payable: number;
  missed: number;
};

export type ValidatorExtras = {
  epochRatio: number | null;
  epochRatioState: EpochRatioState;
  inclusion?: ValidatorInclusion;
};

export type SnapshotMeta = {
  instance: string;
  epoch: number | null;
  migrationEpoch: boolean;
  measurement: MeasurementHealth;
  measuring: boolean;
  // Lamports (decimal string): below it a validator is "Not measurable".
  minMeasurableStake: string | null;
  inclusionCoverageSeconds?: number;
  cluster?: ClusterView | null;
};

export type SnapshotExtras = {
  meta: SnapshotMeta;
  byVote(vote: string): ValidatorExtras;
};
