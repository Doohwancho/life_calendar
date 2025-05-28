// js/backlog.js

import * as data from "./dataManager.js";
// PRIORITY_COLORS, generateId 등은 이전과 동일하게 import 가정 (파일 상단에 있어야 함)
// import { PRIORITY_COLORS } from "./constants.js";
// import { generateId } from "./uiUtils.js";


const backlogPanelArea = document.getElementById("backlog-panel-area");
const backlogListContainer = document.getElementById("backlogListContainer");
const showAddTodoFormBtn = document.getElementById("showAddTodoFormBtn");
const addTodoFormContainer = document.getElementById("addTodoFormContainer");
const newTodoTextInput = document.getElementById("newTodoTextInput");
const newTodoPriorityInput = document.getElementById("newTodoPriorityInput");
const saveNewTodoBtn = document.getElementById("saveNewTodoBtn");
const cancelNewTodoBtn = document.getElementById("cancelNewTodoBtn");

export function renderBacklog() {
    if (!backlogListContainer) {
        console.error("Backlog list container not found for rendering!");
        return;
    }
    const { backlogTodos } = data.getState();
    console.log("[renderBacklog] Rendering with todos:", backlogTodos ? JSON.stringify(backlogTodos.map(t => t.id)) : "No todos");
    backlogListContainer.innerHTML = "";
    if (backlogTodos && backlogTodos.length > 0) {
        backlogTodos.forEach((todo) => {
            const todoEl = createTodoElement(todo);
            backlogListContainer.appendChild(todoEl);
        });
    }
}

function createTodoElement(todo) {
    const item = document.createElement("div");
    item.className = "backlog-todo-item";
    item.dataset.todoId = todo.id;
    item.style.borderLeftColor = todo.color;
    item.draggable = true;

    const textContent = document.createElement("div");
    textContent.className = "todo-text-content";
    const textSpan = document.createElement("span");
    textSpan.textContent = todo.text;
    textContent.appendChild(textSpan);

    const priorityDiv = document.createElement("div");
    priorityDiv.className = "todo-priority";
    const priorityInput = document.createElement("input");
    priorityInput.type = "number";
    priorityInput.min = 0;
    priorityInput.max = 3;
    priorityInput.value = todo.priority;
    priorityInput.title = `Priority: ${todo.priority}`;
    priorityInput.addEventListener("change", () => {
        data.updateBacklogTodoPriority(todo.id, priorityInput.value);
    });
    priorityDiv.appendChild(priorityInput);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "todo-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "edit-todo-btn";
    editBtn.innerHTML = "✏️";
    editBtn.title = "Edit todo";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-todo-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete todo";

    editBtn.addEventListener("click", () => {
        textSpan.style.display = "none";
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = todo.text;
        textContent.appendChild(editInput);
        editInput.focus();
        const finishEditing = () => {
            if (!editInput.parentElement) return;
            data.updateBacklogTodoText(todo.id, editInput.value);
            editInput.remove();
            textSpan.style.display = "inline";
        };
        editInput.addEventListener("blur", finishEditing);
        editInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") finishEditing();
            if (e.key === "Escape") {
                editInput.remove();
                textSpan.style.display = "inline";
            }
        });
    });

    deleteBtn.addEventListener("click", () => {
        if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
            data.deleteBacklogTodo(todo.id);
        }
    });
    actionsDiv.append(editBtn, deleteBtn);

    item.addEventListener("dragstart", (e) => {
        // console.log("[dragstart] Fired for todo ID:", todo.id);
        e.dataTransfer.setData("text/plain", todo.id); // To-do ID
        e.dataTransfer.setData("application/x-backlog-source", "true"); // 커스텀 타입으로 source 표시
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
        console.log("[dragend] Fired for todo ID:", todo.id);
        item.classList.remove("dragging");
    });

    item.append(textContent, priorityDiv, actionsDiv);
    return item;
}

function handleAddNewTodo() {
    const text = newTodoTextInput.value.trim();
    const priority = newTodoPriorityInput.value;
    if (text) {
        data.addBacklogTodo(text, priority);
        newTodoTextInput.value = "";
        newTodoPriorityInput.value = 0;
        addTodoFormContainer.style.display = "none";
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.backlog-todo-item:not(.dragging)')];
    const result = draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY });
    return result.element;
}

