import { err, out } from "../shell/shell";
export const sourcesList = "/sys/etc/apt/sources";
export const defaultSources = "/public/repository\n";
export const aptCommand = async function* (stdin, args, { fs }) {
    const commandName = args[0];
    const name = args[1];
    const sourcesFile = fs.open(sourcesList);
    if (!sourcesFile) {
        yield err("No sources available");
        return 1;
    }
    const sources = sourcesFile.content
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x !== "");
    const module = await findModule(sources, name);
    if (!module) {
        yield out(`Module ${name} not found`);
        return 1;
    }
    const command = module.default;
    fs.makeSysFile(`/usr/bin/${name}`, command);
    return 0;
};
const findModule = async (sources, name) => {
    for (let source of sources) {
        const module = await tryGetModule(`${source}/${name}.js`);
        if (module)
            return module;
    }
    return null;
};
const tryGetModule = async (path) => {
    try {
        return (await import(path));
    }
    catch {
        return null;
    }
};
