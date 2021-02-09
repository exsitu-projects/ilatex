export type ArraySearchFailure = {
    success: false;
};

export type ArraySearchSuccess<T> = {
    success: true;
    element: T;
    index: number;
};

export type ArraySearchResult<T> = ArraySearchFailure | ArraySearchSuccess<T>;

export type ArraySearchPredicate<T> = (element: T) => boolean;

export abstract class ArrayUtils {
    static firstMatch<T>(array: T[], predicate: ArraySearchPredicate<T>): ArraySearchResult<T> {
        for (let i = 0; i < array.length; i++) {
            if (predicate(array[i])) {
                return ArrayUtils.createSearchSuccess(array[i], i);
            }
        }

        return ArrayUtils.createSearchFailure();
    }

    static lastMatch<T>(array: T[], predicate: ArraySearchPredicate<T>): ArraySearchResult<T> {
        for (let i = array.length - 1; i >= 0; i--) {
            if (predicate(array[i])) {
                return ArrayUtils.createSearchSuccess(array[i], i);
            }
        }

        return ArrayUtils.createSearchFailure();
    }

    private static createSearchSuccess<T>(element: T, index: number): ArraySearchSuccess<T> {
        return {
            success: true,
            element: element,
            index: index
        };
    }

    private static createSearchFailure(): ArraySearchFailure {
        return {
            success: false
        };
    }
}