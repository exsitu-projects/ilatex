/** Ignore readonly modifiers on the given type. */
// From https://stackoverflow.com/a/43001581
type Writeable<T> = { -readonly [P in keyof T]: T[P] };