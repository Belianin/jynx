import { Disk } from "../disk/disk";
import { changeCurrentDir } from "../shell/env";
import { parseArgs } from "../shell/parsing";
import { colorToConvert } from "../shell/print";
import { err, out } from "../shell/shell";
import HtmlTerminal from "../terminal/HtmlTerminal";
import { Core, Process, Program, StreamEvent } from "./types";

export class Jinux implements Core {
  processes: Record<number, Process>;
  lastProcessId: number;
  fs: Disk;
  terminal: HtmlTerminal;

  constructor(fs: Disk, terminal: HtmlTerminal) {
    this.fs = fs;
    this.processes = {};
    this.lastProcessId = 0;
    this.terminal = terminal;
  }

  run(
    stdin: AsyncIterable<string>,
    command: Program,
    args: string[],
    isStdoutToConsole: boolean,
    variables: Record<string, string>,
    onStd?: (value: number | StreamEvent) => void
  ) {
    let processId = ++this.lastProcessId;
    let resolve = () => {};
    const closed = new Promise<void>((res) => {
      resolve = res;
    });
    const process: Process = {
      id: processId,
      command,
      workingDirectory: "/home/guest", // todo
      closed: () => closed,
    };

    const getPathTo = (path: string) => {
      const parts = path.startsWith("/")
        ? [""]
        : process.workingDirectory === "/"
        ? [""]
        : process.workingDirectory.split("/");

      // Разбиваем path по / и обрабатываем каждый элемент
      path.split("/").forEach((segment) => {
        if (segment === "..") {
          if (parts.length > 1) {
            parts.pop();
          }
        } else if (segment !== "" && segment !== ".") {
          parts.push(segment);
        }
      });

      // Собираем финальный путь
      return parts.join("/") || "/";
    };

    this.processes[processId] = process;
    const iterator = command(stdin, args, {
      color: colorToConvert,
      isStdoutToConsole,
      core: this,
      fs: {
        open: (path: string) => this.fs.find(getPathTo(path)),
        remove: (path: string) => this.fs.remove(getPathTo(path)),
        createDirectory: (path: string) =>
          this.fs.makeDirectory(getPathTo(path)),
        createFile: (path: string) => this.fs.makeFile(getPathTo(path)),
        getPathTo,
        changeWorkingDirectory: (path: string) => {
          path = getPathTo(path);
          const dir = this.fs.find(path);
          if (dir && (dir.type === "d" || dir.type === "r"))
            changeCurrentDir(path);
          // else this.print("Path to found\n"); // todo
        },
        makeSysFile: (path: string, command: Program) =>
          this.fs.makeSysFile(getPathTo(path), command),
      },
      tryBindTerminal: this.bindTerminal.bind(this),
      parseArgs,
      std: {
        out,
        err,
      },
      variables,
      id: processId,
      changeDirectory: (path: string) => (process.workingDirectory = path), // todo validate
    });

    const iterate = () => {
      iterator.next().then(({ done, value }) => {
        onStd?.(value);
        if (done) {
          delete this.processes[processId];
          resolve();
        } else {
          iterate();
        }
      });
    };
    iterate();

    return process;
  }

  bindTerminal() {
    // if (this.terminal.isOpen) {
    //   this.terminal.close();
    // }
    // this.terminal.clear(); // todo не уверен что всегда нужно
    // this.input.hide();
    this.terminal.isOpen = true;
    this.terminal.buffer = "";
    this.terminal.closedTermialPromise = new Promise<void>(
      (res) => (this.terminal.resolveСlosedTermialPromise = res)
    );
    return this.terminal;
  }
}
