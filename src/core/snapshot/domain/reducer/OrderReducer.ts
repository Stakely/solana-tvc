import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import {
  OrderCriteria,
  Snapshot,
  ValidatorSnapshot,
} from '@/types/snapshot.ts';
import { Reducer } from '@/core/snapshot/domain/reducer/Reducer.ts';

const RANKED_STATUSES = new Set(['ok', 'missing']);

const byStake = (a: ValidatorSnapshot, b: ValidatorSnapshot): number => {
  const diff = BigInt(a.activatedStake) - BigInt(b.activatedStake);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
};

const inclusionRate = (v: ValidatorSnapshot): number =>
  v.inclusion && v.inclusion.payable > 0
    ? v.inclusion.included / v.inclusion.payable
    : 0;

// Validators that take a rank under each order (spec §5.1). The others are
// listed after them by stake, without a rank. No order ranks a delinquent
// validator: votes counted goes by the status the table shows (§4.8, which
// checks delinquency first), the other orders by the CLI flag. A validator
// that goes delinquent keeps the epoch ratio of the unit it had confirmed.
function isRanked(criteria: OrderCriteria, v: ValidatorSnapshot): boolean {
  switch (criteria) {
    case 'inclusion':
      return !!v.inclusion && RANKED_STATUSES.has(v.inclusion.status);
    case 'epochRatio':
      return !v.delinquent && typeof v.epochRatio === 'number';
    case 'stake':
    case 'commission':
    case 'version':
    default:
      return !v.delinquent;
  }
}

// Positive when a goes first in descending order.
function compare(
  criteria: OrderCriteria,
  a: ValidatorSnapshot,
  b: ValidatorSnapshot
): number {
  switch (criteria) {
    case 'stake':
      return byStake(a, b);
    case 'inclusion':
      return (
        inclusionRate(a) - inclusionRate(b) ||
        (b.inclusion?.missed ?? 0) - (a.inclusion?.missed ?? 0) ||
        byStake(a, b)
      );
    case 'epochRatio':
      return (a.epochRatio ?? 0) - (b.epochRatio ?? 0) || byStake(a, b);
    case 'commission':
      return a.commission - b.commission;
    case 'version':
    default:
      return a.version.localeCompare(b.version);
  }
}

export class OrderReducer implements Reducer {
  apply(query: SnapshotQueryArgs, snapshot: Snapshot): Snapshot {
    const { criteria, direction } = query.order;
    const dir = direction === 'asc' ? 1 : -1;

    const ranked = snapshot.validators
      .filter((v) => isRanked(criteria, v))
      .sort((a, b) => compare(criteria, a, b) * dir);
    const unranked = snapshot.validators
      .filter((v) => !isRanked(criteria, v))
      .sort((a, b) => byStake(b, a));

    return {
      ...snapshot,
      validators: [
        ...ranked.map((v, i): ValidatorSnapshot => ({ ...v, ranking: i + 1 })),
        ...unranked,
      ],
    };
  }
}
