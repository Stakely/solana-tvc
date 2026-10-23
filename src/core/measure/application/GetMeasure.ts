import { ApplicationService, DomainError } from '@/core/arch';
import { MeasureService } from '@/core/measure/application/Measure.ts';
import { MeasureResponse } from '@/types/measure.ts';

const VOTE_ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class GetMeasure extends ApplicationService {
  constructor(private readonly _service: Pick<MeasureService, 'measure'>) {
    super();
  }

  protected async _doExec(args: {
    vote?: string | null;
  }): Promise<MeasureResponse> {
    const vote = args.vote ?? '';
    if (!VOTE_ACCOUNT.test(vote)) {
      throw new DomainError('Invalid vote account', { vote });
    }
    return this._service.measure(vote);
  }
}
