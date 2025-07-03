import { createTextElement, print } from "./commands/echo";
import { execute, getPrefix } from "./shell";

export const consoleElement = document.getElementById("console")!;

// Текущее состояние
let inputText = "";
let cursorPos = 0;

// Добавляем курсор
export const inputElement = document.createElement("span");
export function scrollToBottom() {
  inputElement.scrollIntoView(false);
}

const path = document.createElement("span");
for (let prefixPart of getPrefix())
  path.appendChild(createTextElement(prefixPart));
// const user = document.createElement("span");
// user.style.color = "#00ff00";
// user.innerHTML = "guest@belyanin.zip";
// path.appendChild(user);
// const double = document.createTextNode(":");
// path.appendChild(double);
// const pathReal = document.createElement("span");
// pathReal.style.color = "#0000FF";
// pathReal.innerHTML = "/root/std ";
// path.appendChild(pathReal);
inputElement.appendChild(path);
const editable = document.createElement("span");
inputElement.appendChild(editable);

const cursor = document.createElement("span");
cursor.classList.add("cursor");
cursor.textContent = "█";

inputElement.appendChild(cursor);
consoleElement.appendChild(inputElement);

function render() {
  editable.innerHTML = "";

  const before = document.createTextNode(inputText.slice(0, cursorPos));
  const after = document.createTextNode(inputText.slice(cursorPos));

  editable.appendChild(before);
  editable.appendChild(cursor);
  editable.appendChild(after);

  // Скролл вниз
  cursor.scrollIntoView(false);
}

let history: string[] = [];
let historyCounter = -1;

const getHistoryCommand = (delta: number) => {
  historyCounter += delta;
  if (historyCounter < -1) historyCounter = -1;
  if (historyCounter === -1) return "";

  if (historyCounter >= history.length) {
    historyCounter = history.length - 1;
  }

  return history[history.length - historyCounter - 1] || "";
};

consoleElement.addEventListener("keydown", (e) => {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    inputText =
      inputText.slice(0, cursorPos) + e.key + inputText.slice(cursorPos);
    cursorPos++;
    render();
    e.preventDefault();
  } else if (e.ctrlKey && e.key === "v") {
    e.preventDefault();
    navigator.clipboard.readText().then((text) => {
      inputText =
        inputText.slice(0, cursorPos) + text + inputText.slice(cursorPos);
      cursorPos += inputText.length;
      render();
    });
  } else if (e.key === "Backspace") {
    if (cursorPos > 0) {
      inputText =
        inputText.slice(0, cursorPos - 1) + inputText.slice(cursorPos);
      cursorPos--;
      render();
    }
    e.preventDefault();
  } else if (e.key === "Delete") {
    if (cursorPos < inputText.length) {
      inputText =
        inputText.slice(0, cursorPos) + inputText.slice(cursorPos + 1);
      render();
    }
    e.preventDefault();
  } else if (e.key === "ArrowLeft") {
    if (cursorPos > 0) cursorPos--;
    render();
    e.preventDefault();
  } else if (e.key === "ArrowRight") {
    if (cursorPos < inputText.length) cursorPos++;
    render();
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    inputText = getHistoryCommand(+1);
    cursorPos = inputText.length;
    render();
    e.preventDefault();
    e.preventDefault();
  } else if (e.key === "ArrowDown") {
    inputText = getHistoryCommand(-1);
    cursorPos = inputText.length;
    render();
    e.preventDefault();
  } else if (e.key === "Enter") {
    print(getPrefix());
    print(inputText + "\n");
    execute(inputText);
    historyCounter = -1;
    history.push(inputText);
    inputText = "";
    cursorPos = 0;
    render();
    e.preventDefault();
  }
});

// Устанавливаем фокус при клике
consoleElement.addEventListener("click", () => consoleElement.focus());

// Стартовая отрисовка
render();

//   let cursor = document.getElementById("cursor");
// TODO: не создавать span на каждую букву. Достаточно на цвет
// const outputQueue: PrintableText[] = [
//   { value: "Initializing system...\n", color: "gray" },
//   { value: "Loading modules: ", color: "white" },
//   { value: "[OK]\n", color: "green" },
//   { value: "Connecting to server: ", color: "white" },
//   { value: "[FAIL]\n", color: "red" },
//   { value: "Attempting recovery...\n", color: "yellow" },
//   { value: "Recovered successfully.\n", color: "green" },
//   { value: "Starting services...\n", color: "white" },
//   { value: "All systems online.\n", color: "cyan" },
//   { value: "Welcome, Commander.\n", color: "magenta" },
// ];

// // type(); // Обработка нажатий клавиш
// for (let text of outputQueue) {
//   //   await type(text);
//   print(text);
// }
