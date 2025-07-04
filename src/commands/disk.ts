import { disk } from "../disk/disk";
import { handleError, out } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const diskCommand: ShellCommand = async function* (stdin, args) {
  try {
    yield out(
      JSON.stringify(
        disk.root,
        (key, value) => {
          if (key === "parent") return undefined;
          return value;
        },
        2
      )
    );
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
