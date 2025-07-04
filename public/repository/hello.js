const hello = async function* (stdin, args) {
  try {
    yield { type: "stdout", data: "Hello world!\n" };
    return 0;
  } catch (e) {
    yield { type: "stderr", data: `${e.message}\n` };
  }

  return 1;
};

export default hello;
export const manifestVersion = "1";
