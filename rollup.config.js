import typescript from "rollup-plugin-typescript2";
import templateInliner from "./rollup-plugin-template-inliner";
import pkg from "./package.json";
    
export default {
    input: "src/webview/webview.ts",
    
    output: [
        {
            file: "out/webview/webview.bundled.js",
            format: "umd",
            name: "webview",
            globals: {
                // TODO
            }
        }
    ],
    
    external: [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
    ],
    
    plugins: [
        typescript({
            typescript: require("typescript"),
            tsconfig: "tsconfig.webview.json"
        }),

        templateInliner()
    ]
};