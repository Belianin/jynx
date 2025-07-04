import { createDefaultImage } from "./disk/image";
import { Shell } from "./shell/shell";

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
const disk = fsImage.createFs();
const shell = new Shell(consoleElement, (callback) => (onKey = callback), disk);
shell.run();
