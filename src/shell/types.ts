export interface WritableStreamLike {
  write(data: string): void;
}

export interface Stream extends AsyncIterable<string>, WritableStreamLike {
  close(): void;
}
