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
  // prev: HTMLElement;
  // next: HTMLElement;
  // prev: Text;
  // next: Text;

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
    // this.prev = document.createTextNode("");
    // const prev = document.createTextNode("");
    // this.prev = document.createElement("span");
    // this.prev.classList.add("rendered-text");
    // this.prev.textContent = "    f\nfd     f";
    // this.next = document.createTextNode("");
    // this.next = document.createElement("span");
    // this.next.classList.add("rendered-text");
    // parent.appendChild(this.prev);
    // this.prev.appendChild(document.createTextNode(""));
    parent.appendChild(this.cursor);
    // parent.appendChild(this.next);
    // this.next.appendChild(document.createTextNode(""));

    parent.style.whiteSpace = "pre"; // todo нужно ли?

    parent.addEventListener("keydown", (e) => {
      e.preventDefault();
      this.onKeyCallback(e); // todo а не сломается ли
    });

    this.width = 400;
    this.linPos = 0;
  }

  remove() {
    let prev = this.cursor.previousSibling;
    if (!prev) return;

    while (prev!.textContent?.length === 0) {
      prev = prev!.previousSibling;
      prev!.remove();
      if (prev === null) return;
    }

    prev.textContent = prev.textContent!.substring(
      0,
      prev.textContent!.length - 1
    );
    if (prev.textContent === "") prev.remove();

    this.linPos = this.linPos - 1; // todo копипаста
    this.cursorPos.x = this.linPos % this.width;
    this.cursorPos.y = Math.floor(this.linPos / this.width);
  }
  removeAfterCursorLine() {
    let next = this.cursor.nextSibling;
    while (next) {
      if (!next.textContent) {
        next.remove();
        next = next.nextSibling; // todo store before remove?
      } else {
        const newLine = next.textContent.indexOf("\n");
        if (newLine !== -1) {
          next.textContent = next.textContent.substring(0, newLine);
          return;
        } else {
          next.remove();
          next = next.nextSibling;
        }
      }
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
    let prev = this.cursor.previousSibling;
    if (!prev) {
      prev = document.createTextNode("");
      this.parent.insertBefore(prev, this.cursor); // todo цвет
    }
    prev.textContent = prev.textContent + value;

    // Inserting
    let lengthLeft = value.length;
    let next = this.cursor.nextSibling;
    while (next && lengthLeft > 0) {
      const nextText = next.textContent || "";
      const lengthToCut = Math.min(nextText.length, lengthLeft);
      const newNextText = nextText.substring(lengthToCut);
      next.textContent = newNextText;
      lengthLeft -= lengthToCut;
      if (newNextText.length === 0) next.remove();
      next = next.nextSibling;
    }

    this.linPos += value.length; // todo копипаста
    this.cursorPos.x = this.linPos % this.width;
    this.cursorPos.y = Math.floor(this.linPos / this.width);
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
    this.parent.textContent = "";
    this.parent.appendChild(this.cursor);
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

    const prevAfterCursor = this.cursor.previousSibling;
    const nextAfterCursor = this.cursor.nextSibling;

    this.cursor.remove();
    if (
      prevAfterCursor &&
      nextAfterCursor &&
      prevAfterCursor.nodeType === Node.TEXT_NODE &&
      nextAfterCursor.nodeType === Node.TEXT_NODE
    ) {
      prevAfterCursor.textContent =
        (prevAfterCursor.textContent || "") +
        (nextAfterCursor.textContent || "");
      nextAfterCursor.remove();
    }

    // todo считать от курсора?
    let spanStartIndex = 0;
    for (let span of this.parent.childNodes) {
      const text = span.textContent || "";
      if (spanStartIndex + text.length >= this.linPos) {
        const preText = text.substring(0, this.linPos - spanStartIndex);
        const nextText = text.substring(this.linPos - spanStartIndex);
        if (span.nodeType === Node.TEXT_NODE) {
          if (preText !== "")
            this.parent.insertBefore(document.createTextNode(preText), span);
          this.parent.insertBefore(this.cursor, span);
          if (nextText !== "")
            this.parent.insertBefore(document.createTextNode(nextText), span);
          span.remove();
        } else {
          span.textContent = "";
          if (preText !== "")
            span.appendChild(
              document.createTextNode(
                text.substring(0, this.linPos - spanStartIndex)
              )
            );
          span.appendChild(this.cursor);
          if (nextText !== "")
            span.appendChild(
              document.createTextNode(
                text.substring(this.linPos - spanStartIndex)
              )
            );
        }
        return;
      }
      spanStartIndex += text.length;
    }
  }
  getCursorPosition() {
    return { ...this.cursorPos };
  }
}
