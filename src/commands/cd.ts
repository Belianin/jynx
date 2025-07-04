import { disk } from "../disk/disk";
import { changeCurrentDir, CURRENT_DIR } from "../shell/env";
import { err } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const changeDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  try {
    const path = args.length === 0 ? CURRENT_DIR : args[0];
    let folder = path.startsWith("/")
      ? disk.findDirectory(path)
      : disk.findDirectory(CURRENT_DIR + "/" + path);

    changeCurrentDir(disk.getPath(folder));
    return 0;
  } catch (e: any) {
    yield err(e);
  }

  return 1;
};
