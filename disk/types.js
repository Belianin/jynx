export const isFile = (node) => {
    return "content" in node;
};
export const isFolder = (node) => {
    return "parent" in node || "children" in node;
};
export const isFolderLike = (node) => {
    return "children" in node;
};
