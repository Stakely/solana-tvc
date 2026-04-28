import { ApplicationService } from '@/core/arch';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { GetEpochResponse } from '@/types/epoch.ts';
import { EpochFreshener } from '@/core/epoch/domain/SnapshotFreshener.ts';

export class GetEpoch extends ApplicationService {
  constructor(
    private readonly _query: EpochQuery,
    private readonly _freshener: EpochFreshener
  ) {
    super();
  }

  protected async _doExec(): Promise<GetEpochResponse> {
    this._freshener.ensureFresh();
    return this._query.query();
  }
}
