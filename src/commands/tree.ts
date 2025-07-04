import { disk } from "../disk/disk";
import { DiskNode, isFolderLike } from "../disk/types";
import { out } from "../shell/shell";
import { ShellCommand } from "../shell/types";

export const treeCommand: ShellCommand = async function* (stdin, args) {
  let result = "/";

  function add(node: DiskNode, intendation: number) {
    // yield ({
    //   type: "stdout",
    //   data: "\t".repeat(intendation) + node.name + "\n",
    //});
    // todo many yield
    result += "\t".repeat(intendation) + node.name + "\n";
    if (isFolderLike(node)) {
      for (let child of node.children) {
        add(child, intendation + 1);
      }
    }
  }

  add(disk.root, 0);

  //   const stack = [disk.root];
  //   while (stack.length > 0) {
  //     const node = stack.pop()
  //   }

  yield out(result);
  return 0;
};
