/**
 * Presentation values for the public Top 3.
 *
 * These numbers exist only to make the final podium look balanced on the
 * results page. They are never written to the database, never influence the
 * ranking, and are never used for voter counts, percentages or exports.
 */

/** Floor for each rank, expressed as a share of the leader's real total. */
const FLOOR = [1, 0.835, 0.625];

function hasDuplicate(values: number[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Returns the values displayed on the results page.
 *
 * `actual` is ordered by rank (highest first) and holds only the contestants
 * that already qualified for the Top 3, based on real votes.
 *
 *  - rank 1 always shows its real total;
 *  - rank 2 and rank 3 show the larger of their real total and a share of the
 *    leader's total (0.835 / 0.625), so real values above the floor stay as-is;
 *  - the calculation is deterministic and free of randomness;
 *  - when the real totals contain a tie, or when the rounded values would
 *    create a tie that did not exist, the real totals are returned for the
 *    whole Top 3.
 */
export function presentationValues(actual: number[]): number[] {
  if (actual.length === 0) return [];
  if (hasDuplicate(actual)) return actual.slice();

  const leader = actual[0];
  const shown = actual.map((votes, index) =>
    index === 0 ? votes : Math.max(votes, Math.round(leader * FLOOR[index])),
  );

  return hasDuplicate(shown) ? actual.slice() : shown;
}
