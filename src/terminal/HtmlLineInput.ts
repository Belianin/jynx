import { LineInput, Terminal } from "./types";
import { removeCsi } from "./utils";

export class HtmlLineInput implements LineInput {
  value: string;
  cursorPos: number;
  terminal: Terminal;

  startPos: { x: number; y: number };

  constructor(termianl: Terminal) {
    this.value = "";
    this.cursorPos = 0;
    this.terminal = termianl;
    this.startPos = termianl.getCursorPosition();
  }

  write(value: string) {
    // todo remove CSI when saving buffer
    if (this.value === "" || this.cursorPos === this.value.length) {
      this.terminal.write(value);
      const cleared = removeCsi(value);
      this.value =
        this.value.substring(0, this.cursorPos) +
        cleared +
        this.value.substring(this.cursorPos);
      this.cursorPos += cleared.length;
    } else {
      this.terminal.write(value);
      const toRewrite = this.value.substring(this.cursorPos);
      this.terminal.write(toRewrite);

      const cleared = removeCsi(value);
      this.value =
        this.value.substring(0, this.cursorPos) + cleared + toRewrite;
      this.cursorPos += cleared.length + toRewrite.length;
      this.moveCursor(-toRewrite.length);
    }
    console.log("$" + this.value + "$");
  }
  remove() {
    if (this.cursorPos === 0) return;
    this.cursorPos -= 1;
    this.terminal.remove();
    this.value =
      this.value.substring(0, this.cursorPos) +
      this.value.substring(this.cursorPos + 1);
    console.log(this.value);
  }
  removeAfterCursorLine() {
    this.terminal.removeAfterCursorLine();
    this.value = this.value.substring(0, this.cursorPos);
    console.log(this.value);
  }
  moveCursor(delta: number) {
    console.log(this.value);
    this.cursorPos += delta;
    if (this.cursorPos > this.value.length) return;
    if (this.cursorPos < 0) this.cursorPos = 0;

    let linX = this.startPos.x + this.startPos.y * this.terminal.width; // todo свойство терминала
    linX += this.cursorPos;

    const x = linX % this.terminal.width;
    const y = Math.floor(linX / this.terminal.width);
    this.terminal.setCursorPosition(x, y);
  }
  moveCursorToStart() {
    console.log(this.value);
    this.terminal.setCursorPosition(this.startPos.x, this.startPos.y);
    this.cursorPos = 0;
  }
  moveCursorToEnd() {
    console.log(this.value);
    this.cursorPos = this.value.length;
    let linX = this.startPos.x + this.startPos.y * this.terminal.width; // todo свойство терминала
    linX += this.cursorPos;

    const x = linX % this.terminal.width;
    const y = Math.floor(linX / this.terminal.width); // todo copy-paster
    this.terminal.setCursorPosition(x, y);
  }
  setCursor(pos: number) {
    console.log(this.value);
    this.cursorPos = pos;
    if (this.cursorPos < 0) this.cursorPos = 0;
    else if (this.cursorPos > this.value.length)
      this.cursorPos = this.value.length;
  }
}