function handleBacklogDragOver(e) {
    console.log("DEBUG [handleBacklogDragOver] FIRED!"); // 로그 1: 함수 실행 확인
    
    let isCorrectSource = false;
    try {
        // e.dataTransfer.types가 DOMStringList이므로 includes 사용 가능
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) {
        console.error("DEBUG [handleBacklogDragOver] Error reading e.dataTransfer.types: ", err);
    }

    if (isCorrectSource) {
        e.preventDefault(); // 드롭을 허용하려면 반드시 호출
        console.log("DEBUG [handleBacklogDragOver] Correct source type. dropEffect=move"); // 로그 2
        e.dataTransfer.dropEffect = "move";

        const draggingItem = backlogListContainer.querySelector('.dragging');
        if (!draggingItem) {
            console.warn("DEBUG [handleBacklogDragOver] Dragging item '.dragging' NOT FOUND!"); // 로그 3
            return;
        }
        console.log("DEBUG [handleBacklogDragOver] Dragging item FOUND:", draggingItem.dataset.todoId); // 로그 4

        const afterElement = getDragAfterElement(backlogListContainer, e.clientY);
        console.log("DEBUG [handleBacklogDragOver] afterElement:", afterElement ? afterElement.dataset.todoId : 'null (append)'); // 로그 5

        if (afterElement === draggingItem) return;
        
        if (afterElement == null) {
            if (backlogListContainer.lastChild !== draggingItem) {
                console.log("DEBUG [handleBacklogDragOver] Appending to end"); // 로그 6
                backlogListContainer.appendChild(draggingItem);
            }
        } else {
            if (afterElement !== draggingItem.nextSibling) { 
                console.log("DEBUG [handleBacklogDragOver] Inserting before", afterElement.dataset.todoId); // 로그 7
                backlogListContainer.insertBefore(draggingItem, afterElement);
            }
        }
    } else {
        // console.log("DEBUG [handleBacklogDragOver] Incorrect source type. dropEffect=none. Types:", e.dataTransfer.types); // 로그 8
    }
}

function handleBacklogDrop(e) {
    console.log("DEBUG [handleBacklogDrop] FIRED!"); // 로그 9
    e.preventDefault(); // 기본 동작 방지
    
    let isCorrectSource = false;
    try {
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) {
        console.error("DEBUG [handleBacklogDrop] Error reading e.dataTransfer.types: ", err);
    }
    
    console.log("DEBUG [handleBacklogDrop] Correct source check:", isCorrectSource); // 로그 10

    if (!isCorrectSource) {
        console.warn("DEBUG [handleBacklogDrop] Drop source type mismatch. Aborting.");
        return;
    }

    const droppedTodoId = e.dataTransfer.getData("text/plain"); // ID는 여전히 text/plain으로 가져옴
    console.log("DEBUG [handleBacklogDrop] Dropped ID:", droppedTodoId); // 로그 11

    const newOrderedIds = [...backlogListContainer.querySelectorAll('.backlog-todo-item')]
        .map(item => item.dataset.todoId);
    console.log("DEBUG [handleBacklogDrop] New ordered IDs from DOM:", newOrderedIds); // 로그 12
    
    data.reorderBacklogTodos(newOrderedIds);
    console.log("DEBUG [handleBacklogDrop] Called data.reorderBacklogTodos"); // 로그 13
}

export function initBacklog() {
    if (!backlogListContainer) { // backlogPanelArea 대신 backlogListContainer null 체크
        console.error("Backlog List Container (backlogListContainer) not found!");
        return;
    }
    if (!showAddTodoFormBtn || !addTodoFormContainer || !newTodoTextInput || !saveNewTodoBtn || !cancelNewTodoBtn) {
        console.error("One or more form elements for backlog not found!");
        // Form 관련 요소가 없어도 드래그앤드롭은 작동해야 하므로 return하지 않음
    }

    if(showAddTodoFormBtn) {
        showAddTodoFormBtn.addEventListener("click", () => {
            if(addTodoFormContainer) addTodoFormContainer.style.display = "flex";
            if(newTodoTextInput) newTodoTextInput.focus();
        });
    }
    if(cancelNewTodoBtn) {
        cancelNewTodoBtn.addEventListener("click", () => {
            if(addTodoFormContainer) addTodoFormContainer.style.display = "none";
            if(newTodoTextInput) newTodoTextInput.value = "";
        });
    }
    if(saveNewTodoBtn) saveNewTodoBtn.addEventListener("click", handleAddNewTodo);
    if(newTodoTextInput) {
        newTodoTextInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleAddNewTodo();
        });
    }

    backlogListContainer.addEventListener('dragover', handleBacklogDragOver);
    backlogListContainer.addEventListener('drop', handleBacklogDrop);

    console.log("Backlog Module Initialized (with DND listeners for container).");
}