import { ReactNode } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@/app/components/theme/theme-provider.tsx';
import { AnalyticsProvider } from '@/app/hooks/analytics.tsx';
import { Epoch } from '@/types/epoch.ts';
import {
  GetSnapshotResponse,
  Snapshot,
  ValidatorSnapshot,
  VersionData,
} from '@/types/snapshot.ts';
import {
  InclusionWindow,
  MeasureResponse,
  SnapshotMeta,
} from '@/types/measure.ts';

// Public mainnet validators, also used by the backend tests.
export const VOTE = 'PUFFiNkUHF2DMfbKeUcYTSQckDDtkswfxZCDv5WQqwp';
export const IDENTITY = 'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy';
export const OTHER_VOTE = '59k9CiZ7L1bpEivLrAtaMPMgw18syZ4RQsJUo3hbbj8x';
export const OTHER_IDENTITY = '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB';

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </ThemeProvider>
  );
}

// Renders inside the theme and analytics providers; rerender keeps them.
export function renderUi(ui: ReactNode): RenderResult {
  return render(ui, { wrapper: TestProviders });
}

export function validator(
  extra: Partial<ValidatorSnapshot> = {}
): ValidatorSnapshot {
  return {
    activatedStake: '1000000000000',
    commission: 5,
    credits: 0,
    delinquent: false,
    epochCredits: 0,
    identityPubkey: IDENTITY,
    lastVote: 460_000_000,
    rootSlot: 459_999_968,
    skipRate: 0,
    version: '4.3.2',
    voteAccountPubkey: VOTE,
    info: {
      identityPubkey: IDENTITY,
      infoPubkey: 'Info1111111111111111111111111111111111111111',
      info: { name: 'Puffin Validator' },
    },
    ranking: 1,
    epochRatio: 0.9994,
    epochRatioState: 'ok',
    ...extra,
  };
}

export function snapshot(validators: ValidatorSnapshot[]): Snapshot {
  return {
    averageSkipRate: 0.5,
    averageStakeWeightedSkipRate: 0.4,
    stakeByVersion: {
      '4.3.2': {
        currentActiveStake: '1000000000000',
        currentValidators: validators.length,
        delinquentActiveStake: '0',
        delinquentValidators: 0,
      },
    },
    totalActiveStake: '1000000000000',
    totalCurrentStake: '1000000000000',
    totalDelinquentStake: '0',
    validators,
  };
}

export function meta(extra: Partial<SnapshotMeta> = {}): SnapshotMeta {
  return {
    instance: 'test',
    epoch: 1065,
    migrationEpoch: false,
    measurement: 'ok',
    measuring: false,
    minMeasurableStake: '612000000000',
    ...extra,
  };
}

export function snapshotResponse(
  validators: ValidatorSnapshot[],
  metaExtra: Partial<SnapshotMeta> = {}
): GetSnapshotResponse {
  return {
    snapshot: snapshot(validators),
    totalItems: validators.length,
    itemsPerPage: 10,
    ...meta(metaExtra),
  };
}

// Window `seq` covers slots 1000 + 12·seq to 1000 + 12·(seq + 1).
export function inclusionWindow(
  seq: number,
  extra: Partial<InclusionWindow> = {}
): InclusionWindow {
  return {
    seq,
    fromSlot: 1000 + seq * 12,
    toSlot: 1000 + (seq + 1) * 12,
    kind: 'measured',
    included: 10,
    payable: 10,
    shared: false,
    ...extra,
  };
}

type MeasuredValidator = NonNullable<MeasureResponse['validator']>;

export function measureResponse(
  extra: Partial<MeasureResponse> = {},
  validatorExtra: Partial<MeasuredValidator> = {}
): MeasureResponse {
  return {
    instance: 'test',
    epoch: 1065,
    migrationEpoch: false,
    measurement: 'ok',
    minMeasurableStake: '612000000000',
    coverageSeconds: 10,
    cluster: { payable: 10, stakeShareMissed: 0, alert: false },
    validator: {
      votePubkey: VOTE,
      status: 'ok',
      last5m: { included: 20, payable: 20, missed: 0, sharedMissed: 0 },
      offlineRun: 0,
      epochRatio: 0.9994,
      epochRatioState: 'ok',
      recent: [inclusionWindow(1), inclusionWindow(2)],
      ...validatorExtra,
    },
    ...extra,
  };
}

export function epochFixture(extra: Partial<Epoch> = {}): Epoch {
  return {
    epoch: 1065,
    slotIndex: 431_000,
    slotsInEpoch: 432_000,
    absoluteSlot: '460511000',
    blockHeight: '1',
    transactionCount: '1',
    epochCompletedPercent: 99.77,
    ...extra,
  };
}

export function versionData(
  version: string,
  currentActiveStake: number
): VersionData {
  return {
    version,
    currentActiveStake,
    stakePercent: 10,
    delinquentStake: 0,
    delinquentPercent: 0,
    delinquentValidators: 0,
    currentValidators: 1,
    currentValidatorsPercent: 10,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

export type FetchHandler = (url: string) => Response | Promise<Response>;

// jsdom has no fetch: every test that renders a fetching component sets one.
export function mockFetch(handler: FetchHandler) {
  const fn = jest.fn((input: RequestInfo | URL) =>
    Promise.resolve(handler(String(input)))
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

export function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

// useIsMobile reads window.innerWidth (< 768 is a phone). jsdom starts at 1024.
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

// AnalyticsProvider sends events to window.umami when it exists.
export function mockUmami(): jest.Mock {
  const track = jest.fn();
  (window as unknown as { umami?: { track: jest.Mock } }).umami = { track };
  return track;
}

export function clearUmami(): void {
  delete (window as unknown as { umami?: unknown }).umami;
}
