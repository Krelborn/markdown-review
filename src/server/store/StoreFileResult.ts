/**
 * The outcome of reading a store file; an invalid file is reported, never overwritten
 */
export type StoreFileResult<Value> = { kind: "valid"; value: Value } | { kind: "invalid"; problem: string };
