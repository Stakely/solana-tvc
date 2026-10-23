import { randomUUID } from 'node:crypto';
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
import { EpochFreshener } from '@/core/epoch/domain/EpochFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';
import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import { SolanaRpc } from '@/core/solana/SolanaRpc.ts';
import { VoteInclusionTracker } from '@/core/snapshot/domain/VoteInclusionTracker.ts';
import { MeasureService } from '@/core/measure/application/Measure.ts';

// One instance per process, shared by every route bundle (spec §4.1).
type Shared = { source?: SnapshotSource; measure?: MeasureService };
const shared = globalThis as typeof globalThis & { __solanaTvc?: Shared };
const singletons = (): Shared => (shared.__solanaTvc ??= {});

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

  static rpcUrls(): string[] {
    const urls = (process.env.RPC_URLS ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    return urls.length ? urls : ['https://api.mainnet-beta.solana.com'];
  }

  static SolanaCli(): SolanaCli {
    return new SolanaCli(Factory.rpcUrls());
  }

  // SNAPSHOT_FILE_TTL in ms, default 5,000, kept within [3,000, 10,000].
  static snapshotTtlMs(): number {
    const ttl = parseInt(process.env.SNAPSHOT_FILE_TTL ?? '', 10);
    return Number.isFinite(ttl)
      ? Math.min(
          MEASURE.snapshotTtlMaxMs,
          Math.max(MEASURE.snapshotTtlMinMs, ttl)
        )
      : MEASURE.snapshotTtlMs;
  }

  static SnapshotSource(): SnapshotSource {
    return (singletons().source ??= new SnapshotSource(
      Factory.SolanaCli(),
      path.join(process.cwd(), 'public')
    ));
  }

  static Network(): Network {
    return Network.fromEnv(process.env.SOLANA_NETWORK);
  }

  static SolanaRpc(): SolanaRpc {
    return new SolanaRpc(Factory.rpcUrls());
  }

  static MeasureService(): MeasureService {
    const network = Factory.Network();
    return (singletons().measure ??= new MeasureService({
      source: Factory.SnapshotSource(),
      rpc: Factory.SolanaRpc(),
      tracker: new VoteInclusionTracker(network),
      network,
      instance: randomUUID().slice(0, 8),
    }));
  }

  static ValidatorSnapshotFreshener(): ValidatorSnapshotFreshener {
    return new ValidatorSnapshotFreshener(
      Factory.SnapshotSource(),
      Factory.snapshotTtlMs()
    );
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
