import { isFile } from "../disk/types";
import { ShellCommand } from "../shell/types";

export const catCommand: ShellCommand = async function* (
  stdin,
  args,
  { disk, std: { out }, open }
) {
  if (args.length === 0) return 0;
  const filename = args[0];
  const file = open(filename);
  if (!file) throw new Error(`File ${filename} not found`);
  if (isFile(file)) yield out(file.content);
  else throw new Error(`${filename} is not a file`);
  return 0;
};
