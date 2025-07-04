import { DiskNode, FileNode, FolderNode } from "../disk/types";
import { ParsedArgs } from "./parsing";

export type StreamEvent = {
  type: "stdout" | "stderr";
  data: string;
};
export type CommandOutput = AsyncGenerator<StreamEvent, number, void>;

export type ShellCommand = (
  stdin: AsyncIterable<string>,
  args: string[],
  context: ShellContext
) => CommandOutput;

export interface WritableStreamLike {
  write(data: string): void;
}

export interface Stream extends AsyncIterable<string>, WritableStreamLike {
  close(): void;
}

export type ShellContext = {
  fs: {
    open: (path: string) => DiskNode | undefined;
    remove: (path: string) => void;
    createFile: (path: string) => FileNode | undefined;
    createDirectory: (path: string) => FolderNode | undefined;
  };
  isStdoutToConsole: boolean;
  parseArgs: (args: string[]) => ParsedArgs;
  std: {
    out: (text: string) => StreamEvent;
    err: (text: string) => StreamEvent;
  };
  variables: Record<string, string>;
  changeDirectory: (path: string) => void;
};
