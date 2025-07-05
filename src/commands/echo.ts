import { Program } from "../core/types";

export const echoCommand: Program = async function* echoCommand(
  stdin,
  args,
  { std: { out } }
) {
  yield out(args?.join(" "));
  return 0;
};
