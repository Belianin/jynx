import { disk } from "../disk/disk";
import { ShellCommand } from "../shell/types";

export const diskCommand: ShellCommand = async function* (stdin, args) {
  try {
    yield {
      type: "stdout",
      data:
        JSON.stringify(
          disk.root,
          (key, value) => {
            if (key === "parent") return undefined;
            return value;
          },
          2
        ) + "\n",
    };
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};
