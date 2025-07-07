import { HtmlLineInput } from "../terminal/HtmlLineInput";
export const editCommand = async function* (stdin, args, { std: { out }, fs: { open, createFile }, tryBindTerminal, color, id }) {
    let file;
    if (args.length > 0) {
        const node = open(args[0]);
        if (node && node.type !== "-")
            return 1;
        file = node;
    }
    const isBinded = tryBindTerminal();
    if (!isBinded)
        return 1;
    const terminal = isBinded;
    let isColor = false;
    terminal.clear();
    const input = new HtmlLineInput(terminal);
    if (file)
        terminal.write(file.content);
    let resolve = () => { };
    const closed = new Promise((res) => (resolve = res));
    terminal.onKey(id, (e) => {
        if (e.key === "U") {
            isColor = !isColor;
            if (isColor)
                input.write("\x1b[33m");
            else
                input.write("\x1b[39m");
        }
        else if (e.key === "Escape") {
            if (!file && args.length > 0)
                file = createFile(args[0]);
            if (file)
                file.content = input.value;
            terminal.close(id);
            resolve();
        }
        else if (e.key === "ArrowRight") {
            input.moveCursor(1);
        }
        else if (e.key === "ArrowLeft") {
            input.moveCursor(-1);
        }
        else if (e.key === "Enter")
            input.write("\n");
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey)
            input.write(e.key);
    });
    // await terminal.closed();
    await closed;
    return 0;
};
