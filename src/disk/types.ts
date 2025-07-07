import { Program } from "../core/types";

export type NodeInfo = {
  permissions: string;
  owner: string;
  ownerGroup: string;
  created: Date;
};

export type RootNode = NodeInfo & {
  name: "";
  children: NonRoot[];
  type: "r";
};
export type FileNode = NodeInfo & {
  name: string;
  content: string;
  parent: FolderLikeNode;
  type: "-";
};
export type ProgramFileNode = NodeInfo & {
  name: string;
  // todo content?
  command: Program;
  parent: FolderLikeNode;
  type: "x";
};
// todo rename to DirectoryNode
export type FolderNode = NodeInfo & {
  name: string;
  children: NonRoot[];
  parent: FolderLikeNode;
  type: "d";
};
export type FolderLikeNode = FolderNode | RootNode;
export type NonRoot = FolderNode | FileNode | ProgramFileNode;
export type DiskNode = NonRoot | RootNode;

export const isFile = (node: DiskNode): node is FileNode => {
  return "content" in node;
};
export const isFolder = (node: DiskNode): node is FolderNode => {
  return "parent" in node || "children" in node;
};
export const isFolderLike = (node: DiskNode): node is FolderLikeNode => {
  return "children" in node;
};
