export const colors = [
  "black",
  "white",
  "red",
  "green",
  "cyan",
  "magenta",
  "yellow",
  "blue",
  "gray",
  "orange",
  "purple",
] as const;
export type Color = (typeof colors)[number];
export const defaultColor: Color = "white";

export type PrintableText = {
  value: string;
  color?: Color;
};

export const createTextElement = (text: PrintableText) => {
  const span = document.createElement("span");
  span.textContent = text.value;
  span.classList.add(text.color || defaultColor);
  return span;
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

export const colorToConvert: Record<Color, (text: string) => string> =
  {} as any; // todo

for (let [number, color] of Object.entries(colorMap)) {
  colorToConvert[color] = (text: string) => `\x1b[${number}m${text}\x1b[0m`;
}

export const parseColorText = (text: string): PrintableText[] => {
  const regex = /\x1b\[(\d+)m/g;
  let result: PrintableText[] = [];

  let currentColor: Color | undefined = undefined;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const code = match[1];
    const index = match.index;

    // Текст до текущего управляющего кода
    if (index > lastIndex) {
      result.push({
        value: text.slice(lastIndex, index),
        color: currentColor,
      });
    }

    // Обновляем текущий цвет
    if (code === "0") {
      currentColor = undefined;
    } else if (colorMap[code]) {
      currentColor = colorMap[code];
    }

    lastIndex = regex.lastIndex;
  }

  // Остаток текста после последнего кода
  if (lastIndex < text.length) {
    result.push({
      value: text.slice(lastIndex),
      color: currentColor,
    });
  }

  return result;
};
