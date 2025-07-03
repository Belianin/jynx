import {
  listDirectoryCommand,
  makeDirectory,
  makeDirectoryCommand,
  treeCommand,
} from "../disk";
import { catCommand } from "./cat";
import { echoCommand, print, PrintableText } from "./echo";
import { typeCommand } from "./type";

export let CURRENT_DIR = "/users/guest";
export let USERNAME = "guest";
export const DOMAIN = "belyanin.zip";

export const getPrefix = (): PrintableText[] => {
  return [
    {
      value: `${USERNAME}@${DOMAIN}`,
      color: "yellow",
    },
    {
      value: ":",
    },
    {
      value: CURRENT_DIR + " ",
      color: "magenta",
    },
  ];
};

export type CommandFunc = (args: string[]) => string | Promise<string>;

const commands: Record<string, CommandFunc> = {};

const registerCommand = (name: string, command: CommandFunc) =>
  (commands[name] = command);

registerCommand("echo", echoCommand);
registerCommand("type", typeCommand);
registerCommand("cat", catCommand);
registerCommand("mkdir", makeDirectoryCommand);
registerCommand("ls", listDirectoryCommand);
registerCommand("tree", treeCommand);

export async function execute(text: string) {
  console.log(Object.keys(commands));
  const args = parseArgs(text);
  if (args.length === 0) return;

  const commandName = args[0];
  //   const command = await getCommand(commandName);
  const command = commands[commandName];
  if (!!command) {
    try {
      const result = command(args.splice(1));
      if (result instanceof Promise) {
        const asyncResult = await result;
        print(asyncResult);
      } else {
        print(result);
      }
      if (result !== "") print("\n");
    } catch (e: any) {
      if (e instanceof Error) print(e.message);
      else print("Internal problem");
      print("\n");
    }
  } else print(`Command '${commandName}' not found\n`);
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
