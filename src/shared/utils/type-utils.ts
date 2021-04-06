/** Ignore readonly modifiers on the given type. */
// From https://stackoverflow.com/a/43001581
type Writeable<T> = { -readonly [P in keyof T]: T[P] };

/** Get all the possible key of the given type (e.g. of a disjoint union type). */
// From https://stackoverflow.com/a/49402091
type EveryPossibleKeysOf<T> = T extends T ? keyof T: never;