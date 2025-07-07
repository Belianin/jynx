import { isFile, isFolder } from "../disk/types";
const fileColor = "yellow";
export const listDirectoryCommand = async function* (stdin, args, { parseArgs, std: { out }, fs: { open }, variables: { PWD, col }, isStdoutToConsole, color, }) {
    const { flags, positional } = parseArgs(args);
    const isColored = flags["color"] !== "false" && (isStdoutToConsole || flags["color"]);
    const path = positional[0] || PWD;
    const folder = open(path);
    if (!folder) {
        out(`${path} not found`);
        return 1;
    }
    if (!isFolder(folder)) {
        out(`${path} is not a folder`);
        return 1;
    }
    const items = folder.children.filter((x) => !x.name.startsWith(".") || flags["a"]);
    if (flags["l"]) {
        const colWidths = [0, 0, 0, 0, 0, 0, 0];
        const rows = [];
        // let maxSizeSize = 0
        for (let item of items) {
            const row = [
                `${item.type}${item.permissions}`,
                "0",
                item.owner,
                item.ownerGroup,
                isFile(item) ? item.content.length.toString() : "0",
                formatDate(item.created),
                item.name,
            ];
            for (let i = 0; i < row.length; i++) {
                const colWidth = row[i].length;
                if (colWidths[i] < colWidth)
                    colWidths[i] = colWidth;
            }
            rows.push(row);
            // const size =
        }
        // печатаем с выравниванием
        for (const [row, j] of rows.map((row, j) => [row, j])) {
            const line = row
                .map((val, i) => {
                const padded = i !== 0 ? val.padStart(colWidths[i] + 1) : val;
                if (isColored && items[j].type === "-" && i === row.length - 1)
                    return color[fileColor](padded);
                return padded;
            })
                .join("");
            yield out(line);
        }
        return 0;
    }
    else {
        yield out(items
            .map((x) => {
            if (x.type === "-" && isColored)
                return color[fileColor](x.name);
            return x.name;
        })
            .join("\t"));
        return 0;
    }
};
function formatDate(date) {
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    const now = new Date();
    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, " "); // пробел перед однозначным числом
    // Проверка: изменён ли файл за последние 6 месяцев
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
    if (Math.abs(now.getTime() - date.getTime()) < sixMonthsMs) {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${month} ${day} ${hours}:${minutes}`;
    }
    else {
        const year = date.getFullYear();
        return `${month} ${day}  ${year}`;
    }
}
