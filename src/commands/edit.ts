import { Program } from "../core/types";
import { FileNode } from "../disk/types";

export const editCommand: Program = async function* (
  stdin,
  args,
  { std: { out }, fs: { open, createFile }, tryBindTerminal }
) {
  let file: FileNode | undefined;
  if (args.length > 0) {
    const node = open(args[0]);
    if (node && node.type !== "-") return 1;
    file = node;
  }

  const terminal = tryBindTerminal();
  if (!terminal) return 1;

  if (file) terminal.write(file.content);

  terminal.onKey((x) => {
    if (x.key === "Escape") {
      if (!file && args.length > 0) file = createFile(args[0]);
      if (file) file.content = terminal.getBuffer();
      terminal.close();
    } else if (x.key === "Enter") terminal.write("\n");
    else terminal.write(x.key);
  });
  await terminal.closed();

  return 0;
};
