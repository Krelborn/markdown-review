import { RegistryRequestError } from "./RegistryRequestError";
import type { DistTags } from "./updateCheckFileSchema";
import { distTagsSchema } from "./updateCheckFileSchema";

const packageName = "@krelborn/markdown-review";

/**
 * Asks the registry for the package's dist-tags
 *
 * @param registry the registry's URL, without a trailing slash
 * @param fetchUrl the fetch to send the request with
 * @param timeoutMilliseconds how long to wait for the whole response
 * @returns the `latest` and `next` tags, when the registry has them
 * @throws when the request fails, times out, or the response is not a dist-tags object
 */
export async function fetchDistTags(
  registry: string,
  fetchUrl: typeof fetch,
  timeoutMilliseconds: number
): Promise<DistTags> {
  const url = `${registry}/-/package/${encodeURIComponent(packageName)}/dist-tags`;
  const response = await fetchUrl(url, { signal: AbortSignal.timeout(timeoutMilliseconds) });
  if (!response.ok) {
    throw new RegistryRequestError(url, response.status);
  }
  return distTagsSchema.parse(await response.json());
}
