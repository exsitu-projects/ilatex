import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/LatexASTFormatter';

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

            try {
                const ast = new LatexAST(fileContent);

                const formatter = new LatexASTFormatter();
                ast.visit(formatter);

                console.log(formatter.formattedAST);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
}