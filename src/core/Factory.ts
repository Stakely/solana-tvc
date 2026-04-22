import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import path from 'path';
import { SnapshotQuery } from '@/core/snapshot/domain/SnapshotQuery.ts';
import { SnapshotReducer } from '@/core/snapshot/domain/reducer/SnapshotReducer.ts';
import { EpochParser } from '@/core/epoch/domain/EpochParser.ts';
import { EpochQuery } from '@/core/epoch/domain/EpochQuery.ts';
import { OrderReducer } from '@/core/snapshot/domain/reducer/OrderReducer.ts';
import { FilterReducer } from '@/core/snapshot/domain/reducer/FilterReducer.ts';
import { PaginatorReducer } from '@/core/snapshot/domain/reducer/PaginatorReducer.ts';
import { ValidatorInfoParser } from '@/core/snapshot/domain/ValidatorInfoParser.ts';

export class Factory {
  static SnapshotParser(): SnapshotParser {
    const filePath = path.join(process.cwd(), 'public', 'snapshot.json');
    return new SnapshotParser(filePath);
  }

  static ValidatorInfoParser(): ValidatorInfoParser {
    const filePath = path.join(process.cwd(), 'public', 'validator_info.json');
    return new ValidatorInfoParser(filePath);
  }

  static SnapshotQuery(): SnapshotQuery {
    return new SnapshotQuery(
      Factory.SnapshotParser(),
      Factory.ValidatorInfoParser(),
      Factory.SnapshotReducer()
    );
  }

  static SnapshotReducer(): SnapshotReducer {
    const orderReducer = new OrderReducer();
    const filterReducer = new FilterReducer();
    const paginatorReducer = new PaginatorReducer();

    return new SnapshotReducer(orderReducer, filterReducer, paginatorReducer);
  }

  static EpochParser(): EpochParser {
    const filePath = path.join(process.cwd(), 'public', 'epoch.json');
    return new EpochParser(filePath);
  }

  static EpochQuery(): EpochQuery {
    return new EpochQuery(Factory.EpochParser());
  }
}
