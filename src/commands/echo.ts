import { ShellCommand } from "../shell/types";

export const echoCommand: ShellCommand = async function* echoCommand(
  stdin,
  args,
  { std: { out } }
) {
  yield out(args?.join(" "));
  return 0;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
