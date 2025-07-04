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
import { CURRENT_DIR, DOMAIN, USERNAME } from "./env";
import { CommandToken, shellParse } from "./parsing";
import { PrintableText, print } from "./print";
import { ShellCommand, Stream, StreamEvent, WritableStreamLike } from "./types";

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
      value: (CURRENT_DIR === "" ? "/" : CURRENT_DIR) + " ",
      color: "yellow",
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

function getPathCommands() {
  const commands: Record<string, ShellCommand> = {};
  for (let path of getEnvPaths()) {
    const dir = disk.findDirectory(path);
    for (let node of dir.children) {
      if ("command" in node) commands[node.name] = node.command;
    }
  }

  return commands;
}

function getEnvPaths() {
  const envFile = disk.find(envPath) as FileNode;
  if (!envFile) return [];
  var envs = envFile.content.split("\n");

  for (let envRecord of envs) {
    if (envRecord.startsWith("PATH=")) {
      return envRecord
        .substring(5)
        .split(";")
        .filter((x) => x.trim() !== "");
    }
  }

  throw new Error("Failed to load PATH");
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

    return {
      write(data: string) {
        if (append) file.content += data;
        else file.content = data;
      },
      close: () => {},
    };
  }

  const processes = commands.map(({ command, args, redirects }, i) => {
    let stdin = i === 0 ? emptyStdin() : streams[i - 1];
    let stdout: WritableStreamLike | Stream;
    let stderr: WritableStreamLike | Stream | null = null;

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
        stderr = createWriteStream(
          stderrRedirect.target,
          stderrRedirect.type === ">>"
        ); // >> так ли это?
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
};
for (let [name, command] of Object.entries(commandToRegister)) {
  disk.makeSysFile(`${sysProgramsPath}/${name}`, command);
}

disk.makeFile(envPath, `PATH=${sysProgramsPath};${usrProgramsPath}`);
disk.makeDirectory(sysProgramsPath);
disk.makeDirectory(usrProgramsPath);
disk.makeDirectory(CURRENT_DIR);

export const err = (data: string): StreamEvent => ({
  type: "stderr",
  data: data.endsWith("\n") ? data : data + "\n",
});
export const out = (data: string): StreamEvent => ({
  type: "stdout",
  data: data.endsWith("\n") ? data : data + "\n",
});
export const handleError = (e: any) => {
  return err(e instanceof Error ? e.message + "\n" : "Internal error\n");
};
