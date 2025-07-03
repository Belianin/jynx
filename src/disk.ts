import { CommandFunc, CURRENT_DIR } from "./commands/shell";

type RootNode = {
  name: "";
  children: NonRoot[];
};
type FileNode = {
  name: string;
  parent: DiskNode;
};
type FolderNode = {
  name: string;
  children: NonRoot[];
  parent: DiskNode;
};
type FolderLikeNode = FolderNode | RootNode;
type NonRoot = FolderNode | FileNode;
type DiskNode = NonRoot | RootNode;

const root: RootNode = {
  children: [],
  name: "",
};

function getPath(node: DiskNode) {
  const parts: string[] = [];
  parts.push(node.name);
  while ("parent" in node) {
    node = node.parent;
    parts.push(node.name);
  }

  return parts.reverse().join("/");
}

const findDirectory = (path: string) => {
  let current = root as FolderLikeNode;
  if (path === "/") return current;
  for (let folder of path.split("/")) {
    if (folder === "") continue;
    const next = current.children.find((x) => x.name === folder);
    if (next) {
      if ("children" in next) {
        current = next;
      } else {
        throw new Error(`${getPath(next)} is a file`);
      }
    } else throw new Error(`${getPath(current)}/${folder} not extists`);
  }

  return current;
};

export const makeDirectory = (currentDirectory: string, path: string) => {
  let current = path.startsWith("/") ? root : findDirectory(currentDirectory);
  for (let folder of path.split("/")) {
    if (folder === "") continue;

    const next = current.children.find((x) => x.name === folder);
    if (next) {
      if ("children" in next) {
        current = next;
      } else {
        throw new Error(`${getPath(next)} is a file`);
      }
    } else {
      const newFolder = {
        parent: current,
        children: [],
        name: folder,
      };
      current.children.push(newFolder);
      current = newFolder;
    }
  }
};

export const makeDirectoryCommand: CommandFunc = (args) => {
  // TODO: Get CURRENT_DIR
  makeDirectory(CURRENT_DIR, args[0]);
  return "";
};

export const listDirectoryCommand: CommandFunc = (args) => {
  const path = args.length === 0 ? CURRENT_DIR : args[0];
  let folder = path.startsWith("/")
    ? findDirectory(path)
    : findDirectory(CURRENT_DIR + "/" + path);

  return folder.children.map((x) => x.name).join("\t");
};

export const treeCommand: CommandFunc = (args) => {
  let result = "/";

  function add(node: DiskNode, intendation: number) {
    result += "\t".repeat(intendation) + node.name + "\n";
    if ("children" in node) {
      for (let child of node.children) {
        add(child, intendation + 1);
      }
    }
  }

  add(root, 0);

  return result;
};
