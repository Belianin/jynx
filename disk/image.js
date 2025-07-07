import { aptCommand, defaultSources, sourcesList } from "../commands/apt";
import { catCommand } from "../commands/cat";
import { changeDirectoryCommand } from "../commands/cd";
import { copyCommand } from "../commands/cp";
import { echoCommand } from "../commands/echo";
import { editCommand } from "../commands/edit";
import { envCommand } from "../commands/env";
import { grepCommand } from "../commands/grep";
import { listDirectoryCommand } from "../commands/ls";
import { makeDirectoryCommand } from "../commands/mkdir";
import { removeFile } from "../commands/rm";
import { CURRENT_DIR } from "../shell/env";
import { envPath, sysProgramsPath, usrProgramsPath } from "../shell/shell";
import { Disk } from "./disk";
export class FsImage {
    constructor() {
        this.files = [];
        this.folders = [];
        this.commands = [];
    }
    createFs() {
        const result = new Disk();
        for (let folder of this.folders)
            result.makeDirectory(folder);
        for (let [name, content] of this.files)
            result.makeFile(name, content);
        for (let [name, command] of this.commands)
            result.makeSysFile(`${sysProgramsPath}/${name}`, command);
        return result;
    }
}
export const createDefaultImage = () => {
    const result = new FsImage();
    const commandToRegister = {
        echo: echoCommand,
        grep: grepCommand,
        cat: catCommand,
        mkdir: makeDirectoryCommand,
        ls: listDirectoryCommand,
        env: envCommand,
        cd: changeDirectoryCommand,
        rm: removeFile,
        cp: copyCommand,
        apt: aptCommand,
        edit: editCommand,
    };
    for (let command of Object.entries(commandToRegister)) {
        result.commands.push(command);
    }
    result.files = [
        [envPath, `PATH=${sysProgramsPath};${usrProgramsPath}`],
        [sourcesList, defaultSources],
    ];
    result.folders = [sysProgramsPath, usrProgramsPath, CURRENT_DIR];
    return result;
};
