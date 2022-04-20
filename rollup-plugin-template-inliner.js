import * as fs from "fs";
import * as path from "path";
import { minify } from "html-minifier";


function collectStaticDataFromDirectory(pathToStaticDirectory) {
    const staticTransitionalData = {
        cssFiles: [],
        jsFiles: []
    };

    // Collect all CSS files
    const pathToCssDirectory = path.join(pathToStaticDirectory, "css/");
    if (fs.existsSync(pathToCssDirectory)) {
        const cssDirectoryFileNames = fs.readdirSync(pathToCssDirectory);

        for (let fileName of cssDirectoryFileNames) {
            const pathToCssFile = path.join(pathToCssDirectory, fileName);

            staticTransitionalData.cssFiles.push({
                fileName: fileName,
                path: pathToCssFile,
                content: fs.readFileSync(pathToCssFile, "utf-8")
            });
        }
    }

    // Collect all JS files
    const pathToJsDirectory = path.join(pathToStaticDirectory, "js/");
    if (fs.existsSync(pathToJsDirectory)) {
        const jsDirectoryFileNames = fs.readdirSync(pathToJsDirectory);
        
        for (let fileName of jsDirectoryFileNames) {
            const pathToJsFile = path.join(pathToJsDirectory, fileName);

            staticTransitionalData.jsFiles.push({
                fileName: fileName,
                path: pathToJsFile,
                content: fs.readFileSync(pathToJsFile, "utf-8")
            });
        }
    }

    return staticTransitionalData;
}

function collectStaticDataFromTransitionalDirectories() {
    const staticData = [];

    const transitionalDirectoryNames = fs.readdirSync("./src/transitionals/");
    for (let directoryName of transitionalDirectoryNames) {
        const pathToDirectory = path.resolve("./src/transitionals/", directoryName, "view/static/");
        const currentStaticTransitionalData = collectStaticDataFromDirectory(pathToDirectory);
        staticData.push(currentStaticTransitionalData);
    }

    return staticData;
}

function collectStaticDataFromTemplateDirectory() {
    const pathToDirectory = path.resolve("./src/webview/template/static");
    return [
        collectStaticDataFromDirectory(pathToDirectory)
    ];
}

function getAllStaticDataByType() {
    return [
        ...collectStaticDataFromTransitionalDirectories(),
        ...collectStaticDataFromTemplateDirectory()
    ]
    .reduce((staticDataByType, staticDataByDirectory) => {
        return {
            cssFiles: [...staticDataByType.cssFiles, ...staticDataByDirectory.cssFiles],
            jsFiles: [...staticDataByType.jsFiles, ...staticDataByDirectory.jsFiles]
        };
    }, {
        cssFiles: [],
        jsFiles: []
    });
}

function inlineStaticData(html, pathToBundle, staticData) {
    const inlinedCss = staticData.cssFiles
        .map(({ fileName, content }) => {
            return `
                <!-- ${fileName} -->
                <style>${content}</style>
            `;
        })
        .join("");

    const jsFilesWithBundle = [
        ...staticData.jsFiles,
        {
            fileName: path.basename(pathToBundle),
            path: pathToBundle,
            content: fs.readFileSync(pathToBundle)
        }
    ];

    const inlinedJs = jsFilesWithBundle
        .map(({ fileName, content }) => `
            <!-- ${fileName} -->
            <script type="text/javascript">${content}</script>
        `)
        .join("");

    return html
        .replace("</head>", () => inlinedCss + inlinedJs + "</head>");
}

// Default plugin options
const DEFAULT_PLUGIN_OPTIONS = {
    minify: false, // Whether to minify the output HTML (i.e. including JS and CSS)
};

// Custom plugin for inlining everything in a single HTML file
export default function templateInliner(pluginOptions = {}) {
    // Any option provided in the 'options' object will override the default values
    const options = { ...DEFAULT_PLUGIN_OPTIONS, ...pluginOptions };

    return {
        name: "template-inliner",

        load() {
            this.addWatchFile(path.resolve("./src/transitionals/"));
            this.addWatchFile(path.resolve("./src/webview/template/"));
        },

        writeBundle(outputOptions, bundle) {

            const staticData = getAllStaticDataByType();
            const pathToBundle = outputOptions.file;

            const pathToHtmlTemplate = path.resolve("./src/webview/template/webview.html");
            const pathToInlinedHtmlFile = path.resolve("./", path.parse(outputOptions.file).dir, "webview.inlined.html");

            const htmlTemplate = fs.readFileSync(pathToHtmlTemplate, "utf-8");
            let inlinedHtml = inlineStaticData(htmlTemplate, pathToBundle, staticData);

            // Optionally minify the HTML before writing it to the output file
            if (options.minify) {
                inlinedHtml = minify(inlinedHtml, {
                    removeComments: true,
                    minifyCSS: true,
                    minifyJS: {
                        keep_fnames: true
                    },
                });
            }

            fs.writeFileSync(pathToInlinedHtmlFile, inlinedHtml, "utf-8");
            console.info(`[rollup-plugin-template-inliner] HTML with inlined JS/CSS → ${pathToInlinedHtmlFile}`);
        }
    };
};