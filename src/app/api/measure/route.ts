import { Factory } from '@/core/Factory.ts';
import { ArchResponse } from '@/core/arch';
import { GetMeasure } from '@/core/measure/application/GetMeasure.ts';

export const runtime = 'nodejs';

const appService = new GetMeasure(Factory.MeasureService());

export async function GET(req: Request) {
  const vote = new URL(req.url).searchParams.get('vote');
  return ArchResponse.handleJsonResponse(appService, { vote });
}
