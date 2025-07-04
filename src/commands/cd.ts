import { err } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const changeDirectoryCommand: ShellCommand = async function* (
  stdin,
  args,
  { fs: { changeWorkingDirectory } }
) {
  try {
    changeWorkingDirectory(args[0]);
    return 0;
  } catch (e: any) {
    yield err(e);
  }

  return 1;
};
