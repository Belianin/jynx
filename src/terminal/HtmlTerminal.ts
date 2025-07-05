import { KeyHandler, Terminal } from "./types";

export default class HtmlTerminal implements Terminal {
  isOpen: boolean;
  buffer: string;
  closedTermialPromise: Promise<void> | null;
  resolveСlosedTermialPromise: () => void;
  onKeyCallback: KeyHandler;

  parent: HTMLElement;
  cursorPos: { x: number; y: number };
  linPos: number;
  // inputElement: ShellInput;

  cursor: HTMLSpanElement;
  // prev: HTMLPreElement;
  // next: HTMLPreElement;
  prev: Text;
  next: Text;

  width: number; // todo real

  constructor(parent: HTMLElement) {
    this.isOpen = false;
    this.buffer = "";
    this.onKeyCallback = () => {};
    this.closedTermialPromise = null;
    this.resolveСlosedTermialPromise = () => {};
    this.parent = parent;
    // this.inputElement = new ShellInput(parent);
    this.cursorPos = { x: 0, y: 0 };

    this.cursor = document.createElement("span");
    this.cursor.classList.add("cursor");
    this.cursor.textContent = "█";
    this.prev = document.createTextNode("");
    // this.prev = document.createElement("pre");
    // // this.prev.classList.add("rendered-text");
    // this.prev.textContent = "    f\nfd     f";
    this.next = document.createTextNode("");
    // this.next = document.createElement("pre");
    // this.next.classList.add("rendered-text");
    parent.appendChild(this.prev);
    parent.appendChild(this.cursor);
    parent.appendChild(this.next);

    parent.style.whiteSpace = "pre"; // todo нужно ли?

    parent.addEventListener("keydown", (e) => {
      e.preventDefault();
      this.onKeyCallback(e); // todo а не сломается ли
    });

    this.width = 400;
    this.linPos = 0;
  }

  remove() {
    if (this.prev.textContent.length > 0) {
      this.prev.textContent = this.prev.textContent.substring(
        0,
        this.prev.textContent.length - 1
      );

      this.linPos = this.linPos - 1; // todo копипаста
      this.cursorPos.x = this.linPos % this.width;
      this.cursorPos.y = Math.floor(this.linPos / this.width);
    }
  }
  removeAfterCursorLine() {
    const newLine = this.next.textContent.indexOf("\n");
    if (newLine !== -1) {
      this.next.textContent = this.next.textContent.substring(0, newLine);
    } else {
      this.next.textContent = "";
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.buffer = "";
    this.onKeyCallback = () => {};
    this.resolveСlosedTermialPromise();
    this.resolveСlosedTermialPromise = () => {};
  }
  getBuffer() {
    return this.buffer;
  }
  write(value: string) {
    // const newContent = this.parent.childNodes[0];
    // newContent.textContent = newContent.textContent + value;

    this.linPos += value.length; // todo копипаста
    this.cursorPos.x = this.linPos % this.width;
    this.cursorPos.y = Math.floor(this.linPos / this.width);

    this.prev.textContent = this.prev.textContent + value;

    // const frag = document.createDocumentFragment();
    // const newContent = this.parent.childNodes[0];
    // newContent.textContent = newContent.textContent + value;

    // frag.appendChild(newContent);
    // frag.appendChild(this.cursor);
    // frag.appendChild(this.parent.childNodes[2]);

    // this.parent.textContent = "";
    // this.parent.appendChild(frag);

    // this.cursor.insertBefore(this.parent, document.createTextNode("value")); // todo insertBefore?
    // this.parent.textContent += value; // todo
    this.buffer += value;
  }
  onKey(callback: KeyHandler) {
    this.onKeyCallback = callback;
  }
  closed() {
    if (!this.closedTermialPromise) throw new Error("Terminal not binded");
    return this.closedTermialPromise;
  }
  clear() {
    this.prev.textContent = "";
    this.next.textContent = "";
    this.linPos = 0;
    this.cursorPos = { x: 0, y: 0 };
    this.buffer = "";
  }
  setCursorPosition(x: number | undefined, y: number | undefined) {
    this.cursorPos = {
      x: x === undefined ? this.cursorPos.x : x,
      y: y === undefined ? this.cursorPos.y : y,
    };
    this.linPos = this.cursorPos.x + this.cursorPos.y * this.width;

    const prevText = this.prev.textContent;
    if (prevText.length > this.linPos) {
      this.prev.textContent = prevText.substring(0, this.linPos);
      this.next.textContent =
        prevText.substring(this.linPos) + this.next.textContent;
    } else {
      const nextText = this.next.textContent;
      const index = this.linPos - prevText.length;
      this.prev.textContent = prevText + nextText.substring(0, index);
      this.next.textContent = nextText.substring(index);
    }
  }
  getCursorPosition() {
    return { ...this.cursorPos };
  }
}
