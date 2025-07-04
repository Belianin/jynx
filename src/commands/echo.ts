import { ShellCommand } from "../shell/types";

export const echoCommand: ShellCommand = async function* echoCommand(
  stdin,
  args
) {
  yield { type: "stdout", data: args?.join(" ") + "\n" };
  return 0;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
