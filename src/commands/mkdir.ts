import { Program } from "../core/types";

export const makeDirectoryCommand: Program = async function* (
  stdin,
  args,
  { fs: { createDirectory } }
) {
  createDirectory(args[0]);
  return 0;
};
