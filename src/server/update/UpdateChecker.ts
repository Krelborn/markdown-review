import { writeJsonAtomically } from "../files/writeJsonAtomically";
import type { Logger } from "../logging/Logger";

import { fetchDistTags } from "./fetchDistTags";
import { readUpdateCheckFile } from "./readUpdateCheckFile";
import type { DistTags, UpdateCheckFile } from "./updateCheckFileSchema";

const dayMilliseconds = 24 * 60 * 60_000;

interface UpdateCheckerOptions {
  /**
   * The user's update check cache file
   */
  cachePath: string;

  fetch?: typeof fetch;
  logger: Logger;
  now?: () => Date;

  /**
   * The npm registry's URL, without a trailing slash
   */
  registry: string;

  /**
   * How long to wait for the registry before giving up until the next check
   */
  timeoutMilliseconds?: number;
}

/**
 * Asks the npm registry for markdown-review's dist-tags at most once a day for the user, keeping the answer in a cache
 * file that every repo's server and the CLI read
 */
export class UpdateChecker {
  private readonly cachePath: string;
  private checking: Promise<void> | undefined;
  private readonly fetch: typeof fetch;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly registry: string;
  private timer: NodeJS.Timeout | undefined;
  private readonly timeoutMilliseconds: number;

  public constructor({
    cachePath,
    fetch: fetchUrl = fetch,
    logger,
    now = () => new Date(),
    registry,
    timeoutMilliseconds = 3_000,
  }: UpdateCheckerOptions) {
    this.cachePath = cachePath;
    this.fetch = fetchUrl;
    this.logger = logger;
    this.now = now;
    this.registry = registry;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  /**
   * Asks the registry unless the cache is less than a day old; never rejects
   *
   * @returns once the cache is up to date, or the check has failed
   */
  public check(): Promise<void> {
    this.checking ??= this.refresh().finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  }

  /**
   * @returns the dist-tags last recorded, after any check in progress ends; empty when none are known
   */
  public async distTags(): Promise<DistTags> {
    await this.checking;
    return (await readUpdateCheckFile(this.cachePath))?.distTags ?? {};
  }

  /**
   * Checks now, then once a day while the process runs
   */
  public start(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), dayMilliseconds);
    this.timer.unref();
  }

  public stop(): void {
    clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    const cached = await readUpdateCheckFile(this.cachePath);
    const now = this.now();
    if (cached !== null && now.getTime() - Date.parse(cached.checkedAt) < dayMilliseconds) {
      return;
    }
    let distTags = cached?.distTags ?? {};
    try {
      distTags = await fetchDistTags(this.registry, this.fetch, this.timeoutMilliseconds);
    } catch (error) {
      this.logger.warn("Could not check the npm registry for a newer markdown-review", error);
    }
    const file: UpdateCheckFile = { checkedAt: now.toISOString(), distTags };
    try {
      await writeJsonAtomically(this.cachePath, file);
    } catch (error) {
      this.logger.warn(`Could not write ${this.cachePath}`, error);
    }
  }
}
