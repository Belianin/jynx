export let CURRENT_DIR = "/home/guest";
export let USERNAME = "guest";
export const DOMAIN = window.location.hostname;
export function changeCurrentDir(value) {
    CURRENT_DIR = value;
}
