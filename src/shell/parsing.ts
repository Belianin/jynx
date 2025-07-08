export interface RedirectToken {
  fd: number; // дескриптор: 0,1,2 и т.п.
  type: ">" | ">>" | "<" | "<<" | ">&" | "<&";
  target: string; // файл, дескриптор или &1, &2 и т.п.
}

export interface CommandToken {
  args: string[]; // аргументы команды, первый — имя команды
  redirects: RedirectToken[]; // перенаправления
}

type Quoted = "single" | "double" | null;

interface RawToken {
  text: string;
  quoted: Quoted;
}

export interface Redirect {
  fd: number;
  type: ">" | ">>" | "<" | "<<" | ">&" | "<&";
  target: string;
}

export interface CommandToken {
  args: string[];
  redirects: Redirect[];
}

export type Parsed = CommandToken[];

export function shellParse(
  input: string,
  env: Record<string, string>,
  funcs: Record<string, (...args: string[]) => string>,
  getFormatter: (
    varName: string
  ) => ((value: string, format: string) => string) | undefined
): Parsed {
  // 1) raw-токены + информация про кавычки
  const raw = tokenize(input);

  // 2) выполняем все подстановки в нужном порядке
  const tokens = raw.map(({ text, quoted }) => {
    if (quoted === "single") {
      // в одинарных — ничего не трогаем
      return text;
    }
    let s = text;

    // 2.1) сначала — командная подстановка $(fn[,arg1,…])
    s = s.replace(/\$\(\s*([^)]+?)\s*\)/g, (_, call: string) => {
      // разбиваем по запятой: fnName, arg1, arg2…
      const [fnName, ...args] = call.split(",").map((x) => x.trim());
      const fn = funcs[fnName];
      if (typeof fn !== "function") {
        throw new Error(`Неизвестная функция $(${fnName})`);
      }
      return fn(...args);
    });

    // 2.2) затем — форматирование ${VAR:fmt} или обычная подстановка ${VAR}
    s = s.replace(/\$\{(\w+)(?::([^}]+))?\}/g, (_, varName, fmt) => {
      const val = env[varName] ?? "";
      if (fmt) {
        const formatter = getFormatter(varName);
        return formatter ? formatter(val, fmt) : val;
      }
      return val;
    });

    // 2.3) и напоследок — простое $VAR
    s = s.replace(/\$(\w+)/g, (_, v) => env[v] ?? "");

    return s;
  });

  // 3) остальная логика — пайпы и редиректы (без изменений)
  const commands: CommandToken[] = [];
  let current: CommandToken = { args: [], redirects: [] };

  for (let i = 0; i < tokens.length; ) {
    const tok = tokens[i];
    if (tok === "|") {
      if (!current.args.length) throw new Error("Пустая команда перед |");
      commands.push(current);
      current = { args: [], redirects: [] };
      i++;
      continue;
    }
    if (isRedirect(tokens[i])) {
      const { fd, type } = parseRedirectToken(tokens[i]);
      i++;
      if (i >= tokens.length)
        throw new Error(`Ожидается цель перенаправления после ${type}`);
      current.redirects.push({ fd, type, target: tokens[i] });
      i++;
      continue;
    }
    current.args.push(tok);
    i++;
  }
  if (current.args.length || current.redirects.length) {
    commands.push(current);
  }
  return commands;
}

function tokenize(input: string): RawToken[] {
  const res: RawToken[] = [];
  let buf = "";
  let ctx: Quoted = null;
  const push = () => {
    if (buf) {
      res.push({ text: buf, quoted: ctx });
      buf = "";
    }
  };

  for (let i = 0; i < input.length; ) {
    const c = input[i];
    if (c === "'" && ctx !== "double") {
      push();
      ctx = ctx === "single" ? null : "single";
      i++;
      continue;
    }
    if (c === '"' && ctx !== "single") {
      push();
      ctx = ctx === "double" ? null : "double";
      i++;
      continue;
    }
    if (!ctx && /\s/.test(c)) {
      push();
      i++;
      continue;
    }
    if (!ctx && (c === "|" || c === "<" || c === ">")) {
      push();
      const nxt = input[i + 1];
      if ((c === ">" || c === "<") && (nxt === c || nxt === "&")) {
        res.push({ text: c + nxt, quoted: null });
        i += 2;
      } else {
        res.push({ text: c, quoted: null });
        i++;
      }
      continue;
    }
    if (!ctx && /\d/.test(c) && /[<>]/.test(input[i + 1])) {
      push();
      res.push({ text: c + input[i + 1], quoted: null });
      i += 2;
      continue;
    }
    buf += c;
    i++;
  }
  push();
  return res;
}

function isRedirect(tok: string): boolean {
  return /^(?:\d[<>]|>>?|<<?|[<>][&])$/.test(tok);
}

function parseRedirectToken(token: string): {
  fd: number;
  type: Redirect["type"];
} {
  if (/^\d[<>]$/.test(token)) {
    return { fd: +token[0], type: token[1] as any };
  }
  switch (token) {
    case ">":
      return { fd: 1, type: ">" };
    case ">>":
      return { fd: 1, type: ">>" };
    case "<":
      return { fd: 0, type: "<" };
    case "<<":
      return { fd: 0, type: "<<" };
    case ">&":
      return { fd: 1, type: ">&" };
    case "<&":
      return { fd: 0, type: "<&" };
    default:
      throw new Error("Неизвестный редирект: " + token);
  }
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
