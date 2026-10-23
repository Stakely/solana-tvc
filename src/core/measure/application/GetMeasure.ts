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
    try {
      return await this._service.measure(vote);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      // ArchResponse sends the message of a 500 to the client. A failed CLI
      // call names the RPC URL, which can carry an API key, and its stderr:
      // keep them in the server log.
      console.error('measure failed', error);
      throw new Error('measurement unavailable');
    }
  }
}
