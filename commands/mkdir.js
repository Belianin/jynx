export const makeDirectoryCommand = async function* (stdin, args, { fs: { createDirectory } }) {
    createDirectory(args[0]);
    return 0;
};
