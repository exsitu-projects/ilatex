import * as os from "os";
import * as path from "path";

export abstract class PathUtils {
    /**
     * Replace the leading tilde by the home directory of the current user.
     * 
     * If the first component of the path is not a tilde, the given string is returned.
     */
    static resolveLeadingTilde(pathToExpand: string): string {
        return pathToExpand.startsWith(`~${path.sep}`)
            ? path.join(os.homedir(), pathToExpand.substr(2))
            : pathToExpand;
    }
}