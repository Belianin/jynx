import { Disk } from "../disk/disk";
import { DiskNode } from "../disk/types";
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
  disk: Disk;
  isStdoutToConsole: boolean;
  parseArgs: (args: string[]) => ParsedArgs;
  std: {
    out: (text: string) => StreamEvent;
    err: (text: string) => StreamEvent;
  };
  open: (path: string) => DiskNode | undefined;
  variables: Record<string, string>;
  changeDirectory: (path: string) => void;
};
