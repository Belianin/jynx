import { DiskNode, FileNode, FolderNode } from "../disk/types";
import { ParsedArgs } from "./parsing";
import { Color } from "./print";

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

export type Terminal = {
  getBuffer: () => string;
  write: (value: string) => void;
  close: () => void;
  onKey: (callback: (e: KeyboardEvent) => void) => void;
  closed: () => Promise<void>;
};

export type ShellContext = {
  fs: {
    open: (path: string) => DiskNode | undefined;
    remove: (path: string) => void;
    createFile: (path: string) => FileNode | undefined;
    createDirectory: (path: string) => FolderNode | undefined;
    changeWorkingDirectory: (path: string) => void;
    getPathTo: (path: string) => string;
    makeSysFile: (path: string, command: ShellCommand) => void; // todo удалить
  };
  isStdoutToConsole: boolean;
  parseArgs: (args: string[]) => ParsedArgs;
  std: {
    out: (text: string) => StreamEvent;
    err: (text: string) => StreamEvent;
  };
  color: Record<Color, (text: string) => string>;
  variables: Record<string, string>;
  changeDirectory: (path: string) => void;
  tryBindTerminal: () => Terminal | undefined;
};
