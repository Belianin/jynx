import { disk } from "../disk/disk";
import { CURRENT_DIR } from "../shell/env";
import { ShellCommand } from "../shell/types";

export const copyCommand: ShellCommand = async function* (stdin, args) {
  try {
    const path = args[0].startsWith("/")
      ? args[0]
      : CURRENT_DIR + "/" + args[0];
    const target = args[1].startsWith("/")
      ? args[1]
      : CURRENT_DIR + "/" + args[1];

    const node = disk.find(path);
    if (!node || !("parent" in node)) {
      yield { type: "stderr", data: "Failed to copy\n" };
      return 1;
    }
    if (target.endsWith("/")) {
      const targetNode = disk.find(target.substring(0, target.length - 1));
      if (!targetNode || !("children" in targetNode)) return 1;
      if (targetNode.children.find((x) => x.name === node.name)) {
        yield { type: "stderr", data: "Already exists\n" };

        return 1;
      }
      const copy = { ...node };
      copy.parent = targetNode;
      targetNode.children.push(copy);
    } else {
      const lastSlashIndex = target.lastIndexOf("/");
      let dirPath = target.substring(0, lastSlashIndex);
      if (dirPath === "") dirPath = "/";
      const targetNode = disk.find(dirPath);
      if (!targetNode || !("children" in targetNode)) return 1;
      const name = target.substring(lastSlashIndex + 1);
      if (targetNode.children.find((x) => x.name === name)) {
        yield { type: "stderr", data: "Already exists" };

        return 1;
      }
      const copy = { ...node, name };
      copy.parent = targetNode;
      targetNode.children.push(copy);
    }
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};
