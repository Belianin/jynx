import { HtmlLineInput } from "../terminal/HtmlLineInput";
import { CURRENT_DIR, DOMAIN, USERNAME } from "./env";
import { shellParse } from "./parsing";
export const shell = async function* (stdin, args, { tryBindTerminal, fs, core, color, id }) {
    const isBinded = tryBindTerminal();
    if (!isBinded)
        throw new Error("Faield to bind terminal");
    const terimal = isBinded;
    const readEnvFile = () => {
        const envFile = fs.open(envPath);
        if (!envFile || envFile.type !== "-")
            return [];
        var envs = envFile.content.split("\n");
        const res = Object.fromEntries(envs.map((x) => {
            const kvp = x.split("=").filter((x) => x.trim() !== "");
            return kvp;
        }));
        return res;
    };
    const variables = readEnvFile();
    const getPathCommands = () => {
        const commands = {};
        const pathValue = variables["PATH"];
        if (!pathValue)
            return commands;
        const paths = pathValue.split(";").filter((x) => x.trim() !== "");
        console.log(paths);
        for (let path of paths) {
            const dir = fs.open(path);
            if (!dir || dir.type !== "d")
                continue;
            for (let node of dir.children) {
                if ("command" in node)
                    commands[node.name] = node.command;
            }
        }
        return commands;
    };
    const execute = async (text) => {
        if (text === "")
            return;
        const commands = getPathCommands();
        const parsed = shellParse(text);
        const commandsToExecute = [];
        for (let { args, redirects } of parsed) {
            const commandName = args[0];
            const command = commands[commandName];
            if (!command) {
                terimal.write(`Command '${commandName}' not found\n`);
                return;
            }
            commandsToExecute.push({
                command,
                args: args.splice(1),
                redirects,
            });
        }
        try {
            await runPipeline(commandsToExecute); // todo process closed;
        }
        catch (e) {
            if (e instanceof Error)
                terimal.write(e.message + "\n");
            else
                terimal.write("Internal problem\n");
            // if (e instanceof Error) this.print({ color: "red", value: e.message });
            // else this.print("Internal problem");
            // this.print("\n");
        }
    };
    const runPipeline = async (commands) => {
        const streams = commands.map(() => createStream());
        const createWriteStream = (target, append) => {
            const path = target.startsWith("/") ? target : `${CURRENT_DIR}/${target}`;
            let file = fs.open(path);
            if (!file) {
                file = fs.createFile(path);
            }
            if (!file || file.type !== "-") {
                throw new Error(`${file} is not a file`);
            }
            if (!append)
                file.content = "";
            return {
                write(data) {
                    file.content += data;
                },
                close: () => { },
            };
        };
        const processes = commands.map(({ command, args, redirects }, i) => {
            let stdin = i === 0 ? emptyStdin() : streams[i - 1];
            let stdout = {
                write: (data) => terimal.write(data), // todo terimal.write(parseColorText(data)),
            };
            let stderr = {
                write: (data) => {
                    terimal.write(data);
                    // const parsedColors = parseColorText(data);
                    // if (parsedColors.length === 1)
                    //   terimal.write(data);//this.print({ color: "red", value: data });
                    // else terimal.write(parsedColors);
                },
            };
            const stdoutRedirect = redirects.find((r) => r.fd === 1);
            const stderrRedirect = redirects.find((r) => r.fd === 2);
            // Флаг для перенаправления stderr в stdout (например, 2>&1)
            let stderrToStdout = false;
            // Определим stdout
            if (stdoutRedirect) {
                // Пример простой обработки '>' и '>>', без реального файла — нужно заменить под задачу
                stdout = createWriteStream(stdoutRedirect.target, stdoutRedirect.type === ">>");
            }
            else if (i < commands.length - 1) {
                // Не последняя команда — stdout в pipe
                stdout = streams[i];
            }
            // Определим stderr
            if (stderrRedirect) {
                if (stderrRedirect.type === ">&" && stderrRedirect.target === "1") {
                    // stderr перенаправляем в stdout
                    stderrToStdout = true;
                }
                else {
                    stderr = createWriteStream(stderrRedirect.target, stderrRedirect.type === ">>"); // >> так ли это?
                }
            }
            // Если stderr перенаправлен в stdout
            if (stderrToStdout) {
                stderr = stdout;
            }
            return (async () => {
                const procVariables = {
                    ...variables,
                    PWD: CURRENT_DIR,
                };
                let resolve = () => { };
                const onStd = (event) => {
                    if (typeof event === "number") {
                        if ("close" in stdout) {
                            stdout.close();
                        }
                        if ("close" in stderr) {
                            stderr.close();
                        }
                        resolve();
                    }
                    else {
                        if (event.type === "stdout") {
                            stdout.write(event.data);
                        }
                        else {
                            stderr.write(event.data);
                        }
                    }
                };
                core.run(stdin, command, args, !stdoutRedirect && i === commands.length - 1, procVariables, onStd);
                return new Promise((res) => (resolve = res));
            })();
        });
        await Promise.all(processes);
    };
    const history = [];
    let historyCounter = 0;
    const prefix = `${color["red"]("guest@localhost")}:${color["yellow"]("/home/guest")} `;
    terimal.write(prefix);
    function getHistoryCommand(delta) {
        historyCounter += delta;
        if (historyCounter < -1)
            historyCounter = -1;
        if (historyCounter === -1)
            return "";
        if (historyCounter >= history.length) {
            historyCounter = history.length - 1;
        }
        return history[history.length - historyCounter - 1] || "";
    }
    let input = new HtmlLineInput(terimal);
    const writeHistoryCommand = (delta) => {
        const command = getHistoryCommand(delta); // todo closure?
        input.moveCursorToStart();
        input.removeAfterCursorLine();
        input.write(command);
    };
    let executing = false;
    function onKey(e) {
        if (executing)
            return;
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            input.write(e.key);
        }
        else if (e.ctrlKey && e.key === "v") {
            navigator.clipboard.readText().then((text) => input.write(text));
        }
        else if (e.key === "Backspace") {
            input.remove();
        }
        else if (e.key === "Delete") {
            input.remove(); // удаляется не то
        }
        else if (e.key === "ArrowLeft") {
            input.moveCursor(-1);
        }
        else if (e.key === "ArrowRight") {
            input.moveCursor(1);
        }
        else if (e.key === "ArrowUp") {
            writeHistoryCommand(1);
        }
        else if (e.key === "ArrowDown") {
            writeHistoryCommand(-1);
        }
        else if (e.key === "Enter") {
            const result = input.value;
            input.moveCursorToEnd();
            if (result !== "") {
                terimal.write("\n");
                history.push(result);
                executing = true;
                execute(result).then((x) => {
                    terimal.write(prefix);
                    input = new HtmlLineInput(terimal); // todo перенести в аргументы
                    executing = false;
                });
            }
            else {
                terimal.write(`\n${prefix}`);
                input = new HtmlLineInput(terimal); // todo перенести в аргументы
            }
        }
    }
    terimal.onKey(id, onKey);
    let resolve = () => { };
    const closed = new Promise((res) => (resolve = res));
    await closed;
    // await terimal.closed();
    return 0;
};
export const getPrefix = () => {
    return [
        {
            value: `${USERNAME}@${DOMAIN}`,
            color: "gray",
        },
        {
            value: ":",
        },
        {
            value: (CURRENT_DIR === "" ? "/" : CURRENT_DIR) + " ",
            color: "orange",
        },
    ];
};
function createStream() {
    const queue = [];
    let resolve = null;
    let isClosed = false;
    const stream = {
        async *[Symbol.asyncIterator]() {
            while (true) {
                if (queue.length) {
                    yield queue.shift();
                }
                else if (isClosed) {
                    break;
                }
                else {
                    await new Promise((r) => (resolve = r));
                }
            }
        },
        write(data) {
            queue.push(data);
            resolve?.();
        },
        close() {
            isClosed = true;
            if (resolve) {
                resolve();
            }
        },
    };
    return stream;
}
export async function* emptyStdin() { }
// todo move
export const sysProgramsPath = "/sys/bin";
export const usrProgramsPath = "/usr/bin";
export const envPath = "/sys/etc/env";
// todo move to context with std ids
export const err = (data) => ({
    type: "stderr",
    data: data.endsWith("\n") ? data : data + "\n",
});
export const out = (data) => ({
    type: "stdout",
    data: data.endsWith("\n") ? data : data + "\n",
});
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
