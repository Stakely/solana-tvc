import { EpochParser } from '@/core/epoch/domain/EpochParser.ts';
import { Epoch } from '@/types/epoch.ts';

export class EpochQuery {
  constructor(private readonly _epochParser: EpochParser) {}

  async query(): Promise<Epoch> {
    return this._epochParser.parse();
  }
}
