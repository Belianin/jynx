import { Disk } from "../disk/disk";
import { changeCurrentDir } from "../shell/env";
import { parseArgs } from "../shell/parsing";
import { colorToConvert } from "../shell/print";
import { err, out } from "../shell/shell";
import { Core, Process, ShellCommand, StreamEvent } from "../shell/types";
import { HtmlTerminal } from "../terminal/HtmlTerminal";

export class Jynx implements Core {
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
    command: ShellCommand,
    args: string[],
    isStdoutToConsole: boolean,
    variables: Record<string, string>,
    onStd?: (value: number | StreamEvent) => void
  ) {
    let processId = this.lastProcessId;
    const process: Process = {
      id: processId,
      command,
      workingDirectory: "/home/guest", // todo
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
        makeSysFile: (path: string, command: ShellCommand) =>
          this.fs.makeSysFile(getPathTo(path), command),
      },
      tryBindTerminal: this.bindTerminal.bind(this),
      parseArgs,
      std: {
        out,
        err,
      },
      variables,
      changeDirectory: (path: string) => (process.workingDirectory = path), // todo validate
    });

    function iterate() {
      iterator.next().then(({ done, value }) => {
        onStd?.(value);
        if (!done) {
          // обработка value, если нужна
          iterate(); // рекурсивно продолжаем
        }
      });
    }
    iterate();

    return process;
  }

  bindTerminal() {
    if (this.terminal.isOpen) return;
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
