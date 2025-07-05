export interface Terminal {
  width: number;
  getBuffer: () => string;
  write: (value: string) => void;
  remove: () => void;
  close: () => void;
  onKey: (callback: KeyHandler) => void;
  closed: () => Promise<void>;
  clear: () => void;
  getCursorPosition: () => {
    x: number;
    y: number;
  };
  setCursorPosition: (x: number | undefined, y: number | undefined) => void;
  removeAfterCursorLine: () => void;
}

export interface LineInput {
  value: string;
  cursorPos: number;
  write(value: string): void;
  remove(value: string): void;
  moveCursor(delta: number): void;
  moveCursorToStart(): void;
  moveCursorToEnd(): void;
  setCursor(pos: number): void;
}

export type KeyHandler = (e: KeyboardEvent) => void;
