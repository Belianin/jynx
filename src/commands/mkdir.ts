import { handleError } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const makeDirectoryCommand: ShellCommand = async function* (
  stdin,
  args,
  { fs: { createDirectory } }
) {
  try {
    createDirectory(args[0]);
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
