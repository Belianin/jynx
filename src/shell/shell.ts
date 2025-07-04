import { aptCommand, defaultSources, sourcesList } from "../commands/apt";
import { catCommand } from "../commands/cat";
import { changeDirectoryCommand } from "../commands/cd";
import { copyCommand } from "../commands/cp";
import { diskCommand } from "../commands/disk";
import { echoCommand } from "../commands/echo";
import { envCommand } from "../commands/env";
import { grepCommand } from "../commands/grep";
import { listDirectoryCommand } from "../commands/ls";
import { makeDirectoryCommand } from "../commands/mkdir";
import { removeFile } from "../commands/rm";
import { treeCommand } from "../commands/tree";
import { typeCommand } from "../commands/type";
import { disk } from "../disk/disk";
import { FileNode } from "../disk/types";
import { changeCurrentDir, CURRENT_DIR, DOMAIN, USERNAME } from "./env";
import { CommandToken, parseArgs, shellParse } from "./parsing";
import { colorToConvert, parseColorText, print, PrintableText } from "./print";
import {
  ShellCommand,
  ShellContext,
  Stream,
  StreamEvent,
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

export async function* emptyStdin(): AsyncIterable<string> {}

export async function execute(text: string) {
  if (text === "") return;

  const commands = getPathCommands();

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
  }

  try {
    await runPipeline(commandsToExecute);
  } catch (e: any) {
    if (e instanceof Error) print({ color: "red", value: e.message });
    else print("Internal problem");
    print("\n");
  }
}

type CommandToExecute = CommandToken & {
  command: ShellCommand;
};

async function runPipeline(commands: CommandToExecute[]) {
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
      write: (data) => print(parseColorText(data)),
    };
    let stderr: WritableStreamLike | Stream = {
      write: (data) => {
        const parsedColors = parseColorText(data);
        if (parsedColors.length === 1) print({ color: "red", value: data });
        else print(parsedColors);
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
            else print("Path to found\n");
          },
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
  type: typeCommand,
  rm: removeFile,
  disk: diskCommand,
  cp: copyCommand,
  apt: aptCommand,
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
