import { Disk } from "../disk/disk";
import { DiskNode, FileNode, FolderNode } from "../disk/types";
import { ParsedArgs } from "../shell/parsing";
import { Color } from "../shell/print";
import { Terminal } from "../terminal/types";

export type StreamEvent = {
  type: "stdout" | "stderr";
  data: string;
};
export type CommandOutput = AsyncGenerator<StreamEvent, number, void>;

export type Program = (
  stdin: AsyncIterable<string>,
  args: string[],
  context: ShellContext
) => CommandOutput;

export type ShellContext = {
  fs: {
    open: (path: string) => DiskNode | undefined;
    remove: (path: string) => void;
    createFile: (path: string) => FileNode | undefined;
    createDirectory: (path: string) => FolderNode | undefined;
    getPathTo: (path: string) => string;
    makeSysFile: (path: string, command: Program) => void; // todo удалить
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
  getWorkingDirectory: () => string;
  changeWorkingDirectory: (path: string) => void;
  tryBindTerminal: () => Terminal | undefined;
  id: number;
};

export type Process = {
  id: number;
  command: Program;
  workingDirectory: string;
  closed(): Promise<void>; // todo number
};

export type ProcessContext = {
  fs: Disk;
  variables: Record<string, string>;
  terminal: Terminal;
};

export interface Core {
  processes: Record<number, Process>;
  run: (
    // todo parentProcessId
    stdin: AsyncIterable<string>,
    command: Program,
    args: string[],
    isStdoutToConsole: boolean,
    variables: Record<string, string>,
    onStd?: (value: number | StreamEvent) => void
  ) => Process;
}
