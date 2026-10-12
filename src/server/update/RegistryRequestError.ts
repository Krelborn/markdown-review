/**
 * A dist-tags request the npm registry answered with an error status
 */
export class RegistryRequestError extends Error {
  public readonly status: number;

  public constructor(url: string, status: number) {
    super(`${url} answered ${status}`);
    this.name = "RegistryRequestError";
    this.status = status;
  }
}
