import {getSelectText} from "../editor/getSelectText";
import {inputEvent} from "../editor/inputEvent";
import {quickInsertText} from "../editor/insertText";
import {setSelectionByStartEndNode} from "../editor/setSelection";

export class Hotkey {
    public hintElement: HTMLElement;
    public vditor: IVditor;
    private disableEnter: boolean;

    constructor(vditor: IVditor) {
        this.hintElement = vditor.hint && vditor.hint.element;
        this.vditor = vditor;
        this.disableEnter = false;
        this.bindHotkey();
    }

    private processKeymap(hotkey: string, event: KeyboardEvent, action: () => void) {
        const hotkeys = hotkey.split("-");
        const hasShift = hotkeys.length === 3 && (hotkeys[1] === "shift" || hotkeys[1] === "⇧");
        const key = hasShift ? hotkeys[2] : hotkeys[1];
        if ((hotkeys[0] === "ctrl" || hotkeys[0] === "⌘") && (event.metaKey || event.ctrlKey)
            && event.key.toLowerCase() === key.toLowerCase()) {
            if ((!hasShift && !event.shiftKey) || (hasShift && event.shiftKey)) {
                action();
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    private bindHotkey(): void {
        this.vditor.editor.element.addEventListener("keydown", (event: KeyboardEvent) => {
            if (this.vditor.options.esc) {
                if (event.key.toLowerCase() === "Escape".toLowerCase()) {
                    this.vditor.options.esc(this.vditor.editor.element.innerText);
                }
            }

            if (this.vditor.options.hint.at || this.vditor.toolbar.elements.emoji) {
                this.hint(event);
            }

            if (event.key.toLowerCase() === "enter") {
                if ((event.metaKey || event.ctrlKey) && this.vditor.options.ctrlEnter) {
                    this.vditor.options.ctrlEnter(this.vditor.editor.element.innerText);
                } else if (!event.metaKey && !event.ctrlKey && !this.disableEnter) {
                    // new line, use br instead of div
                    const range = window.getSelection().getRangeAt(0);
                    range.deleteContents();
                    let needTwoBR = true;
                    let getResult = false;
                    if (range.endContainer.nodeType === 3) {
                        let nextSibling = range.endContainer.nextSibling;
                        while (nextSibling && !getResult) {
                            if (nextSibling.nodeName === "BR" ||
                                (nextSibling.nodeType === 3 && nextSibling.textContent !== "")) {
                                needTwoBR = false;
                                getResult = true;
                            }
                            nextSibling = nextSibling.nextSibling;
                        }
                    } else {
                        let currentIndex = range.endOffset;
                        let currentNode = range.endContainer.childNodes[currentIndex];
                        while (currentNode && !getResult) {
                            if (currentNode.nodeName === "BR" ||
                                (currentNode.nodeType === 3 && currentNode.textContent !== "")) {
                                needTwoBR = false;
                                getResult = true;
                            }
                            currentNode = range.endContainer.childNodes[++currentIndex];
                        }
                    }

                    let html = "<br>";
                    // bottom always needs br, otherwise can not enter
                    if (needTwoBR) {
                        html = "<br><br>";
                    }

                    // insert br and remove position
                    const element = document.createElement("div");
                    element.innerHTML = html;
                    const fragment = document.createDocumentFragment();
                    let node = element.firstChild;
                    const firstNode = node;
                    while (node) {
                        fragment.appendChild(node);
                        node = element.firstChild;
                    }
                    range.insertNode(fragment);
                    setSelectionByStartEndNode(firstNode, firstNode, range);
                    inputEvent(this.vditor);
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
            // editor actions
            if (this.vditor.options.keymap.deleteLine) {
                this.processKeymap(this.vditor.options.keymap.deleteLine, event, () => {
                    const range = window.getSelection().getRangeAt(0);
                    if (range.startContainer.nodeType === 3) {
                        range.setStart(range.startContainer, 0);
                    } else {
                        range.setStartBefore(range.startContainer.childNodes[Math.max(0, range.startOffset - 1)]);
                    }
                    if (range.endContainer.nodeType === 3) {
                        if (range.endContainer.nextSibling) {
                            range.setEndAfter(range.endContainer.nextSibling);
                        } else {
                            range.setEnd(range.endContainer, range.endContainer.textContent.length);
                        }
                    } else {
                        range.setEndBefore(range.endContainer.childNodes[range.endOffset]);
                    }
                    quickInsertText("");
                });
            }
            if (this.vditor.options.keymap.duplicate) {
                this.processKeymap(this.vditor.options.keymap.duplicate, event, () => {
                    const range = window.getSelection().getRangeAt(0);
                    let selectText = "";
                    if (range.collapsed) {
                        range.setStart(range.startContainer, 0);
                        range.setEnd(range.endContainer, range.endContainer.textContent.length);
                        selectText = "\n" + getSelectText(range, this.vditor.editor.element);
                    } else {
                        selectText = getSelectText(range, this.vditor.editor.element);
                    }
                    range.setStart(range.endContainer, range.endOffset);
                    quickInsertText(selectText);
                });
            }

            // toolbar action
            this.vditor.options.toolbar.forEach((menuItem: IMenuItem) => {
                if (!menuItem.hotkey) {
                    return;
                }
                this.processKeymap(menuItem.hotkey, event, () => {
                    (this.vditor.toolbar.elements[menuItem.name].children[0] as HTMLElement).click();
                });
            });

            if (this.vditor.options.tab && event.key.toLowerCase() === "tab") {
                const selectionValue = getSelectText(window.getSelection().getRangeAt(0), this.vditor.editor.element);
                const selectionResult = selectionValue.split("\n").map((value) => {
                    return this.vditor.options.tab + value;
                });

                quickInsertText(selectionResult.join("\n"));

                event.preventDefault();
                event.stopPropagation();
            }
        });
    }

    private hint(event: KeyboardEvent) {
        if (this.hintElement.querySelectorAll("li").length === 0 ||
            this.hintElement.style.display === "none") {
            return;
        }

        const currentHintElement: HTMLElement = this.hintElement.querySelector(".vditor-hint--current");

        if (event.key.toLowerCase() === "arrowdown") {
            event.preventDefault();
            event.stopPropagation();
            if (!currentHintElement.nextElementSibling) {
                this.hintElement.children[0].className = "vditor-hint--current";
            } else {
                currentHintElement.nextElementSibling.className = "vditor-hint--current";
            }
            currentHintElement.removeAttribute("class");
        } else if (event.key.toLowerCase() === "arrowup") {
            event.preventDefault();
            event.stopPropagation();
            if (!currentHintElement.previousElementSibling) {
                const length = this.hintElement.children.length;
                this.hintElement.children[length - 1].className = "vditor-hint--current";
            } else {
                currentHintElement.previousElementSibling.className = "vditor-hint--current";
            }
            currentHintElement.removeAttribute("class");
        } else if (event.key.toLowerCase() === "enter") {
            event.preventDefault();
            event.stopPropagation();
            this.vditor.hint.fillEmoji(currentHintElement);
            this.disableEnter = true;
            setTimeout(() => {
                this.disableEnter = false;
            }, 10);
        }
    }
}
