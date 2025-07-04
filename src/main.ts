import { Shell } from "./shell/shell";

export const consoleElement = document.getElementById(
  "console"
)! as HTMLDivElement; // todo not only div

let onKey: (e: KeyboardEvent) => void = () => {};
consoleElement.addEventListener("keydown", (e) => {
  onKey(e);
  e.preventDefault();
});

consoleElement.addEventListener("click", () => consoleElement.focus());
var shell = new Shell(consoleElement, (callback) => (onKey = callback));
