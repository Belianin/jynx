import { disk } from "../disk";
import { CURRENT_DIR, ShellCommand } from "../shell";

export const cat = (filename: string) => {
  const file = disk.find(filename);
  if ("content" in file) return file.content;

  throw new Error(`${filename} is not a file`);
};

export const catCommand: ShellCommand = async function* (stdin, args) {
  const destination = args[0].startsWith("/")
    ? args[0]
    : CURRENT_DIR + "/" + args[0];
  yield { type: "stdout", data: cat(destination) + "\n" };
  return 0;
};
