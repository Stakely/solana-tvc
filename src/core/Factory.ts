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
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { SolanaCli } from '@/core/solana/SolanaCli.ts';
import { EpochFreshener } from '@/core/epoch/domain/SnapshotFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';

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

  static SolanaCli(): SolanaCli {
    const rpcUrls = process.env.RPC_URLS?.split(',') ?? [
      'https://api.mainnet-beta.solana.com',
    ];
    return new SolanaCli(rpcUrls);
  }

  static ValidatorSnapshotFreshener(): ValidatorSnapshotFreshener {
    const publicPath = path.join(process.cwd(), 'public');
    const solanaCli = Factory.SolanaCli();
    const ttl = process.env.SNAPSHOT_FILE_TTL
      ? parseInt(process.env.SNAPSHOT_FILE_TTL)
      : 50;
    return new ValidatorSnapshotFreshener(solanaCli, publicPath, ttl);
  }

  static ValidatorInfoFreshener(): ValidatorInfoFreshener {
    const publicPath = path.join(process.cwd(), 'public');
    const solanaCli = Factory.SolanaCli();
    const ttl = process.env.VALIDATOR_INFO_FILE_TTL
      ? parseInt(process.env.VALIDATOR_INFO_FILE_TTL)
      : 24 * 60 * 60 * 1000;
    return new ValidatorInfoFreshener(solanaCli, publicPath, ttl);
  }

  static EpochFreshener(): EpochFreshener {
    const publicPath = path.join(process.cwd(), 'public');
    const solanaCli = Factory.SolanaCli();
    const ttl = process.env.EPOCH_FILE_TTL
      ? parseInt(process.env.EPOCH_FILE_TTL)
      : 5000;
    return new EpochFreshener(solanaCli, publicPath, ttl);
  }
}
