import {
  echoCommand,
  grep as grepCommand,
  print,
  PrintableText,
} from "./commands/echo";
import { makeDirectory } from "./disk";

export let CURRENT_DIR = "/users/guest";
export let USERNAME = "guest";
export const DOMAIN = "belyanin.zip";

export const getPrefix = (): PrintableText[] => {
  return [
    {
      value: `${USERNAME}@${DOMAIN}`,
      color: "magenta",
    },
    {
      value: ":",
    },
    {
      value: CURRENT_DIR + " ",
      color: "yellow",
    },
  ];
};

type StreamEvent = {
  type: "stdout" | "stderr";
  data: string;
};
export type CommandOutput = AsyncGenerator<StreamEvent, number, void>;

export type ShellCommand = (
  stdin: AsyncIterable<string>,
  args: string[]
) => CommandOutput;

const commands: Record<string, ShellCommand> = {};

const registerCommand = (name: string, command: ShellCommand) =>
  (commands[name] = command);

registerCommand("echo", echoCommand);
registerCommand("grep", grepCommand);
// registerCommand("type", typeCommand);
// registerCommand("cat", catCommand);
// registerCommand("mkdir", makeDirectoryCommand);
// registerCommand("ls", listDirectoryCommand);
// registerCommand("tree", treeCommand);

function createStream2() {
  let push: (data: string) => void;
  const queue: string[] = [];
  let resolve: (() => void) | null = null;

  const stream = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => (resolve = r));
        }
      }
    },
    push(data: string) {
      queue.push(data);
      resolve?.();
    },
  };

  return stream;
}

function createStream() {
  let push: (data: string) => void;
  const queue: string[] = [];
  let resolve: (() => void) | null = null;

  const stream = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => (resolve = r));
        }
      }
    },
    push(data: string) {
      queue.push(data);
      resolve?.();
    },
    write(data: string) {
      this.push(data);
    },
  };

  return stream;
}

export async function* emptyStdin(): AsyncIterable<string> {
  // ничего не отдаём
}

export async function execute(text: string) {
  // const args = parseArgs(text);
  // if (args.length === 0) return;
  if (text === "") return;

  try {
    const parsed = shellParse(text);
    const commandsToExecute: CommandToExecute[] = [];
    for (let { args, redirects } of parsed) {
      const commandName = args[0];
      const command = commands[commandName];
      if (!command) {
        print(`Command '${commandName}' not found\n`);
        return;
      }

      commandsToExecute.push({
        command,
        args: args.splice(1),
        redirects,
      });

      await runPipeline(commandsToExecute);

      // const result = command(emptyStdin(), args.splice(1));
      // while (true) {
      //   const { done, value } = await result.next();
      //   if (done) {
      //     break;
      //   } else {
      //     if (value.type === "stderr") print({ color: "red", value: value.data });
      //     else print(value.data);
      //   }
      // }
    }
  } catch (e: any) {
    if (e instanceof Error) print(e.message);
    else print("Internal problem");
    print("\n");
  }
}

type CommandToExecute = CommandToken & {
  command: ShellCommand;
};

async function runPipeline(commands: CommandToExecute[]) {
  const streams = commands.map(() => createStream());

  // Вспомогательная функция для создания WritableStreamLike
  // Например, редирект в файл — здесь просто вывод с префиксом (замени под себя)
  function createWriteStream(target: string): {
    write: (data: string) => void;
  } {
    return {
      write(data: string) {
        print(`[Redirect to ${target}]: ${data}`);
      },
    };
  }

  const processes = commands.map(({ command, args, redirects }, i) => {
    // stdin
    let stdin = i === 0 ? emptyStdin() : streams[i - 1];

    // stdout
    let stdout: { write: (data: string) => void };
    // stderr
    let stderr: { write: (data: string) => void } | null = null;

    // Проверяем редиректы stdout
    const stdoutRedirect = redirects.find((r) => r.fd === 1);
    // Проверяем редиректы stderr
    const stderrRedirect = redirects.find((r) => r.fd === 2);

    // Флаг для перенаправления stderr в stdout (например, 2>&1)
    let stderrToStdout = false;

    // Определим stdout
    if (stdoutRedirect) {
      // Пример простой обработки '>' и '>>', без реального файла — нужно заменить под задачу
      stdout = createWriteStream(stdoutRedirect.target);
    } else if (i < commands.length - 1) {
      // Не последняя команда — stdout в pipe
      stdout = streams[i];
    } else {
      // Последняя команда — stdout в print
      stdout = {
        write: (data) => print(data),
      };
    }

    // Определим stderr
    if (stderrRedirect) {
      if (stderrRedirect.type === ">&" && stderrRedirect.target === "1") {
        // stderr перенаправляем в stdout
        stderrToStdout = true;
      } else {
        stderr = createWriteStream(stderrRedirect.target);
      }
    }

    if (!stderr) {
      // Если stderr не назначен явно и не перенаправлен в stdout, выводим красным цветом
      stderr = {
        write: (data) => print({ color: "red", value: data }),
      };
    }

    // Если stderr перенаправлен в stdout
    if (stderrToStdout) {
      stderr = stdout;
    }

    return (async () => {
      const gen = command(stdin, args);
      for await (const event of gen) {
        if (event.type === "stdout") {
          stdout.write(event.data);
        } else {
          stderr.write(event.data);
        }
      }
    })();
  });

  await Promise.all(processes);
}

