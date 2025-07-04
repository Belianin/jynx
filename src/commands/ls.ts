import { disk } from "../disk/disk";
import { CURRENT_DIR } from "../shell/env";
import { handleError, out } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const listDirectoryCommand: ShellCommand = async function* (
  stdin,
  args,
  { parseArgs }
) {
  const parsedArgs = parseArgs(args);
  try {
    const path =
      parsedArgs.positional.length === 0
        ? CURRENT_DIR
        : parsedArgs.positional[0];
    let folder = path.startsWith("/")
      ? disk.findDirectory(path)
      : disk.findDirectory(CURRENT_DIR + "/" + path);

    if (parsedArgs.flags["l"]) {
      const colWidths = [0, 0, 0, 0, 0, 0, 0];

      const rows: string[][] = [];

      // let maxSizeSize = 0
      for (let item of folder.children) {
        if (parsedArgs.flags["a"] || !item.name.startsWith(".")) continue;

        const isDir = "children" in item;
        const type = isDir ? "d" : "-";
        const row: string[] = [
          `${type}rw-r--r--`,
          "0",
          "guest",
          "guest",
          "0",
          "some-date",
          item.name,
        ];
        for (let i = 0; i < row.length; i++) {
          const colWidth = row[i].length;
          if (colWidths[i] < colWidth) colWidths[i] = colWidth;
        }
        rows.push(row);
        // const size =
      }

      // печатаем с выравниванием
      for (const row of rows) {
        const line = row.map((val, i) => val.padEnd(colWidths[i] + 1)).join("");
        yield out(line);
      }

      return 0;
    } else {
      // todo
      // if (parsedArgs.flags['a'] || !item.name.startsWith('.'))
      //   continue;
      yield out(folder.children.map((x) => x.name).join("\t"));
      return 0;
    }
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
