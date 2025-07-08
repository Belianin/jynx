import { Program } from "../core/types";
import { err } from "../shell/shell";

export const copyCommand: Program = async function* (
  stdin,
  args,
  { fs: { getPathTo, open } }
) {
  const path = getPathTo(args[0]);
  const target = getPathTo(args[1]);

  const node = open(path);
  if (!node || !("parent" in node)) {
    yield err("Failed to copy");
    return 1;
  }
  if (target.endsWith("/")) {
    const targetNode = open(target.substring(0, target.length - 1));
    if (!targetNode || !("children" in targetNode)) return 1;
    if (targetNode.children.find((x) => x.name === node.name)) {
      yield err("Already exists");

      return 1;
    }
    const copy = { ...node, created: new Date() };
    copy.parent = targetNode;
    targetNode.children.push(copy);
  } else {
    const lastSlashIndex = target.lastIndexOf("/");
    let dirPath = target.substring(0, lastSlashIndex);
    if (dirPath === "") dirPath = "/";
    const targetNode = open(dirPath);
    if (!targetNode || !("children" in targetNode)) return 1;
    const name = target.substring(lastSlashIndex + 1);
    if (targetNode.children.find((x) => x.name === name)) {
      yield err("Already exists");

      return 1;
    }
    const copy = { ...node, name, created: new Date() };
    copy.parent = targetNode;
    targetNode.children.push(copy);
  }
  return 0;
};