async function runPipeline3(commands: CommandToExecute[]) {
  let stdIn = emptyStdin();
  for (let command of commands) {
    const x = await command.command(stdIn, command.args);
    createStream();
  }

  const streams = commands.map(() => createStream());

  const processes = commands.map(({ command, args }, i) => {
    const stdin = i === 0 ? emptyStdin() : streams[i - 1];
    const stdout = streams[i];

    return (async () => {
      const gen = command(stdin, args);
      for await (const event of gen) {
        if (event.type === "stdout") {
          if (i < commands.length - 1) {
            stdout.push(event.data);
          } else {
            print(event.data);
          }
        } else {
          print({ color: "red", value: event.data });
        }
      }
    })();
  });

  await Promise.all(processes);
}

async function runPipeline2(commands: CommandToExecute[]) {
  const streams = commands.map(() => createStream());

  const processes = commands.map(({ command, args }, i) => {
    const stdin = i === 0 ? emptyStdin() : streams[i - 1];
    const stdout = streams[i];

    return (async () => {
      const gen = command(stdin, args);
      for await (const event of gen) {
        if (event.type === "stdout") {
          if (i < commands.length - 1) {
            stdout.push(event.data);
          } else {
            print(event.data);
          }
        } else {
          print({ color: "red", value: event.data });
        }
      }
    })();
  });

  await Promise.all(processes);
}

function parseArgs(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "'") {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current !== "") {
        result.push(current);
        current = "";
      }
      // если пробелы подряд — пропускаем
    } else {
      current += char;
    }
  }

  // добавить остаток если был
  if (current !== "") {
    result.push(current);
  }

  return result;
}

makeDirectory(CURRENT_DIR, CURRENT_DIR);

interface RedirectToken {
  fd: number; // дескриптор: 0,1,2 и т.п.
  type: ">" | ">>" | "<" | "<<" | ">&" | "<&";
  target: string; // файл, дескриптор или &1, &2 и т.п.
}

interface CommandToken {
  args: string[]; // аргументы команды, первый — имя команды
  redirects: RedirectToken[]; // перенаправления
}

type Parsed = CommandToken[];

function shellParse(input: string): Parsed {
  const tokens = tokenize(input);
  const commands: CommandToken[] = [];

  let currentCmd: CommandToken = { args: [], redirects: [] };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "|") {
      if (currentCmd.args.length === 0)
        throw new Error("Пустая команда перед |");
      commands.push(currentCmd);
      currentCmd = { args: [], redirects: [] };
      i++;
      continue;
    }

    if (isRedirect(token)) {
      const { fd, type } = parseRedirectToken(token);
      i++;
      if (i >= tokens.length)
        throw new Error("Ожидается цель перенаправления после " + token);
      const target = tokens[i];
      currentCmd.redirects.push({ fd, type, target });
      i++;
      continue;
    }

    currentCmd.args.push(token);
    i++;
  }

  if (currentCmd.args.length > 0 || currentCmd.redirects.length > 0) {
    commands.push(currentCmd);
  }

  return commands;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (i < len) {
    const c = input[i];

    if (inSingleQuote) {
      if (c === "'") {
        inSingleQuote = false;
        i++;
      } else {
        current += c;
        i++;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (c === '"') {
        inDoubleQuote = false;
        i++;
      } else {
        current += c;
        i++;
      }
      continue;
    }

    if (c === "'") {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (c === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    if (/\s/.test(c)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      i++;
      continue;
    }

    if (c === "|" || c === "<" || c === ">") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      // Учтём возможные двойные символы >>, <<, >&, <&
      if ((c === ">" || c === "<") && input[i + 1] === c) {
        tokens.push(c + c);
        i += 2;
      } else if ((c === ">" || c === "<") && input[i + 1] === "&") {
        tokens.push(c + "&");
        i += 2;
      } else {
        tokens.push(c);
        i++;
      }
      continue;
    }

    if (/\d/.test(c) && (input[i + 1] === ">" || input[i + 1] === "<")) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      tokens.push(c + input[i + 1]);
      i += 2;
      continue;
    }

    current += c;
    i++;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isRedirect(token: string): boolean {
  return (
    token === ">" ||
    token === ">>" ||
    token === "<" ||
    token === "<<" ||
    token === ">&" ||
    token === "<&" ||
    /^\d[<>]$/.test(token)
  );
}

function parseRedirectToken(token: string): {
  fd: number;
  type: RedirectToken["type"];
} {
  if (/^\d[<>]$/.test(token)) {
    return { fd: Number(token[0]), type: token[1] as RedirectToken["type"] };
  }
  if (token === ">" || token === ">>") {
    return { fd: 1, type: token };
  }
  if (token === "<" || token === "<<") {
    return { fd: 0, type: token };
  }
  if (token === ">&" || token === "<&") {
    return { fd: 1, type: token };
  }
  throw new Error("Неизвестный тип перенаправления " + token);
}
