import { writeJsonAtomically } from "../files/writeJsonAtomically";
import type { Logger } from "../logging/Logger";

import { fetchDistTags } from "./fetchDistTags";
import { readUpdateCheckFile } from "./readUpdateCheckFile";
import type { DistTags, UpdateCheckFile } from "./updateCheckFileSchema";

const dayMilliseconds = 24 * 60 * 60_000;

const minuteMilliseconds = 60_000;

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
 * Asks the npm registry for markdown-review's dist-tags about once a day for the user, keeping the answer in a cache
 * file that every repo's server and the CLI read
 */
export class UpdateChecker {
  private readonly cachePath: string;
  private checking: Promise<void> | undefined;
  private readonly fetch: typeof fetch;
  private isStarted = false;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private recorded: UpdateCheckFile | null = null;
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
    return (await this.readLatest())?.distTags ?? {};
  }

  /**
   * Checks now, then whenever the cache turns a day old while the process runs
   */
  public start(): void {
    this.isStarted = true;
    void this.checkAndSchedule();
  }

  public stop(): void {
    this.isStarted = false;
    clearTimeout(this.timer);
  }

  private async checkAndSchedule(): Promise<void> {
    await this.check();
    if (!this.isStarted) {
      return;
    }
    const cached = await this.readLatest();
    const untilStale =
      cached === null ? dayMilliseconds : Date.parse(cached.checkedAt) + dayMilliseconds - this.now().getTime();
    // At least a minute, so a clock that disagrees with the cache cannot make the checks spin
    const delay = Math.min(Math.max(untilStale, minuteMilliseconds), dayMilliseconds);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.checkAndSchedule(), delay);
    this.timer.unref();
  }

  private async refresh(): Promise<void> {
    const cached = await this.readLatest();
    const now = this.now();
    if (isFresh(cached, now)) {
      return;
    }
    let distTags: DistTags;
    try {
      distTags = await fetchDistTags(this.registry, this.fetch, this.timeoutMilliseconds);
    } catch (error) {
      this.logger.warn("Could not check the npm registry for a newer markdown-review", error);
      // Another repo's server may have saved a fresh answer while this request failed
      const latest = await this.readLatest();
      if (isFresh(latest, now)) {
        return;
      }
      distTags = latest?.distTags ?? {};
    }
    const file: UpdateCheckFile = { checkedAt: now.toISOString(), distTags };
    this.recorded = file;
    try {
      await writeJsonAtomically(this.cachePath, file);
    } catch (error) {
      this.logger.warn(`Could not write ${this.cachePath}`, error);
    }
  }

  /**
   * The cache file, or this checker's own last check when that is newer, as it is when the file could not be written
   */
  private async readLatest(): Promise<UpdateCheckFile | null> {
    const cached = await readUpdateCheckFile(this.cachePath);
    if (
      cached === null ||
      (this.recorded !== null && Date.parse(this.recorded.checkedAt) > Date.parse(cached.checkedAt))
    ) {
      return this.recorded;
    }
    return cached;
  }
}

function isFresh(file: UpdateCheckFile | null, now: Date): boolean {
  return file !== null && now.getTime() - Date.parse(file.checkedAt) < dayMilliseconds;
}
