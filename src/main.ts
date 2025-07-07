import { Jinux } from "./core/Jinux";
import { Core } from "./core/types";
import { createDefaultImage } from "./disk/image";
import { emptyStdin, shell } from "./shell/shell";
import HtmlTerminal from "./terminal/HtmlTerminal";

export const consoleElement = document.getElementById("console")!;

consoleElement.addEventListener("click", () => consoleElement.focus());

const fsImage = createDefaultImage();
const fs = fsImage.createFs();
const jinux: Core = new Jinux(fs, new HtmlTerminal(consoleElement));
jinux.run(emptyStdin(), shell, [], true, {});
