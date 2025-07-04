import { aptCommand, defaultSources, sourcesList } from "../commands/apt";
import { catCommand } from "../commands/cat";
import { changeDirectoryCommand } from "../commands/cd";
import { copyCommand } from "../commands/cp";
import { diskCommand } from "../commands/disk";
import { echoCommand } from "../commands/echo";
import { editCommand } from "../commands/edit";
import { envCommand } from "../commands/env";
import { grepCommand } from "../commands/grep";
import { listDirectoryCommand } from "../commands/ls";
import { makeDirectoryCommand } from "../commands/mkdir";
import { removeFile } from "../commands/rm";
import { treeCommand } from "../commands/tree";
import { disk } from "../disk/disk";
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

type KeyHandler = (e: KeyboardEvent) => void;

class ShellInput {
  editable: HTMLSpanElement;
  cursor: HTMLSpanElement;
  inputElement: HTMLSpanElement;

  parent: HTMLElement;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.inputElement = document.createElement("span");

    const prefix = document.createElement("span");
    for (let prefixPart of getPrefix())
      prefix.appendChild(createTextElement(prefixPart));
    this.inputElement.appendChild(prefix);
    this.editable = document.createElement("span");
    this.inputElement.appendChild(this.editable);

    this.cursor = document.createElement("span");
    this.cursor.classList.add("cursor");
    this.cursor.textContent = "█";

    this.inputElement.appendChild(this.cursor);
    parent.appendChild(this.inputElement);
  }

  hide() {
    this.inputElement.hidden = true;
  }

  show() {
    this.inputElement.hidden = false;
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

  input: ShellInput;
  parent: HTMLDivElement;

  constructor(parent: HTMLDivElement, onKey: (callback: KeyHandler) => void) {
    onKey(this.onKey.bind(this));
    this.inputText = "";
    this.cursorPos = 0;
    this.history = [];
    this.historyCounter = -1;
    this.input = new ShellInput(parent);
    this.parent = parent;
  }

  getHistoryCommand(delta: number) {
    this.historyCounter += delta;
    if (this.historyCounter < -1) this.historyCounter = -1;
    if (this.historyCounter === -1) return "";

    if (this.historyCounter >= history.length) {
      this.historyCounter = history.length - 1;
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

  onKey(e: KeyboardEvent) {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.inputText =
        this.inputText.slice(0, this.cursorPos) +
        e.key +
        this.inputText.slice(this.cursorPos);
      this.cursorPos++;
      this._render();
    } else if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        this.inputText =
          this.inputText.slice(0, this.cursorPos) +
          text +
          this.inputText.slice(this.cursorPos);
        this.cursorPos += this.inputText.length;
        this._render();
      });
    } else if (e.key === "Backspace") {
      if (this.cursorPos > 0) {
        this.inputText =
          this.inputText.slice(0, this.cursorPos - 1) +
          this.inputText.slice(this.cursorPos);
        this.cursorPos--;
        this._render();
      }
      e.preventDefault();
    } else if (e.key === "Delete") {
      if (this.cursorPos < this.inputText.length) {
        this.inputText =
          this.inputText.slice(0, this.cursorPos) +
          this.inputText.slice(this.cursorPos + 1);
        this._render();
      }
    } else if (e.key === "ArrowLeft") {
      if (this.cursorPos > 0) this.cursorPos--;
      this._render();
    } else if (e.key === "ArrowRight") {
      if (this.cursorPos < this.inputText.length) this.cursorPos++;
      this._render();
    } else if (e.key === "ArrowUp") {
      this.inputText = this.getHistoryCommand(+1);
      this.cursorPos = this.inputText.length;
      this._render();
    } else if (e.key === "ArrowDown") {
      this.inputText = this.getHistoryCommand(-1);
      this.cursorPos = this.inputText.length;
      this._render();
    } else if (e.key === "Enter") {
      this.input.hide();

      this.print(getPrefix());
      this.print(this.inputText + "\n");

      execute(this, this.inputText);
      this.historyCounter = -1;
      this.history.push(this.inputText);
      this.inputText = "";
      this.cursorPos = 0;

      // inputElement.parentNode?.removeChild(inputElement);
      this.input.show();
      this._render();
    }
  }
}

export async function* emptyStdin(): AsyncIterable<string> {}

export async function execute(shell: Shell, text: string) {
  if (text === "") return;

  const commands = getPathCommands();

  const parsed = shellParse(text);
  const commandsToExecute: CommandToExecute[] = [];
  for (let { args, redirects } of parsed) {
    const commandName = args[0];
    const command = commands[commandName];
    if (!command) {
      shell.print(`Command '${commandName}' not found\n`);
      return;
    }

    commandsToExecute.push({
      command,
      args: args.splice(1),
      redirects,
    });
  }

  try {
    await runPipeline(shell, commandsToExecute);
  } catch (e: any) {
    if (e instanceof Error) shell.print({ color: "red", value: e.message });
    else shell.print("Internal problem");
    shell.print("\n");
  }
}

