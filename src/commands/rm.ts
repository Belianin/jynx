import { Program } from "../core/types";

export const removeFile: Program = async function* (
  stdin,
  args,
  { fs: { remove } }
) {
  remove(args[0]);
  return 0;
};
