import { DiskNode, FileNode, FolderNode } from "../disk/types";
import { ParsedArgs } from "./parsing";
import { Color } from "./print";
import { Core, KeyHandler } from "./shell";

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

export interface Terminal {
  width: number;
  getBuffer: () => string;
  write: (value: string) => void;
  remove: () => void;
  close: () => void;
  onKey: (callback: KeyHandler) => void;
  closed: () => Promise<void>;
  clear: () => void;
  getCursorPosition: () => {
    x: number;
    y: number;
  };
  setCursorPosition: (x: number | undefined, y: number | undefined) => void;
  removeAfterCursorLine: () => void;
}

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
  core: Core;
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
