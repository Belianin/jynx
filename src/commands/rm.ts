import { handleError } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const removeFile: ShellCommand = async function* (
  stdin,
  args,
  { fs: { remove } }
) {
  try {
    remove(args[0]);
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
