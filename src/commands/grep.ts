import { ShellCommand } from "../shell/types";

export const grepCommand: ShellCommand = async function* (
  stdin,
  args,
  { std: { out, err } }
) {
  const pattern = args.length > 0 ? args[0] : "";
  let buffer = "";

  for await (const chunk of stdin) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index);
      if (line.includes(pattern)) {
        yield out(line);
      }
      buffer = buffer.slice(index + 1);
    }
  }

  if (buffer && buffer.includes(pattern)) {
    yield err(buffer);
  }

  return 0;
};
