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
];
export const defaultColor = "white";
export const createTextElement = (text) => {
    const span = document.createElement("span");
    span.textContent = text.value;
    span.classList.add(text.color || defaultColor);
    return span;
};
const colorMap = {
    "30": "black",
    "31": "red",
    "32": "green",
    "33": "yellow",
    "34": "blue",
    "35": "magenta",
    "36": "cyan",
    "37": "white",
};
export const colorToConvert = {}; // todo
for (let [number, color] of Object.entries(colorMap)) {
    colorToConvert[color] = (text) => `\x1b[${number}m${text}\x1b[0m`;
}
export const parseColorText = (text) => {
    const regex = /\x1b\[(\d+)m/g;
    let result = [];
    let currentColor = undefined;
    let lastIndex = 0;
    let match;
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
        }
        else if (colorMap[code]) {
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
