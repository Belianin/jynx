import { changeCurrentDir } from "../shell/env";
import { parseArgs } from "../shell/parsing";
import { colorToConvert } from "../shell/print";
import { err, out } from "../shell/shell";
export class Jinux {
    constructor(fs, terminal) {
        this.fs = fs;
        this.processes = {};
        this.lastProcessId = 0;
        this.terminal = terminal;
    }
    run(stdin, command, args, isStdoutToConsole, variables, onStd) {
        let processId = ++this.lastProcessId;
        let resolve = () => { };
        const closed = new Promise((res) => {
            resolve = res;
        });
        const process = {
            id: processId,
            command,
            workingDirectory: "/home/guest", // todo
            closed: () => closed,
        };
        const getPathTo = (path) => {
            const parts = path.startsWith("/")
                ? [""]
                : process.workingDirectory === "/"
                    ? [""]
                    : process.workingDirectory.split("/");
            // Разбиваем path по / и обрабатываем каждый элемент
            path.split("/").forEach((segment) => {
                if (segment === "..") {
                    if (parts.length > 1) {
                        parts.pop();
                    }
                }
                else if (segment !== "" && segment !== ".") {
                    parts.push(segment);
                }
            });
            // Собираем финальный путь
            return parts.join("/") || "/";
        };
        this.processes[processId] = process;
        const iterator = command(stdin, args, {
            color: colorToConvert,
            isStdoutToConsole,
            core: this,
            fs: {
                open: (path) => this.fs.find(getPathTo(path)),
                remove: (path) => this.fs.remove(getPathTo(path)),
                createDirectory: (path) => this.fs.makeDirectory(getPathTo(path)),
                createFile: (path) => this.fs.makeFile(getPathTo(path)),
                getPathTo,
                changeWorkingDirectory: (path) => {
                    path = getPathTo(path);
                    const dir = this.fs.find(path);
                    if (dir && (dir.type === "d" || dir.type === "r"))
                        changeCurrentDir(path);
                    // else this.print("Path to found\n"); // todo
                },
                makeSysFile: (path, command) => this.fs.makeSysFile(getPathTo(path), command),
            },
            tryBindTerminal: this.bindTerminal.bind(this),
            parseArgs,
            std: {
                out,
                err,
            },
            variables,
            id: processId,
            changeDirectory: (path) => (process.workingDirectory = path), // todo validate
        });
        const iterate = () => {
            iterator.next().then(({ done, value }) => {
                onStd?.(value);
                if (done) {
                    delete this.processes[processId];
                    resolve();
                }
                else {
                    iterate();
                }
            });
        };
        iterate();
        return process;
    }
    bindTerminal() {
        // if (this.terminal.isOpen) {
        //   this.terminal.close();
        // }
        // this.terminal.clear(); // todo не уверен что всегда нужно
        // this.input.hide();
        this.terminal.isOpen = true;
        this.terminal.buffer = "";
        this.terminal.closedTermialPromise = new Promise((res) => (this.terminal.resolveСlosedTermialPromise = res));
        return this.terminal;
    }
}
