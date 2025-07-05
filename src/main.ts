import { Jynx } from "./core/Jynx";
import { Core } from "./core/types";
import { createDefaultImage } from "./disk/image";
import { emptyStdin, shell } from "./shell/shell";
import HtmlTerminal from "./terminal/HtmlTerminal";

export const consoleElement = document.getElementById("console")!;

consoleElement.addEventListener("click", () => consoleElement.focus());

const fsImage = createDefaultImage();
const fs = fsImage.createFs();
const jynx: Core = new Jynx(fs, new HtmlTerminal(consoleElement));
jynx.run(emptyStdin(), shell, [], true, {});
