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
