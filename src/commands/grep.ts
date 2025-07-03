import { ShellCommand } from "../shell/types";

export const grepCommand: ShellCommand = async function* (stdin, args) {
  const pattern = args.length > 0 ? args[0] : "";
  let buffer = "";

  for await (const chunk of stdin) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index);
      if (line.includes(pattern)) {
        yield { type: "stdout", data: line + "\n" };
      }
      buffer = buffer.slice(index + 1);
    }
  }

  // обработка оставшегося буфера при EOF
  if (buffer && buffer.includes(pattern)) {
    yield { type: "stdout", data: buffer + "\n" };
  }

  return 0;
};
