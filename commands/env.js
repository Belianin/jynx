export const envCommand = async function* (stdin, args, { variables, std: { out } }) {
    for (let [key, value] of Object.values(variables))
        yield out(`${key}=${value}`);
    return 0;
};
