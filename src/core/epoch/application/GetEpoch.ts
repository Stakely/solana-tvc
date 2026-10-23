import { ApplicationService } from '@/core/arch';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { GetEpochResponse } from '@/types/epoch.ts';
import { EpochFreshener } from '@/core/epoch/domain/EpochFreshener.ts';

export class GetEpoch extends ApplicationService {
  constructor(
    private readonly _query: EpochQuery,
    private readonly _freshener: EpochFreshener
  ) {
    super();
  }

  protected async _doExec(): Promise<GetEpochResponse> {
    // Not awaited: the answer comes from the file as it is now.
    this._freshener
      .ensureFresh()
      .catch((error) => console.error('epoch refresh failed', error));
    return this._query.query();
  }
}
