import { Factory } from '@/core/Factory.ts';
import { ArchResponse } from '@/core/arch';
import { GetEpoch } from '@/core/epoch/application/GetEpoch.ts';

export const runtime = 'nodejs';

export async function GET() {
  const query = Factory.EpochQuery();
  const freshener = Factory.EpochFreshener();
  const appService = new GetEpoch(query, freshener);

  return ArchResponse.handleJsonResponse(appService, {});
}
