import { consoleElement, inputElement, scrollToBottom } from "../main";

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

export const echo = (value: string | PrintableText | PrintableText[]) => {
  if (typeof value === "string") print({ value, color: defaultColor });
  else if (Array.isArray(value)) {
    for (let text of value) print(text);
  } else print(value);
};

const print = (text: PrintableText) => {
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

export const echoCommand = (args: string[]): void => {
  for (let i = 0; i < args.length - 1; i++) {
    echo(args[i]);
    echo(" ");
  }
  echo(args[args.length - 1]);
  echo("\n");
};
