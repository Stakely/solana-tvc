import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class SolanaCli {
  constructor(private readonly _rpcUrls: Array<string>) {}

  public async validators(): Promise<string> {
    return this.runWithFallback(['validators', '--output', 'json']);
  }

  public async epochInfo(): Promise<string> {
    return this.runWithFallback(['epoch-info', '--output', 'json']);
  }

  public async validatorInfo(): Promise<string> {
    return this.runWithFallback(['validator-info', 'get', '--output', 'json']);
  }

  private async runWithFallback(command: string[]): Promise<string> {
    let lastError: unknown;

    for (const rpc of this._rpcUrls) {
      try {
        const { stdout } = await execFileAsync(
          'solana',
          ['-u', rpc, ...command],
          {
            timeout: 15_000,
            maxBuffer: 1024 * 1024 * 20,
          }
        );

        return stdout;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }
}
