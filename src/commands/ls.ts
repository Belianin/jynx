import { disk } from "../disk/disk";
import { CURRENT_DIR } from "../shell/env";
import { handleError, out } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const listDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  try {
    const path = args.length === 0 ? CURRENT_DIR : args[0];
    let folder = path.startsWith("/")
      ? disk.findDirectory(path)
      : disk.findDirectory(CURRENT_DIR + "/" + path);

    yield out(folder.children.map((x) => x.name).join("\t"));
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
