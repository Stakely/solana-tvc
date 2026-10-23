import { GetSnapshotArgs } from '@/types/snapshot.ts';
import { Factory } from '@/core/Factory.ts';
import { GetSnapshot } from '@/core/snapshot/application/GetSnapshot.ts';
import { ArchResponse } from '@/core/arch';

export const runtime = 'nodejs';

const query = Factory.SnapshotQuery();
const refresher = Factory.ValidatorSnapshotFreshener();
const infoRefresher = Factory.ValidatorInfoFreshener();
const measure = Factory.MeasureService();

const appService = new GetSnapshot(query, refresher, infoRefresher, measure);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderDirection = url.searchParams.get('orderDirection');
  const orderCriteria = url.searchParams.get('orderCriteria');
  const size = url.searchParams.get('size');
  const page = url.searchParams.get('page');
  const identity = url.searchParams.get('identity');

  // `||`, not `??`: an empty value counts as a missing one and takes the
  // default order, instead of reaching the query as an invalid order.
  const args: GetSnapshotArgs = {
    orderDirection:
      (orderDirection as GetSnapshotArgs['orderDirection']) || undefined,
    orderCriteria:
      (orderCriteria as GetSnapshotArgs['orderCriteria']) || undefined,
    size: size ? Number(size) : undefined,
    page: page ? Number(page) : undefined,
    publicKey: identity ?? undefined,
  };

  return ArchResponse.handleJsonResponse(appService, args);
}
