import { CURRENT_DIR, ShellCommand } from "./shell";

type RootNode = {
  name: "";
  children: NonRoot[];
};
type FileNode = {
  name: string;
  content: string;
  parent: DiskNode;
};
type ProgramFileNode = {
  name: string;
  // todo content?
  call: ShellCommand;
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

export class Disk {
  root: RootNode = {
    children: [],
    name: "",
  };

  find = (path: string): DiskNode => {
    let current = this.root as FolderLikeNode;
    if (path === "/") return current;
    const parts = path.split("/").splice(1);
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const next = current.children.find((x) => x.name === part);
      if (next) {
        if ("children" in next) {
          current = next;
        } else {
          throw new Error(`${getPath(next)} is a file`);
        }
      } else throw new Error(`${getPath(current)}/${part} not extists`);
    }

    const result = current.children.find(
      (x) => x.name === parts[parts.length - 1]
    );
    if (result) return result;

    throw new Error("File not found");
  };

  // todo remove
  findDirectory = (path: string) => {
    let current = this.root as FolderLikeNode;
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

  makeDirectory = (currentDirectory: string, path: string) => {
    let current = path.startsWith("/")
      ? this.root
      : this.findDirectory(currentDirectory);
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

  makeFile = (path: string, content: string) => {
    let current = this.root as FolderLikeNode;
    const parts = path.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const folder = parts[i];
      if (folder === "") continue;

      const next = current.children.find((x) => x.name === folder);
      if (next) {
        if ("children" in next) {
          current = next;
        } else {
          throw new Error("There is alread a file in a path");
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
    const file: FileNode = {
      parent: current,
      content,
      name: parts[parts.length - 1],
    };
    current.children.push(file);
  };
}

export const disk = new Disk();

function getPath(node: DiskNode) {
  const parts: string[] = [];
  parts.push(node.name);
  while ("parent" in node) {
    node = node.parent;
    parts.push(node.name);
  }

  return parts.reverse().join("/");
}

export const makeDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  // TODO: Get CURRENT_DIR
  try {
    disk.makeDirectory(CURRENT_DIR, args[0]);
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};

export const listDirectoryCommand: ShellCommand = async function* (
  stdin,
  args
) {
  try {
    const path = args.length === 0 ? CURRENT_DIR : args[0];
    let folder = path.startsWith("/")
      ? disk.findDirectory(path)
      : disk.findDirectory(CURRENT_DIR + "/" + path);

    const result = folder.children.map((x) => x.name).join("\t") + "\n";
    yield { type: "stdout", data: result };
    return 0;
  } catch (e: any) {
    if (e instanceof Error) yield { type: "stderr", data: e.message + "\n" };
    else yield { type: "stderr", data: "Internal error\n" };
  }

  return 1;
};

// export const treeCommand: ShellCommand = (args) => {
//   let result = "/";

//   function add(node: DiskNode, intendation: number) {
//     result += "\t".repeat(intendation) + node.name + "\n";
//     if ("children" in node) {
//       for (let child of node.children) {
//         add(child, intendation + 1);
//       }
//     }
//   }

//   add(root, 0);

//   return result;
// };
