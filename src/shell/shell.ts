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

export type Process = {
  id: number;
  command: ShellCommand;
  workingDirectory: string;
};

export type ProcessContext = {
  fs: Disk;
  variables: Record<string, string>;
  terminal: Terminal;
};

export interface Core {
  processes: Record<number, Process>;
  run: (
    command: ShellCommand,
    args: string[],
    isStdoutToConsole: boolean,
    variables: Record<string, string>
  ) => Process;
}

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
    command: ShellCommand,
    args: string[],
    isStdoutToConsole: boolean,
    variables: Record<string, string>
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
    const iterator = command(emptyStdin(), args, {
      color: colorToConvert,
      isStdoutToConsole,
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

interface LineInput {
  value: string;
  cursorPos: number;
  write(value: string): void;
  remove(value: string): void;
  moveCursor(delta: number): void;
  moveCursorToStart(): void;
  moveCursorToEnd(): void;
  setCursor(pos: number): void;
}

class HtmlLineInput implements LineInput {
  value: string;
  cursorPos: number;
  terminal: Terminal;

  startPos: { x: number; y: number };

  constructor(termianl: Terminal) {
    this.value = "";
    this.cursorPos = 0;
    this.terminal = termianl;
    this.startPos = termianl.getCursorPosition();
  }

  write(value: string) {
    this.terminal.write(value);
    this.value += value;
    this.cursorPos += value.length;
    console.log(this.value);
  }
  remove() {
    if (this.cursorPos === 0) return;
    this.cursorPos -= 1;
    this.terminal.remove();
    this.value =
      this.value.substring(0, this.cursorPos) +
      this.value.substring(this.cursorPos + 1);
    console.log(this.value);
  }
  removeAfterCursorLine() {
    this.terminal.removeAfterCursorLine();
    this.value = this.value.substring(0, this.cursorPos);
    console.log(this.value);
  }
  moveCursor(delta: number) {
    console.log(this.value);
    this.cursorPos += delta;
    if (this.cursorPos < 0) this.cursorPos = 0;

    let linX = this.startPos.x + this.startPos.y * this.terminal.width; // todo свойство терминала
    linX += this.cursorPos;

    const x = linX % this.terminal.width;
    const y = Math.floor(linX / this.terminal.width);
    this.terminal.setCursorPosition(x, y);
  }
  moveCursorToStart() {
    console.log(this.value);
    this.terminal.setCursorPosition(this.startPos.x, this.startPos.y);
    this.cursorPos = 0;
  }
  moveCursorToEnd() {
    console.log(this.value);
    this.cursorPos = this.value.length;
    let linX = this.startPos.x + this.startPos.y * this.terminal.width; // todo свойство терминала
    linX += this.cursorPos;

    const x = linX % this.terminal.width;
    const y = Math.floor(linX / this.terminal.width); // todo copy-paster
    this.terminal.setCursorPosition(x, y);
  }
  setCursor(pos: number) {
    console.log(this.value);
    this.cursorPos = pos;
    if (this.cursorPos < 0) this.cursorPos = 0;
    else if (this.cursorPos > this.value.length)
      this.cursorPos = this.value.length;
  }
}

export const shell: ShellCommand = async function* (
  stdin,
  args,
  { tryBindTerminal, fs }
) {
  const isBinded = tryBindTerminal();
  if (!isBinded) throw new Error("Faield to bind terminal");
  const terimal = isBinded;

  const readEnvFile = () => {
    const envFile = fs.open(envPath);
    if (!envFile || envFile.type !== "-") return [];
    var envs = envFile.content.split("\n");

    const res: any = Object.fromEntries(
      envs.map((x) => {
        const kvp = x.split("=").filter((x) => x.trim() !== "");
        return kvp;
      })
    );

    return res;
  };
  const variables: Record<string, string> = readEnvFile();

  const getPathCommands = () => {
    const commands: Record<string, ShellCommand> = {};
    const pathValue = variables["PATH"];
    if (!pathValue) return commands;
    const paths = pathValue.split(";").filter((x) => x.trim() !== "");
    console.log(paths);
    for (let path of paths) {
      const dir = fs.open(path);
      if (!dir || dir.type !== "d") continue;
      for (let node of dir.children) {
        if ("command" in node) commands[node.name] = node.command;
      }
    }

    return commands;
  };

  const execute = async (text: string) => {
    if (text === "") return;

    const commands = getPathCommands();

    const parsed = shellParse(text);
    const commandsToExecute: CommandToExecute[] = [];
    for (let { args, redirects } of parsed) {
      const commandName = args[0];
      const command = commands[commandName];
      if (!command) {
        terimal.write(`Command '${commandName}' not found\n`);
        return;
      }

      commandsToExecute.push({
        command,
        args: args.splice(1),
        redirects,
      });
    }

    try {
      await runPipeline(commandsToExecute);
    } catch (e: any) {
      if (e instanceof Error) terimal.write(e.message + "\n");
      else terimal.write("Internal problem\n");
      // if (e instanceof Error) this.print({ color: "red", value: e.message });
      // else this.print("Internal problem");
      // this.print("\n");
    }
  };

  const runPipeline = async (commands: CommandToExecute[]) => {
    const streams = commands.map(() => createStream());

    const createWriteStream = (
      target: string,
      append: boolean
    ): {
      write: (data: string) => void;
      close: () => void;
    } => {
      const path = target.startsWith("/") ? target : `${CURRENT_DIR}/${target}`;
      let file = fs.open(path);
      if (!file) {
        file = fs.createFile(path);
      }
      if (!file || file.type !== "-") {
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
        write: (data) => terimal.write(data), // todo terimal.write(parseColorText(data)),
      };
      let stderr: WritableStreamLike | Stream = {
        write: (data) => {
          terimal.write(data);
          // const parsedColors = parseColorText(data);
          // if (parsedColors.length === 1)
          //   terimal.write(data);//this.print({ color: "red", value: data });
          // else terimal.write(parsedColors);
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
          fs,
          tryBindTerminal,
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
  };

  const history: string[] = [];
  let historyCounter: number = 0;

  const prefix = "guest@localhost:/home/guest ";

  terimal.write(prefix);

  function getHistoryCommand(delta: number) {
    historyCounter += delta;
    if (historyCounter < -1) historyCounter = -1;
    if (historyCounter === -1) return "";

    if (historyCounter >= history.length) {
      historyCounter = history.length - 1;
    }

    return history[history.length - historyCounter - 1] || "";
  }

  let input = new HtmlLineInput(terimal);

  const writeHistoryCommand = (delta: number) => {
    const command = getHistoryCommand(delta); // todo closure?
    input.moveCursorToStart();
    input.removeAfterCursorLine();
    input.write(command);
  };

  function onKey(e: KeyboardEvent) {
    // if (this.terminal.isOpen) {
    //   this.terminal.onKeyCallback(e);
    //   e.preventDefault();
    //   return;
    // }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      input.write(e.key);
      // this.inputText =
      //   this.inputText.slice(0, this.cursorPos) +
      //   e.key +
      //   this.inputText.slice(this.cursorPos);
      // this.cursorPos++;
    } else if (e.ctrlKey && e.key === "v") {
      navigator.clipboard.readText().then((text) => input.write(text));
    } else if (e.key === "Backspace") {
      input.remove();
    } else if (e.key === "Delete") {
      input.remove(); // удаляется не то
    } else if (e.key === "ArrowLeft") {
      input.moveCursor(-1);
    } else if (e.key === "ArrowRight") {
      input.moveCursor(1);
    } else if (e.key === "ArrowUp") {
      writeHistoryCommand(1);
    } else if (e.key === "ArrowDown") {
      writeHistoryCommand(-1);
    } else if (e.key === "Enter") {
      const result = input.value;
      input.moveCursorToEnd();
      if (result !== "") {
        terimal.write("\n");
        history.push(result);
        execute(result).then((x) => {
          terimal.write(prefix);
          input = new HtmlLineInput(terimal); // todo перенести в аргументы
        });
      } else {
        terimal.write(`\n${prefix}`);
        input = new HtmlLineInput(terimal); // todo перенести в аргументы
      }
    }
  }

  terimal.onKey(onKey);

  await terimal.closed();

  return 0;
};

export class HtmlTerminal implements Terminal {
  isOpen: boolean;
  buffer: string;
  closedTermialPromise: Promise<void> | null;
  resolveСlosedTermialPromise: () => void;
  onKeyCallback: KeyHandler;

  parent: HTMLElement;
  cursorPos: { x: number; y: number };
  linPos: number;
  // inputElement: ShellInput;

  cursor: HTMLSpanElement;
  prev: Text;
  next: Text;

  width: number; // todo real

  constructor(parent: HTMLElement) {
    this.isOpen = false;
    this.buffer = "";
    this.onKeyCallback = () => {};
    this.closedTermialPromise = null;
    this.resolveСlosedTermialPromise = () => {};
    this.parent = parent;
    // this.inputElement = new ShellInput(parent);
    this.cursorPos = { x: 0, y: 0 };

    this.cursor = document.createElement("span");
    this.cursor.classList.add("cursor");
    this.cursor.textContent = "█";
    this.prev = document.createTextNode("");
    this.next = document.createTextNode("");
    parent.appendChild(this.prev);
    parent.appendChild(this.cursor);
    parent.appendChild(this.next);

    parent.addEventListener("keydown", (e) => {
      e.preventDefault();
      this.onKeyCallback(e); // todo а не сломается ли
    });

    this.width = 400;
    this.linPos = 0;
  }

  remove() {
    if (this.prev.textContent.length > 0) {
      this.prev.textContent = this.prev.textContent.substring(
        0,
        this.prev.textContent.length - 1
      );

      this.linPos = this.linPos - 1; // todo копипаста
      this.cursorPos.x = this.linPos % this.width;
      this.cursorPos.y = Math.floor(this.linPos / this.width);
    }
  }
  removeAfterCursorLine() {
    const newLine = this.next.textContent.indexOf("\n");
    if (newLine !== -1) {
      this.next.textContent = this.next.textContent.substring(0, newLine);
    } else {
      this.next.textContent = "";
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.buffer = "";
    this.onKeyCallback = () => {};
    this.resolveСlosedTermialPromise();
    this.resolveСlosedTermialPromise = () => {};
  }
  getBuffer() {
    return this.buffer;
  }
  write(value: string) {
    // const newContent = this.parent.childNodes[0];
    // newContent.textContent = newContent.textContent + value;

    this.linPos += value.length; // todo копипаста
    this.cursorPos.x = this.linPos % this.width;
    this.cursorPos.y = Math.floor(this.linPos / this.width);

    this.prev.textContent = this.prev.textContent + value;

    // const frag = document.createDocumentFragment();
    // const newContent = this.parent.childNodes[0];
    // newContent.textContent = newContent.textContent + value;

    // frag.appendChild(newContent);
    // frag.appendChild(this.cursor);
    // frag.appendChild(this.parent.childNodes[2]);

    // this.parent.textContent = "";
    // this.parent.appendChild(frag);

    // this.cursor.insertBefore(this.parent, document.createTextNode("value")); // todo insertBefore?
    // this.parent.textContent += value; // todo
    this.buffer += value;
  }
  onKey(callback: KeyHandler) {
    this.onKeyCallback = callback;
  }
  closed() {
    if (!this.closedTermialPromise) throw new Error("Terminal not binded");
    return this.closedTermialPromise;
  }
  clear() {
    this.prev.textContent = "";
    this.next.textContent = "";
    this.linPos = 0;
    this.cursorPos = { x: 0, y: 0 };
    this.buffer = "";
  }
  setCursorPosition(x: number | undefined, y: number | undefined) {
    this.cursorPos = {
      x: x === undefined ? this.cursorPos.x : x,
      y: y === undefined ? this.cursorPos.y : y,
    };
    this.linPos = this.cursorPos.x + this.cursorPos.y * this.width;

    const prevText = this.prev.textContent;
    if (prevText.length > this.linPos) {
      this.prev.textContent = prevText.substring(0, this.linPos);
      this.next.textContent =
        prevText.substring(this.linPos) + this.next.textContent;
    } else {
      const nextText = this.next.textContent;
      const index = this.linPos - prevText.length;
      this.prev.textContent = prevText + nextText.substring(0, index);
      this.next.textContent = nextText.substring(index);
    }
  }
  getCursorPosition() {
    return { ...this.cursorPos };
  }
}

type TerminalState = {
  isOpen: boolean;
  buffer: string;
  onKeyCallback: (e: KeyboardEvent) => void;
  closedTermialPromise: Promise<void> | null;
  resolveСlosedTermialPromise: () => void;
};

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
      width: 0,
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
      remove() {},
      removeAfterCursorLine() {},
      setCursorPosition() {},
      getCursorPosition() {
        return { x: 0, y: 0 };
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
