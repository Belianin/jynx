const fileSystem: Record<string, string> = {
  "/system/env": "TEST=TEST_VALUE\n",
};

export const cat = (filename: string) => {
  if (fileSystem[filename]) return fileSystem[filename];
  return `File '${filename}' not found`;
};

// export const catCommand: ShellCommand = (args) => {
//   return cat(args[0]);
// };
