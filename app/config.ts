/** Event labels shown on the voting page. */
export const event = {
  title: 'Lomba Pilihan Favorit',
  help: 'Hubungi panitia di meja registrasi.',
};

/**
 * Fixed number of contestants. Contestant ids are 1..candidateCount.
 * Names and photos live in the `contestants` table and are edited from /admin.
 *
 * Keep this in sync with the `candidate between 1 and 12` check constraint in
 * supabase/migrations/npvote_schema.sql.
 */
export const candidateCount = 12;
