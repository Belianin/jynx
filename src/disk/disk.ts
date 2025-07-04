import { ShellCommand } from "../shell/types";
import {
  DiskNode,
  FileNode,
  FolderLikeNode,
  FolderNode,
  isFolderLike,
  ProgramFileNode,
  RootNode,
} from "./types";

export class Disk {
  root: RootNode = {
    children: [],
    name: "",
    permissions: "rw-rw-rw-",
    type: "r",
    created: new Date(),
    owner: "guest",
    ownerGroup: "guest",
  };

  find = (path: string): DiskNode | undefined => {
    let current = this.root as FolderLikeNode;
    if (path === "/") return current;
    const parts = path.split("/").splice(1);
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const next = current.children.find((x) => x.name === part);
      if (next) {
        if (isFolderLike(next)) {
          current = next;
        } else {
          throw new Error(`${this.getPath(next)} is a file`);
        }
      } else throw new Error(`${this.getPath(current)}/${part} not extists`);
    }

    return current.children.find((x) => x.name === parts[parts.length - 1]);
  };

  // todo remove
  findDirectory = (path: string) => {
    let current = this.root as FolderLikeNode;
    if (path === "/") return current;
    for (let folder of path.split("/")) {
      if (folder === "") continue;
      const next = current.children.find((x) => x.name === folder);
      if (next) {
        if (isFolderLike(next)) {
          current = next;
        } else {
          throw new Error(`${this.getPath(next)} is a file`);
        }
      } else throw new Error(`${this.getPath(current)}/${folder} not extists`);
    }

    return current;
  };

  remove = (path: string) => {
    const file = this.find(path);
    if (file && "parent" in file)
      file.parent.children = file.parent.children.filter((x) => x !== file);
  };

  makeDirectory = (path: string) => {
    let current = this.root as FolderLikeNode;
    let lastCreated: FolderNode | undefined;
    for (let folder of path.split("/")) {
      if (folder === "") continue;

      const next = current.children.find((x) => x.name === folder);
      if (next) {
        if (isFolderLike(next)) {
          current = next;
        } else {
          throw new Error(`${this.getPath(next)} is a file`);
        }
      } else {
        const newFolder: FolderNode = {
          parent: current,
          children: [],
          name: folder,
          permissions: "rw-r--r--",
          type: "d",
          created: new Date(),
          owner: "guest",
          ownerGroup: "guest",
        };
        current.children.push(newFolder);
        current = newFolder;
        lastCreated = newFolder;
      }

      return lastCreated;
    }
  };

  // todo copyaster
  makeSysFile = (path: string, command: ShellCommand) => {
    let current = this.root as FolderLikeNode;
    const parts = path.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const folder = parts[i];
      if (folder === "") continue;

      const next = current.children.find((x) => x.name === folder);
      if (next) {
        if (isFolderLike(next)) {
          current = next;
        } else {
          throw new Error("There is alread a file in a path");
        }
      } else {
        const newFolder: FolderNode = {
          parent: current,
          children: [],
          name: folder,
          permissions: "rw-r--r--",
          type: "d",
          created: new Date(),
          owner: "guest",
          ownerGroup: "guest",
        };
        current.children.push(newFolder);
        current = newFolder;
      }
    }
    const file: ProgramFileNode = {
      parent: current,
      command,
      name: parts[parts.length - 1],
      permissions: "rw-r--r--",
      type: "x",
      created: new Date(),
      owner: "guest",
      ownerGroup: "guest",
    };
    current.children.push(file);
  };

  makeFile = (path: string, content?: string): FileNode => {
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
        const newFolder: FolderNode = {
          parent: current,
          children: [],
          name: folder,
          permissions: "rw-r--r--",
          type: "d",
          created: new Date(),
          owner: "guest",
          ownerGroup: "guest",
        };
        current.children.push(newFolder);
        current = newFolder;
      }
    }
    const file: FileNode = {
      parent: current,
      content: content || "",
      name: parts[parts.length - 1],
      permissions: "rw-r--r--",
      type: "-",
      created: new Date(),
      owner: "guest",
      ownerGroup: "guest",
    };
    current.children.push(file);

    return file;
  };

  getPath(node: DiskNode) {
    const parts: string[] = [];
    parts.push(node.name);
    while ("parent" in node) {
      node = node.parent;
      parts.push(node.name);
    }

    return parts.reverse().join("/");
  }
}

export const disk = new Disk();
