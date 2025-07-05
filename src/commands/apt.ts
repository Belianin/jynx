import { Program } from "../core/types";
import { FileNode } from "../disk/types";
import { err, out } from "../shell/shell";

export const sourcesList = "/sys/etc/apt/sources";
export const defaultSources = "/public/repository\n";

export interface CommandModule {
  default: Program;
  manifestVersion: string;
}

export const aptCommand: Program = async function* (stdin, args, { fs }) {
  const commandName = args[0];
  const name = args[1];

  const sourcesFile = fs.open(sourcesList) as FileNode;
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

const findModule = async (
  sources: string[],
  name: string
): Promise<CommandModule | null> => {
  for (let source of sources) {
    const module = await tryGetModule(`${source}/${name}.js`);
    if (module) return module;
  }

  return null;
};

const tryGetModule = async (path: string): Promise<CommandModule | null> => {
  try {
    return (await import(path)) as CommandModule;
  } catch {
    return null;
  }
};
