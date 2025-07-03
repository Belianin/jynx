import { consoleElement, inputElement, scrollToBottom } from "../main";
import { ShellCommand } from "../shell";

export const colors = [
  "black",
  "white",
  "red",
  "green",
  "cyan",
  "magenta",
  "yellow",
  "blue",
  "gray",
] as const;
export type Color = (typeof colors)[number];
export const defaultColor: Color = "white";

export type PrintableText = {
  value: string;
  color?: Color;
};

export const print = (value: string | PrintableText | PrintableText[]) => {
  if (typeof value === "string") printPart({ value, color: defaultColor });
  else if (Array.isArray(value)) {
    for (let text of value) printPart(text);
  } else printPart(value);
};

const printPart = (text: PrintableText) => {
  const span = document.createElement("span");
  span.textContent = text.value;
  span.classList.add(text.color || defaultColor);
  consoleElement.insertBefore(span, inputElement);
  scrollToBottom();
};

export const createTextElement = (text: PrintableText) => {
  const span = document.createElement("span");
  span.textContent = text.value;
  span.classList.add(text.color || defaultColor);
  return span;
};

export const echoCommand: ShellCommand = async function* echoCommand(
  stdin,
  args
) {
  yield { type: "stdout", data: args?.join(" ") + "\n" };
  return 0;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const grep: ShellCommand = async function* (stdin, args) {
  const pattern = args.length > 0 ? args[0] : "";
  let buffer = "";

  for await (const chunk of stdin) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index);
      if (line.includes(pattern)) {
        yield { type: "stdout", data: line + "\n" };
      }
      buffer = buffer.slice(index + 1);
    }
  }

  // обработка оставшегося буфера при EOF
  if (buffer && buffer.includes(pattern)) {
    yield { type: "stdout", data: buffer + "\n" };
  }

  return 0;
};
