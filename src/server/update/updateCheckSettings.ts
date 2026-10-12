import os from "node:os";
import path from "node:path";

type Environment = Partial<Record<string, string>>;

const defaultRegistryUrl = "https://registry.npmjs.org";

/**
 * @param env the environment, for `XDG_CACHE_HOME` and `HOME`
 * @returns the user's update check cache file, shared by every repo
 */
export function updateCheckFilePath(env: Environment): string {
  const cacheHome = env.XDG_CACHE_HOME;
  const cacheDirectory =
    cacheHome !== undefined && path.isAbsolute(cacheHome) ? cacheHome : path.join(env.HOME ?? os.homedir(), ".cache");
  return path.join(cacheDirectory, "markdown-review", "update-check.json");
}

/**
 * @param env the environment, for `MARKDOWN_REVIEW_REGISTRY_URL`
 * @returns the npm registry to ask for dist-tags, without a trailing slash
 */
export function registryUrl(env: Environment): string {
  return (env.MARKDOWN_REVIEW_REGISTRY_URL ?? defaultRegistryUrl).replace(/\/+$/u, "");
}

/**
 * @param env the environment
 * @returns whether the user or CI has opted out of update checks, through `MARKDOWN_REVIEW_NO_UPDATE_CHECK=1`,
 *   `NO_UPDATE_NOTIFIER` or `CI`
 */
export function updateChecksDisabled(env: Environment): boolean {
  return env.MARKDOWN_REVIEW_NO_UPDATE_CHECK === "1" || (env.NO_UPDATE_NOTIFIER ?? "") !== "" || (env.CI ?? "") !== "";
}
