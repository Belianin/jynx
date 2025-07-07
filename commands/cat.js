import { isFile } from "../disk/types";
export const catCommand = async function* (stdin, args, { std: { out }, fs: { open } }) {
    if (args.length === 0)
        return 0;
    const filename = args[0];
    const file = open(filename);
    if (!file)
        throw new Error(`File ${filename} not found`);
    if (isFile(file))
        yield out(file.content);
    else
        throw new Error(`${filename} is not a file`);
    return 0;
};
