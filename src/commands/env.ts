import { envPath } from "../shell/shell";
import { ShellCommand } from "../shell/types";
import { cat } from "./cat";

export const envCommand: ShellCommand = async function* (stdin, args) {
  const destination = envPath;
  yield { type: "stdout", data: cat(destination) + "\n" };
  return 0;
};
