import { consoleElement, inputElement, scrollToBottom } from "../main";
import { defaultColor, PrintableText } from "./echo";

const defaultTimeout = 30;

export async function type(
  value: string | PrintableText | PrintableText[],
  timeout?: number
) {
  timeout = timeout || defaultTimeout;
  if (typeof value === "string")
    await print({ value, color: defaultColor }, timeout);
  else if (Array.isArray(value)) {
    for (let text of value) await print(text, timeout);
  } else await print(value, timeout);
}

const print = (text: PrintableText, timeout: number): Promise<void> => {
  const span = document.createElement("span");
  span.textContent = "";
  span.classList.add(text.color || defaultColor);
  consoleElement.insertBefore(span, inputElement);

  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  let index = 0;
  const printChar = () => {
    if (index >= text.value.length) {
      resolve();
      console.log("resolved");
      return;
    }
    const char = text.value[index];
    index++;

    span.textContent = span.textContent + char;

    scrollToBottom();

    setTimeout(printChar, timeout);
  };

  printChar();
  return promise;
};

export const typeCommand = (args: string[]): void => {
  type(args[0] + "\n", args.length > 1 ? parseInt(args[1]) : undefined);
};
