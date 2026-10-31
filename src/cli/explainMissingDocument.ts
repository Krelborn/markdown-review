import { CliError } from "./CliError";
import { ServerRequestError } from "./ServerRequestError";

/**
 * Turns the server's refusal of a `--document` that does not exist, and has no threads, into a CliError
 *
 * @param error whatever the request failed with
 * @param value the `--document` option's value
 * @returns the CliError for that refusal, or the error itself for anything else
 */
export function explainMissingDocument(error: unknown, value: string | undefined): unknown {
  if (error instanceof ServerRequestError && error.reason === "missing-document") {
    return new CliError(
      `${value ?? "The doc"} does not exist, and the review has no threads on it`,
      "Check the path and run the command again, or run it without --document to cover every doc."
    );
  }
  return error;
}
