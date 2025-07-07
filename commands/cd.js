import { err } from "../shell/shell";
export const changeDirectoryCommand = async function* (stdin, args, { fs: { changeWorkingDirectory } }) {
    try {
        changeWorkingDirectory(args[0]);
        return 0;
    }
    catch (e) {
        yield err(e);
    }
    return 1;
};
