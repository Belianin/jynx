import { ShellCommand } from "../shell/types";

export const editCommand: ShellCommand = async function* (
  stdin,
  args,
  { std: { out }, fs: { open }, tryBindTerminal }
) {
  const terminal = tryBindTerminal();
  if (!terminal) return 1;

  terminal.onKey((x) => {
    if (x === "Esc") terminal.close();
    else terminal.write(x);
  });
  await terminal.closed();

  return 0;
};
