import { ShellCommand } from "../shell/types";

const matchColor = "magenta"; // todo config main color etc in shell?

export const grepCommand: ShellCommand = async function* (
  stdin,
  args,
  { parseArgs, std: { out, err }, isStdoutToConsole, color }
) {
  const { positional, flags } = parseArgs(args);
  const pattern = positional.length > 0 ? positional[0] : "";
  const isColored =
    flags["color"] !== "false" && (isStdoutToConsole || flags["color"]);
  let buffer = "";

  for await (const chunk of stdin) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index);
      if (pattern === "") yield out(line);
      else {
        const matchIndexes = findAllIndexes(line, pattern);
        if (matchIndexes.length !== 0) {
          let result = "";
          for (let i = 0; i < matchIndexes.length; i++) {
            const matchIndex = matchIndexes[i];
            const lastSegmentEnd =
              i === 0 ? 0 : matchIndexes[i - 1] + pattern.length;

            result += line.substring(lastSegmentEnd, matchIndex);

            const found = line.substring(
              matchIndex,
              matchIndex + pattern.length
            );
            result += isColored ? color[matchColor](found) : found;
          }
          result += line.substring(
            matchIndexes[matchIndexes.length - 1] + pattern.length
          );
          yield out(result);
        }

        // const indexOf = line.indexOf(pattern); // todo all indexes
        // if (indexOf !== -1) {
        //   if (isColored) {
        //     yield out(
        //       line.substring(0, indexOf) +
        //         color[matchColor](
        //           line.substring(indexOf, indexOf + pattern.length)
        //         ) +
        //         line.substring(indexOf + pattern.length)
        //     );
        //   } else yield out(line);
        // }
      }

      buffer = buffer.slice(index + 1);
    }
  }

  if (buffer && buffer.includes(pattern)) {
    yield err(buffer);
  }

  return 0;
};

function findAllIndexes(str: string, subStr: string) {
  const indexes = [];
  let currentIndex = 0;

  while (currentIndex !== -1) {
    currentIndex = str.indexOf(subStr, currentIndex);
    if (currentIndex !== -1) {
      indexes.push(currentIndex);
      currentIndex++;
    }
  }
  return indexes;
}
