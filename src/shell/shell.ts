import { Disk } from "../disk/disk";
import { FileNode } from "../disk/types";
import { changeCurrentDir, CURRENT_DIR, DOMAIN, USERNAME } from "./env";
import { CommandToken, parseArgs, shellParse } from "./parsing";
import {
  colorToConvert,
  createTextElement,
  defaultColor,
  parseColorText,
  PrintableText,
} from "./print";
import {
  ShellCommand,
  ShellContext,
  Stream,
  StreamEvent,
  Terminal,
  WritableStreamLike,
} from "./types";

export const getPrefix = (): PrintableText[] => {
  return [
    {
      value: `${USERNAME}@${DOMAIN}`,
      color: "gray",
    },
    {
      value: ":",
    },
    {
      value: (CURRENT_DIR === "" ? "/" : CURRENT_DIR) + " ",
      color: "orange",
    },
  ];
};

function createStream(): Stream {
  const queue: string[] = [];
  let resolve: (() => void) | null = null;
  let isClosed = false;

  const stream = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length) {
          yield queue.shift()!;
        } else if (isClosed) {
          break;
        } else {
          await new Promise<void>((r) => (resolve = r));
        }
      }
    },
    write(data: string) {
      queue.push(data);
      resolve?.();
    },
    close() {
      isClosed = true;
      if (resolve) {
        resolve();
      }
    },
  };

  return stream;
}

export type KeyHandler = (e: KeyboardEvent) => void;

class ShellInput {
  editable: HTMLSpanElement;
  cursor: HTMLSpanElement;
  inputElement: HTMLSpanElement;

  parent: HTMLElement;
  prefix: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.inputElement = document.createElement("span");

    this.prefix = document.createElement("span");
    for (let prefixPart of getPrefix())
      this.prefix.appendChild(createTextElement(prefixPart));
    this.inputElement.appendChild(this.prefix);
    this.editable = document.createElement("span");
    this.inputElement.appendChild(this.editable);

    this.cursor = document.createElement("span");
    this.cursor.classList.add("cursor");
    this.cursor.textContent = "█";

    this.inputElement.appendChild(this.cursor);
    parent.appendChild(this.inputElement);
  }

  hide() {
    this.inputElement.style.visibility = "hidden";
  }

  show() {
    // todo какой-то полукостыль
    this.prefix.textContent = "";
    for (let prefixPart of getPrefix())
      this.prefix.appendChild(createTextElement(prefixPart));
    this.inputElement.style.visibility = "visible";
  }
  render(text: string, cursorPosition: number) {
    this.editable.innerHTML = "";

    const before = document.createTextNode(text.slice(0, cursorPosition));
    const after = document.createTextNode(text.slice(cursorPosition));

    this.editable.appendChild(before);
    this.editable.appendChild(this.cursor);
    this.editable.appendChild(after);

    // Скролл вниз
    this.cursor.scrollIntoView(false);
  }
}

// todo preventDefaults
export class Shell {
  inputText: string;
  cursorPos: number;
  history: string[];
  historyCounter: number;
  variables: Record<string, string>;

  input: ShellInput;
  parent: HTMLDivElement;

  fs: Disk;

  terminal: Terminal & TerminalState;

