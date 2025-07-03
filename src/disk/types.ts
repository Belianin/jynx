import { ShellCommand } from "../shell/types";

export type RootNode = {
  name: "";
  children: NonRoot[];
};
export type FileNode = {
  name: string;
  content: string;
  parent: DiskNode;
};
export type ProgramFileNode = {
  name: string;
  // todo content?
  command: ShellCommand;
  parent: DiskNode;
};
export type FolderNode = {
  name: string;
  children: NonRoot[];
  parent: DiskNode;
};
export type FolderLikeNode = FolderNode | RootNode;
export type NonRoot = FolderNode | FileNode | ProgramFileNode;
export type DiskNode = NonRoot | RootNode;
