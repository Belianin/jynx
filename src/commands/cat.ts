import { disk } from "../disk/disk";
import { CURRENT_DIR } from "../shell/env";
import { out } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const cat = (filename: string) => {
  const file = disk.find(filename);
  if (!file) throw new Error(`File ${filename} not found`);
  if ("content" in file) return file.content;

  throw new Error(`${filename} is not a file`);
};

export const catCommand: ShellCommand = async function* (stdin, args) {
  if (args.length === 0) return 0;
  const destination = args[0].startsWith("/")
    ? args[0]
    : CURRENT_DIR + "/" + args[0];
  const data = cat(destination);
  yield out(data);
  return 0;
};
