import { disk } from "../disk";
import { CURRENT_DIR, ShellCommand } from "../shell";

export const makeDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  try {
    const path = args[0].startsWith("/")
      ? args[0]
      : CURRENT_DIR + "/" + args[0];
    disk.makeDirectory(path);
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};
