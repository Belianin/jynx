export interface RedirectToken {
  fd: number; // дескриптор: 0,1,2 и т.п.
  type: ">" | ">>" | "<" | "<<" | ">&" | "<&";
  target: string; // файл, дескриптор или &1, &2 и т.п.
}

export interface CommandToken {
  args: string[]; // аргументы команды, первый — имя команды
  redirects: RedirectToken[]; // перенаправления
}

export type Parsed = CommandToken[];

export function shellParse(input: string): Parsed {
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

export type ParsedArgs = {
  flags: Record<string, string | boolean>;
  positional: string[];
};

export function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let parsingFlags = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (parsingFlags) {
      if (arg === "--") {
        parsingFlags = false;
        continue;
      }

      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");
        if (!/^[a-zA-Z0-9\-]+$/.test(key)) {
          throw new Error(`Недопустимое имя флага: --${key}`);
        }

        if (value !== undefined) {
          flags[key] = value;
        } else {
          const nextArg = args[i + 1];
          if (nextArg !== undefined && !nextArg.startsWith("-")) {
            flags[key] = nextArg;
            i++;
          } else {
            flags[key] = true;
          }
        }
      } else if (arg.startsWith("-") && arg.length > 1) {
        const chars = arg.slice(1).split("");
        for (let j = 0; j < chars.length; j++) {
          const c = chars[j];
          if (!/^[a-zA-Z]$/.test(c)) {
            throw new Error(`Недопустимый короткий флаг: -${c}`);
          }

          // todo
          // если это последний символ и после него есть аргумент без дефиса
          // if (j === chars.length - 1) {
          //   const nextArg = args[i + 1];
          //   if (nextArg !== undefined && !nextArg.startsWith("-")) {
          //     flags[c] = nextArg;
          //     i++;
          //     break;
          //   } else {
          //     flags[c] = true;
          //   }
          // } else {
          //   flags[c] = true;
          // }
          flags[c] = true;
        }
      } else {
        positional.push(arg);
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}
