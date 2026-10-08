/**
 * Lists thread IDs the way the CLI's sentences name them
 *
 * @param ids the thread IDs, in the order to list them
 * @returns e.g. "#14", "#14 and #15", or "#14, #15 and #16"
 */
export function formatIdList(ids: readonly number[]): string {
  const names = ids.map((id) => `#${id}`);
  const last = names.pop();
  if (last === undefined) {
    return "";
  }
  return names.length === 0 ? last : `${names.join(", ")} and ${last}`;
}
