import { createDefaultImage } from "./disk/image";
import { Core, HtmlTerminal, Jynx, shell } from "./shell/shell";

export const consoleElement = document.getElementById(
  "console"
)! as HTMLDivElement; // todo not only div

let onKey: (e: KeyboardEvent) => void = () => {};
consoleElement.addEventListener("keydown", (e) => {
  e.preventDefault();
  onKey(e);
});

consoleElement.addEventListener("click", () => consoleElement.focus());
const fsImage = createDefaultImage();
const fs = fsImage.createFs();
const jynx: Core = new Jynx(fs, new HtmlTerminal(consoleElement));
jynx.run(shell, [], true, {});
// const shell = new Shell(consoleElement, (callback) => (onKey = callback), fs);
// shell.run();
