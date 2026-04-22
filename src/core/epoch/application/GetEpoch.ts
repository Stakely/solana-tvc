import { ApplicationService } from '@/core/arch';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { GetEpochResponse } from '@/types/epoch.ts';

export class GetEpoch extends ApplicationService {
  constructor(private readonly _query: EpochQuery) {
    super();
  }

  protected async _doExec(): Promise<GetEpochResponse> {
    return this._query.query();
  }
}
