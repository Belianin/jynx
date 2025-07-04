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
