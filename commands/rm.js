export const removeFile = async function* (stdin, args, { fs: { remove } }) {
    remove(args[0]);
    return 0;
};
