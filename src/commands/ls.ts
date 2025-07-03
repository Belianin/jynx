import { disk } from "../disk";
import { CURRENT_DIR, ShellCommand } from "../shell";

export const listDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  try {
    const path = args.length === 0 ? CURRENT_DIR : args[0];
    let folder = path.startsWith("/")
      ? disk.findDirectory(path)
      : disk.findDirectory(CURRENT_DIR + "/" + path);

    const result = folder.children.map((x) => x.name).join("\t") + "\n";
    yield { type: "stdout", data: result };
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};
