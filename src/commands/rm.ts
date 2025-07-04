import { disk } from "../disk/disk";
import { CURRENT_DIR } from "../shell/env";
import { handleError } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const removeFile: ShellCommand = async function* (stdin, args) {
  try {
    const path = args[0].startsWith("/")
      ? args[0]
      : CURRENT_DIR + "/" + args[0];
    disk.remove(path);
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
