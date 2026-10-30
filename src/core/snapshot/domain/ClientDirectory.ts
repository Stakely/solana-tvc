export interface ClusterClientsRpc {
  clusterClients(): Promise<Map<string, string>>;
}

// The client each identity runs (Agave, JitoLabs, Firedancer…), from the
// gossip table of getClusterNodes. The answer is about 1.5 MB, so it is read
// in the background at most once per refresh interval, one read at a time; a
// failed read waits the same interval and keeps the previous table.
export class ClientDirectory {
  private _byIdentity = new Map<string, string>();
  private _inFlight: Promise<void> | null = null;
  private _lastAttemptAt = -Infinity;

  constructor(
    private readonly _rpc: ClusterClientsRpc,
    private readonly _refreshMs: number = 10 * 60_000,
    private readonly _now: () => number = Date.now
  ) {}

  clientOf(identity: string): string | undefined {
    return this._byIdentity.get(identity);
  }

  // Starts a background read when the table is older than the interval.
  // Resolves when that read (or the one already running) ends.
  refresh(): Promise<void> {
    if (this._inFlight) {
      return this._inFlight;
    }
    if (this._now() - this._lastAttemptAt < this._refreshMs) {
      return Promise.resolve();
    }
    this._lastAttemptAt = this._now();
    this._inFlight = this._rpc
      .clusterClients()
      .then((byIdentity) => {
        this._byIdentity = byIdentity;
      })
      .catch((error) => console.error('cluster clients read failed', error))
      .finally(() => {
        this._inFlight = null;
      });
    return this._inFlight;
  }
}
