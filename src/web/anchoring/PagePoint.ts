/**
 * A boundary point in the rendered page, as a DOM Range gives one
 */
export interface PagePoint {
  node: Node;
  offset: number;
}