  constructor(
    parent: HTMLDivElement,
    onKey: (callback: KeyHandler) => void,
    fs: Disk
  ) {
    onKey(this.onKey.bind(this));
    this.inputText = "";
    this.cursorPos = 0;
    this.history = [];
    this.historyCounter = -1;
    this.input = new ShellInput(parent);
    this.parent = parent;

    this.variables = {};
    this.fs = fs;

    const print = this.print.bind(this);
    const inputElement = this.input;
    this.terminal = {
      isOpen: false,
      buffer: "",
      onKeyCallback: () => {},
      closedTermialPromise: null,
      resolveСlosedTermialPromise: () => {},

      close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.buffer = "";
        this.onKeyCallback = () => {};
        this.resolveСlosedTermialPromise();
        this.resolveСlosedTermialPromise = () => {};
        parent.textContent = ""; // todo copypaste
        parent.appendChild(inputElement.inputElement);
        inputElement.show.bind(inputElement)();
      },
      getBuffer() {
        return this.buffer;
      },
      write(value: string) {
        print(value);
        this.buffer += value;
      },
      onKey(callback) {
        this.onKeyCallback = callback;
      },
      closed() {
        if (!this.closedTermialPromise) throw new Error("Terminal not binded");
        return this.closedTermialPromise;
      },
      clear() {
        parent.textContent = "";
        parent.appendChild(inputElement.inputElement);
        this.buffer = "";
      },
    } as Terminal & TerminalState;
  }

  bindTerminal() {
    if (this.terminal.isOpen) return;
    this.terminal.clear(); // todo не уверен что всегда нужно
    this.input.hide();
    this.terminal.isOpen = true;
    this.terminal.buffer = "";
    this.terminal.closedTermialPromise = new Promise<void>(
      (res) => (this.terminal.resolveСlosedTermialPromise = res)
    );
    return this.terminal;
  }

  run() {
    const readEnvFile = () => {
      const envFile = this.fs.find(envPath) as FileNode;
      if (!envFile) return [];
      var envs = envFile.content.split("\n");

      return Object.fromEntries(
        envs.map((x) => {
          const kvp = x.split("=").filter((x) => x.trim() !== "");
          return kvp;
        })
      );
    };
    this.variables = readEnvFile();
  }

  getPathCommands() {
    const commands: Record<string, ShellCommand> = {};
    const pathValue = this.variables["PATH"];
    if (!pathValue) return commands;
    const paths = pathValue.split(";").filter((x) => x.trim() !== "");
    console.log(paths);
    for (let path of paths) {
      const dir = this.fs.findDirectory(path);
      for (let node of dir.children) {
        if ("command" in node) commands[node.name] = node.command;
      }
    }

    return commands;
  }

  getHistoryCommand(delta: number) {
    this.historyCounter += delta;
    if (this.historyCounter < -1) this.historyCounter = -1;
    if (this.historyCounter === -1) return "";

    if (this.historyCounter >= this.history.length) {
      this.historyCounter = this.history.length - 1;
    }

    return this.history[this.history.length - this.historyCounter - 1] || "";
  }

  _render() {
    this.input.render(this.inputText, this.cursorPos);
  }

  print(value: string | PrintableText | PrintableText[]) {
    const printPart = (text: PrintableText) => {
      const span = document.createElement("span");
      span.textContent = text.value;
      span.classList.add(text.color || defaultColor);
      this.parent.insertBefore(span, this.input.inputElement);
      this.input.inputElement.scrollIntoView(false);
    };
    if (typeof value === "string") printPart({ value, color: defaultColor });
    else if (Array.isArray(value)) {
      for (let text of value) printPart(text);
    } else printPart(value);
  }

  async onKey(e: KeyboardEvent) {
    if (this.terminal.isOpen) {
      this.terminal.onKeyCallback(e);
      e.preventDefault();
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.inputText =
        this.inputText.slice(0, this.cursorPos) +
        e.key +
        this.inputText.slice(this.cursorPos);
      this.cursorPos++;
    } else if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        this.inputText =
          this.inputText.slice(0, this.cursorPos) +
          text +
          this.inputText.slice(this.cursorPos);
        this.cursorPos += this.inputText.length;
      });
    } else if (e.key === "Backspace") {
      if (this.cursorPos > 0) {
        this.inputText =
          this.inputText.slice(0, this.cursorPos - 1) +
          this.inputText.slice(this.cursorPos);
        this.cursorPos--;
      }
    } else if (e.key === "Delete") {
      if (this.cursorPos < this.inputText.length) {
        this.inputText =
          this.inputText.slice(0, this.cursorPos) +
          this.inputText.slice(this.cursorPos + 1);
      }
    } else if (e.key === "ArrowLeft") {
      if (this.cursorPos > 0) this.cursorPos--;
    } else if (e.key === "ArrowRight") {
      if (this.cursorPos < this.inputText.length) this.cursorPos++;
    } else if (e.key === "ArrowUp") {
      this.inputText = this.getHistoryCommand(+1);
      this.cursorPos = this.inputText.length;
    } else if (e.key === "ArrowDown") {
      this.inputText = this.getHistoryCommand(-1);
      this.cursorPos = this.inputText.length;
    } else if (e.key === "Enter") {
      this.input.hide();

      this.print(getPrefix());
      this.print(this.inputText + "\n");

      this.historyCounter = -1;
      this.history.push(this.inputText);
      const command = this.inputText;
      this.inputText = "";
      this.cursorPos = 0;

      this.execute(command).then(this.input.show.bind(this.input));
    }
    this._render();
  }

  async execute(text: string) {
    if (text === "") return;

    const commands = this.getPathCommands();

    const parsed = shellParse(text);
    const commandsToExecute: CommandToExecute[] = [];
    for (let { args, redirects } of parsed) {
      const commandName = args[0];
      const command = commands[commandName];
      if (!command) {
        this.print(`Command '${commandName}' not found\n`);
        return;
      }

      commandsToExecute.push({
        command,
        args: args.splice(1),
        redirects,
      });
    }

    try {
      await this.runPipeline(commandsToExecute);
    } catch (e: any) {
      if (e instanceof Error) this.print({ color: "red", value: e.message });
      else this.print("Internal problem");
      this.print("\n");
    }
  }

  async runPipeline(commands: CommandToExecute[]) {
    const streams = commands.map(() => createStream());

    const createWriteStream = (
      target: string,
      append: boolean
    ): {
      write: (data: string) => void;
      close: () => void;
    } => {
      const path = target.startsWith("/") ? target : `${CURRENT_DIR}/${target}`;
      let file = this.fs.find(path);
      if (!file) {
        file = this.fs.makeFile(path, "");
      }
      if (!("content" in file)) {
        throw new Error(`${file} is not a file`);
      }

      if (!append) file.content = "";
      return {
        write(data: string) {
          file.content += data;
        },
        close: () => {},
      };
    };

    const processes = commands.map(({ command, args, redirects }, i) => {
      let stdin = i === 0 ? emptyStdin() : streams[i - 1];
      let stdout: WritableStreamLike | Stream = {
        write: (data) => this.print(parseColorText(data)),
      };
      let stderr: WritableStreamLike | Stream = {
        write: (data) => {
          const parsedColors = parseColorText(data);
          if (parsedColors.length === 1)
            this.print({ color: "red", value: data });
          else this.print(parsedColors);
        },
      };

      const stdoutRedirect = redirects.find((r) => r.fd === 1);
      const stderrRedirect = redirects.find((r) => r.fd === 2);

      // Флаг для перенаправления stderr в stdout (например, 2>&1)
      let stderrToStdout = false;

      // Определим stdout
      if (stdoutRedirect) {
        // Пример простой обработки '>' и '>>', без реального файла — нужно заменить под задачу
        stdout = createWriteStream(
          stdoutRedirect.target,
          stdoutRedirect.type === ">>"
        );
      } else if (i < commands.length - 1) {
        // Не последняя команда — stdout в pipe
        stdout = streams[i];
      }

      // Определим stderr
      if (stderrRedirect) {
        if (stderrRedirect.type === ">&" && stderrRedirect.target === "1") {
          // stderr перенаправляем в stdout
          stderrToStdout = true;
        } else {
          stderr = createWriteStream(
            stderrRedirect.target,
            stderrRedirect.type === ">>"
          ); // >> так ли это?
        }
      }

      // Если stderr перенаправлен в stdout
      if (stderrToStdout) {
        stderr = stdout;
      }

      return (async () => {
        const procVariables = {
          ...this.variables,
          PWD: CURRENT_DIR,
        };

        const getPathTo = (path: string) => {
          const parts = path.startsWith("/")
            ? [""]
            : CURRENT_DIR === "/"
            ? [""]
            : CURRENT_DIR.split("/");

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

        const context: ShellContext = {
          color: colorToConvert,
          isStdoutToConsole: !stdoutRedirect && i === commands.length - 1,
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
              else this.print("Path to found\n");
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
          variables: procVariables,
          changeDirectory: (path: string) => changeCurrentDir(path),
        };
        const gen = command(stdin, args, context);
        for await (const event of gen) {
          if (event.type === "stdout") {
            stdout.write(event.data);
          } else {
            stderr.write(event.data);
          }
        }
        if ("close" in stdout) {
          stdout.close();
        }
        if ("close" in stderr) {
          stderr.close();
        }
      })();
    });

    await Promise.all(processes);
    this.terminal.close();
  }
}

export async function* emptyStdin(): AsyncIterable<string> {}

type CommandToExecute = CommandToken & {
  command: ShellCommand;
};

// todo move
export const sysProgramsPath = "/sys/bin";
export const usrProgramsPath = "/usr/bin";
export const envPath = "/sys/etc/env";

export const err = (data: string): StreamEvent => ({
  type: "stderr",
  data: data.endsWith("\n") ? data : data + "\n",
});
export const out = (data: string): StreamEvent => ({
  type: "stdout",
  data: data.endsWith("\n") ? data : data + "\n",
});
export const handleError = (e: any) => {
  console.error(e);
  return err(e instanceof Error ? e.message + "\n" : "Internal error\n");
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type TerminalState = {
  isOpen: boolean;
  buffer: string;
  onKeyCallback: (e: KeyboardEvent) => void;
  closedTermialPromise: Promise<void> | null;
  resolveСlosedTermialPromise: () => void;
};
