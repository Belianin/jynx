export const echoCommand = async function* echoCommand(stdin, args, { std: { out } }) {
    yield out(args?.join(" "));
    return 0;
};
