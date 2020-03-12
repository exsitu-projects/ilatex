import * as fs from 'fs';
import { LatexParser } from "./LatexParser";

export class InteractiveLaTeX {
    private activeDocumentPath: fs.PathLike;
    
    constructor(path: fs.PathLike) {
        this.activeDocumentPath = path;
        this.startWatching();
    }

    private startWatching(): void {
        let fsWait = false;
        fs.watch(this.activeDocumentPath, (event, filename) => {
            if (filename) {
                if (fsWait) {
                    return;
                }

                fsWait = true;
                setTimeout(() => {
                    fsWait = false;
                }, 100);

                console.log(`${filename} changed.`);
                this.parseActiveDocument();
            }
        });
    }

    private parseActiveDocument(): void {
        fs.readFile(this.activeDocumentPath, (error, data) =>  {
            const fileContent = data.toString();
            LatexParser.parse(fileContent);
        });
    }
}