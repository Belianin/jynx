import { Color } from "../shell/print";

export type TextToken = string;
export type CsiToken = number[];

export type Token = TextToken | CsiToken;

const regex = /\x1b\[([0-9;]*)m/g;

export const removeCsi = (text: string) => text.replace(regex, "");

export const parseText = (text: string): Token[] => {
  if (text === "") return [];
  let result: Token[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const params = match[1]
      .split(";")
      .filter((p) => p.length > 0)
      .map((p) => Number(p));

    if (params.length === 0) {
      params.push(0);
    }

    result.push(params);

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  //   if (result.length === 0) {
  //     result.push('');
  //   }

  return result;
};

export type StlyeState = {
  bold?: boolean;
  curly?: boolean;
  underline?: boolean;
  color?: Color;
  backgroundColor?: Color;
};

const colorMap: Record<string, Color> = {
  "30": "black",
  "31": "red",
  "32": "green",
  "33": "yellow",
  "34": "blue",
  "35": "magenta",
  "36": "cyan",
  "37": "white",
} as const;

export const applyStyleCommand = (
  state: StlyeState,
  token: CsiToken
): StlyeState => {
  const result = {
    ...state,
  };
  for (let p of token) {
    if (p === 0) return {};
    else if (p === 1) result.bold = true;
    else if (p === 3) result.curly = true;
    else if (p === 4) result.underline = true;
    else if (p >= 30 && p <= 37) result.color = colorMap[p];
    else if (p == 39) result.color = undefined;
    else if (p >= 40 && p <= 47) result.backgroundColor = colorMap[p];
    else if (p == 49) result.backgroundColor = undefined;
  }

  return result;
};

export function getStyleClasses(state: StlyeState) {
  const result: string[] = [];

  if (state.color) result.push(state.color);

  return result;
}

export function classesMatch(element: ChildNode, expected: string[]): boolean {
  const actual = isElementNode(element) ? Array.from(element.classList) : [];
  if (actual.length !== expected.length) return false;

  actual.sort();
  expected.sort();

  return actual.every((cls, i) => cls === expected[i]);
}

const isElementNode = (node: Text | ChildNode): node is Element => {
  return node instanceof Element;
};
