import { ShellCommand } from "../shell/types";
import {
  DiskNode,
  FileNode,
  FolderLikeNode,
  ProgramFileNode,
  RootNode,
} from "./types";

export class Disk {
  root: RootNode = {
    children: [],
    name: "",
  };

  find = (path: string): DiskNode | null => {
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
          throw new Error(`${this.getPath(next)} is a file`);
        }
      } else throw new Error(`${this.getPath(current)}/${part} not extists`);
    }

    const result = current.children.find(
      (x) => x.name === parts[parts.length - 1]
    );
    if (result) return result;

    return null;
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
          throw new Error(`${this.getPath(next)} is a file`);
        }
      } else throw new Error(`${this.getPath(current)}/${folder} not extists`);
    }

    return current;
  };

  makeDirectory = (path: string) => {
    let current = this.root as FolderLikeNode;
    for (let folder of path.split("/")) {
      if (folder === "") continue;

      const next = current.children.find((x) => x.name === folder);
      if (next) {
        if ("children" in next) {
          current = next;
        } else {
          throw new Error(`${this.getPath(next)} is a file`);
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

  // todo copyaster
  makeSysFile = (path: string, command: ShellCommand) => {
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
    const file: ProgramFileNode = {
      parent: current,
      command,
      name: parts[parts.length - 1],
    };
    current.children.push(file);
  };

  makeFile = (path: string, content: string): FileNode => {
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
