import { isFolderLike, } from "./types";
export class Disk {
    constructor() {
        this.root = {
            children: [],
            name: "",
            permissions: "rw-rw-rw-",
            type: "r",
            created: new Date(),
            owner: "guest",
            ownerGroup: "guest",
        };
        this.find = (path) => {
            let current = this.root;
            if (path === "/")
                return current;
            const parts = path.split("/").splice(1);
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const next = current.children.find((x) => x.name === part);
                if (next) {
                    if (isFolderLike(next)) {
                        current = next;
                    }
                    else {
                        throw new Error(`${this.getPath(next)} is a file`);
                    }
                }
                else
                    throw new Error(`${this.getPath(current)}/${part} not extists`);
            }
            return current.children.find((x) => x.name === parts[parts.length - 1]);
        };
        // todo remove
        this.findDirectory = (path) => {
            let current = this.root;
            if (path === "/")
                return current;
            for (let folder of path.split("/")) {
                if (folder === "")
                    continue;
                const next = current.children.find((x) => x.name === folder);
                if (next) {
                    if (isFolderLike(next)) {
                        current = next;
                    }
                    else {
                        throw new Error(`${this.getPath(next)} is a file`);
                    }
                }
                else
                    throw new Error(`${this.getPath(current)}/${folder} not extists`);
            }
            return current;
        };
        this.remove = (path) => {
            const file = this.find(path);
            if (file && "parent" in file)
                file.parent.children = file.parent.children.filter((x) => x !== file);
        };
        this.makeDirectory = (path) => {
            let current = this.root;
            let lastCreated;
            for (let folder of path.split("/")) {
                if (folder === "")
                    continue;
                const next = current.children.find((x) => x.name === folder);
                if (next) {
                    if (isFolderLike(next)) {
                        current = next;
                    }
                    else {
                        throw new Error(`${this.getPath(next)} is a file`);
                    }
                }
                else {
                    const newFolder = {
                        parent: current,
                        children: [],
                        name: folder,
                        permissions: "rw-r--r--",
                        type: "d",
                        created: new Date(),
                        owner: "guest",
                        ownerGroup: "guest",
                    };
                    current.children.push(newFolder);
                    current = newFolder;
                    lastCreated = newFolder;
                }
            }
            return lastCreated;
        };
        // todo copyaster
        this.makeSysFile = (path, command) => {
            let current = this.root;
            const parts = path.split("/");
            for (let i = 0; i < parts.length - 1; i++) {
                const folder = parts[i];
                if (folder === "")
                    continue;
                const next = current.children.find((x) => x.name === folder);
                if (next) {
                    if (isFolderLike(next)) {
                        current = next;
                    }
                    else {
                        throw new Error("There is alread a file in a path");
                    }
                }
                else {
                    const newFolder = {
                        parent: current,
                        children: [],
                        name: folder,
                        permissions: "rw-r--r--",
                        type: "d",
                        created: new Date(),
                        owner: "guest",
                        ownerGroup: "guest",
                    };
                    current.children.push(newFolder);
                    current = newFolder;
                }
            }
            const file = {
                parent: current,
                command,
                name: parts[parts.length - 1],
                permissions: "rw-r--r--",
                type: "x",
                created: new Date(),
                owner: "guest",
                ownerGroup: "guest",
            };
            current.children.push(file);
        };
        this.makeFile = (path, content) => {
            let current = this.root;
            const parts = path.split("/");
            for (let i = 0; i < parts.length - 1; i++) {
                const folder = parts[i];
                if (folder === "")
                    continue;
                const next = current.children.find((x) => x.name === folder);
                if (next) {
                    if ("children" in next) {
                        current = next;
                    }
                    else {
                        throw new Error("There is alread a file in a path");
                    }
                }
                else {
                    const newFolder = {
                        parent: current,
                        children: [],
                        name: folder,
                        permissions: "rw-r--r--",
                        type: "d",
                        created: new Date(),
                        owner: "guest",
                        ownerGroup: "guest",
                    };
                    current.children.push(newFolder);
                    current = newFolder;
                }
            }
            const file = {
                parent: current,
                content: content || "",
                name: parts[parts.length - 1],
                permissions: "rw-r--r--",
                type: "-",
                created: new Date(),
                owner: "guest",
                ownerGroup: "guest",
            };
            current.children.push(file);
            return file;
        };
    }
    getPath(node) {
        const parts = [];
        parts.push(node.name);
        while ("parent" in node) {
            node = node.parent;
            parts.push(node.name);
        }
        return parts.reverse().join("/");
    }
}
export const createDisk = () => new Disk();
