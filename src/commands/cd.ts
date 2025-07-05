import { Program } from "../core/types";
import { err } from "../shell/shell";

export const changeDirectoryCommand: Program = async function* (
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
