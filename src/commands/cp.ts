import { CURRENT_DIR } from "../shell/env";
import { err, handleError } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const copyCommand: ShellCommand = async function* (stdin, args, { fs }) {
  try {
    const path = args[0].startsWith("/")
      ? args[0]
      : CURRENT_DIR + "/" + args[0];
    const target = args[1].startsWith("/")
      ? args[1]
      : CURRENT_DIR + "/" + args[1];

    const node = fs.open(path);
    if (!node || !("parent" in node)) {
      yield err("Failed to copy");
      return 1;
    }
    if (target.endsWith("/")) {
      const targetNode = fs.open(target.substring(0, target.length - 1));
      if (!targetNode || !("children" in targetNode)) return 1;
      if (targetNode.children.find((x) => x.name === node.name)) {
        yield err("Already exists");

        return 1;
      }
      const copy = { ...node };
      copy.parent = targetNode;
      targetNode.children.push(copy);
    } else {
      const lastSlashIndex = target.lastIndexOf("/");
      let dirPath = target.substring(0, lastSlashIndex);
      if (dirPath === "") dirPath = "/";
      const targetNode = fs.open(dirPath);
      if (!targetNode || !("children" in targetNode)) return 1;
      const name = target.substring(lastSlashIndex + 1);
      if (targetNode.children.find((x) => x.name === name)) {
        yield err("Already exists");

        return 1;
      }
      const copy = { ...node, name };
      copy.parent = targetNode;
      targetNode.children.push(copy);
    }
    return 0;
  } catch (e: any) {
    yield handleError(e);
  }

  return 1;
};