type CommandToExecute = CommandToken & {
  command: ShellCommand;
};

let isTerminalOpen = false;
let terminalBuffer = "";
let onKeyCallback: null | ((value: string) => void) = null;
let closedTermialPromise: Promise<void> | null = null;
let resolveСlosedTermialPromise: () => void = () => {};

const terminal: Terminal = {
  close() {
    isTerminalOpen = false;
    terminalBuffer = "";
    onKeyCallback = null;
    resolveСlosedTermialPromise();
    resolveСlosedTermialPromise = () => {};
  },
  getBuffer() {
    return terminalBuffer;
  },
  write(value: string) {
    // shell.print(value);
    terminalBuffer += value;
  },
  onKey(callback) {
    onKeyCallback = callback;
  },
  closed() {
    if (!closedTermialPromise) throw new Error("Terminal not binded");
    return closedTermialPromise;
  },
};

const bindTerminal = () => {
  isTerminalOpen = true;
  terminalBuffer = "";
  closedTermialPromise = new Promise<void>(
    (res) => (resolveСlosedTermialPromise = res)
  );
  return terminal;
};

async function runPipeline(shell: Shell, commands: CommandToExecute[]) {
  console.log(commands);
  const streams = commands.map(() => createStream());

  function createWriteStream(
    target: string,
    append: boolean
  ): {
    write: (data: string) => void;
    close: () => void;
  } {
    const path = target.startsWith("/") ? target : `${CURRENT_DIR}/${target}`;
    let file = disk.find(path);
    if (!file) {
      file = disk.makeFile(path, "");
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
  }

  const processes = commands.map(({ command, args, redirects }, i) => {
    let stdin = i === 0 ? emptyStdin() : streams[i - 1];
    let stdout: WritableStreamLike | Stream = {
      write: (data) => shell.print(parseColorText(data)),
    };
    let stderr: WritableStreamLike | Stream = {
      write: (data) => {
        const parsedColors = parseColorText(data);
        if (parsedColors.length === 1)
          shell.print({ color: "red", value: data });
        else shell.print(parsedColors);
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
        ...variables,
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
          open: (path: string) => disk.find(getPathTo(path)),
          remove: (path: string) => disk.remove(getPathTo(path)),
          createDirectory: (path: string) =>
            disk.makeDirectory(getPathTo(path)),
          createFile: (path: string) => disk.makeFile(getPathTo(path)),
          getPathTo,
          changeWorkingDirectory: (path: string) => {
            path = getPathTo(path);
            const dir = disk.find(path);
            if (dir && (dir.type === "d" || dir.type === "r"))
              changeCurrentDir(path);
            else shell.print("Path to found\n");
          },
        },
        tryBindTerminal: () => {
          if (isTerminalOpen) return;

          return bindTerminal();
        },
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
}

const sysProgramsPath = "/sys/bin";
const usrProgramsPath = "/usr/bin";
export const envPath = "/sys/etc/env";

const commandToRegister: Record<string, ShellCommand> = {
  echo: echoCommand,
  grep: grepCommand,
  cat: catCommand,
  mkdir: makeDirectoryCommand,
  ls: listDirectoryCommand,
  env: envCommand,
  tree: treeCommand,
  cd: changeDirectoryCommand,
  rm: removeFile,
  disk: diskCommand,
  cp: copyCommand,
  apt: aptCommand,
  edit: editCommand,
};
for (let [name, command] of Object.entries(commandToRegister)) {
  disk.makeSysFile(`${sysProgramsPath}/${name}`, command);
}

disk.makeFile(envPath, `PATH=${sysProgramsPath};${usrProgramsPath}`);
disk.makeDirectory(sysProgramsPath);
disk.makeDirectory(usrProgramsPath);
disk.makeDirectory(CURRENT_DIR);
disk.makeFile(sourcesList, defaultSources);

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

// todo при запуске процесса

function readEnvFile() {
  const envFile = disk.find(envPath) as FileNode;
  if (!envFile) return [];
  var envs = envFile.content.split("\n");

  return Object.fromEntries(
    envs.map((x) => {
      const kvp = x.split("=").filter((x) => x.trim() !== "");
      return kvp;
    })
  );
}

const variables: Record<string, string> = readEnvFile();
console.log(variables);

function getPathCommands() {
  const commands: Record<string, ShellCommand> = {};
  const pathValue = variables["PATH"];
  if (!pathValue) return commands;
  const paths = pathValue.split(";").filter((x) => x.trim() !== "");
  console.log(paths);
  for (let path of paths) {
    const dir = disk.findDirectory(path);
    for (let node of dir.children) {
      if ("command" in node) commands[node.name] = node.command;
    }
  }

  return commands;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

console.log(disk);
