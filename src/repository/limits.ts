// Guards the repository-interface contract. An HTTP backend cannot stream
// unbounded results, and a sqlite cursor backed by user input must still
// fail fast on degenerate queries.
export const MAX_SEARCH_RESULTS = 200;

// Guards arbitrary list reads from blowing up when a caller forgets to scope.
// Large enough that legitimate single-project listings pass; small enough
// that a forgotten filter stops at the boundary.
export const MAX_FIND_MANY = 1000;

// Cap on writes per withTransaction callback. An HTTP backend can map this
// to a batch-size limit; a sqlite backend keeps the transaction duration
// bounded so other callers do not starve on the write lock.
export const MAX_TXN_OPS = 500;

// Characters. FTS5 MATCH queries past this length are almost certainly
// misuse; the parameter reaches user input.
export const SEARCH_QUERY_LEN = 256;
