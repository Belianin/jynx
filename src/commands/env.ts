import { envPath, out } from "../shell/shell";
import { ShellCommand } from "../shell/types";
import { cat } from "./cat";

export const envCommand: ShellCommand = async function* (stdin, args) {
  const destination = envPath;
  yield out(cat(destination));
  return 0;
};
