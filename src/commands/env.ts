import { Program } from "../core/types";

export const envCommand: Program = async function* (
  stdin,
  args,
  { variables, std: { out } }
) {
  for (let [key, value] of Object.values(variables))
    yield out(`${key}=${value}`);
  return 0;
};
