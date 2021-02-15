export type RawSourceFilePosition = {
    line: number,
    column: number
};

export type RawSourceFileRange = {
    from: RawSourceFilePosition,
    to: RawSourceFilePosition
};