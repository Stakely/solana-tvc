import fs from 'node:fs/promises';

export class FileManager {
  static async isFresh(filePath: string, ttlMs: number): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      const age = Date.now() - stat.mtimeMs;

      return age < ttlMs;
    } catch {
      return false;
    }
  }

  public static async refresh(
    fileDir: string,
    filePath: string,
    content: string
  ): Promise<void> {
    await fs.mkdir(fileDir, { recursive: true });
    await FileManager._writeAtomic(filePath, content);
  }

  private static async _writeAtomic(
    filePath: string,
    content: string
  ): Promise<void> {
    const tmpPath = `${filePath}.tmp`;

    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  }
}
