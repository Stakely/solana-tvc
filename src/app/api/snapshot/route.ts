import { GetSnapshotArgs } from '@/types/snapshot.ts';
import { Factory } from '@/core/Factory.ts';
import { GetSnapshot } from '@/core/snapshot/application/GetSnapshot.ts';
import { ArchResponse } from '@/core/arch';

export const runtime = 'nodejs';

const query = Factory.SnapshotQuery();
const refresher = Factory.ValidatorSnapshotFreshener();
const infoRefresher = Factory.ValidatorInfoFreshener();

const appService = new GetSnapshot(query, refresher, infoRefresher);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderDirection = url.searchParams.get('orderDirection');
  const orderCriteria = url.searchParams.get('orderCriteria');
  const size = url.searchParams.get('size');
  const page = url.searchParams.get('page');
  const identity = url.searchParams.get('identity');

  const args: GetSnapshotArgs = {
    orderDirection: (orderDirection as 'asc' | 'desc') ?? undefined,
    orderCriteria:
      (orderCriteria as 'commission' | 'credits' | 'version') ?? undefined,
    size: size ? Number(size) : undefined,
    page: page ? Number(page) : undefined,
    publicKey: identity ?? undefined,
  };

  return ArchResponse.handleJsonResponse(appService, args);
}
