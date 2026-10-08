import type { Token } from "markdown-it";

/**
 * Reads a token that markdown-it guarantees is present, such as the token a render rule was called for
 *
 * @param tokens the token stream
 * @param index the token's position in the stream
 * @returns the token
 * @throws RangeError when no token is at that position
 */
export function tokenAt(tokens: readonly Token[], index: number): Token {
  const token = tokens[index];
  if (token === undefined) {
    throw new RangeError(`No markdown token at index ${index} of ${tokens.length}`);
  }
  return token;
}
