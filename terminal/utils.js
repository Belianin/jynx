const regex = /\x1b\[([0-9;]*)m/g;
export const removeCsi = (text) => text.replace(regex, "");
export const parseText = (text) => {
    if (text === "")
        return [];
    let result = [];
    let lastIndex = 0;
    let match;
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
export const applyStyleCommand = (state, token) => {
    const result = {
        ...state,
    };
    for (let p of token) {
        if (p === 0)
            return {};
        else if (p === 1)
            result.bold = true;
        else if (p === 3)
            result.curly = true;
        else if (p === 4)
            result.underline = true;
        else if (p >= 30 && p <= 37)
            result.color = colorMap[p];
        else if (p == 39)
            result.color = undefined;
        else if (p >= 40 && p <= 47)
            result.backgroundColor = colorMap[p];
        else if (p == 49)
            result.backgroundColor = undefined;
    }
    return result;
};
export function getStyleClasses(state) {
    const result = [];
    if (state.color)
        result.push(state.color);
    return result;
}
export function classesMatch(element, expected) {
    const actual = isElementNode(element) ? Array.from(element.classList) : [];
    if (actual.length !== expected.length)
        return false;
    actual.sort();
    expected.sort();
    return actual.every((cls, i) => cls === expected[i]);
}
const isElementNode = (node) => {
    return node instanceof Element;
};
