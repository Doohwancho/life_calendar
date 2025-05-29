// js/backlog.js
import * as data from "./dataManager.js";
// import { PRIORITY_COLORS } from "./constants.js"; // dataManager에서 관리하므로 직접 필요 없을 수 있음
// import { generateId } from "./uiUtils.js"; // dataManager에서 ID 생성

let backlogPanelArea = null;
let backlogListContainer = null;
let showAddTodoFormBtn = null;
let addTodoFormContainer = null;
let newTodoTextInput = null;
let newTodoPriorityInput = null;
let saveNewTodoBtn = null;
let cancelNewTodoBtn = null;

export function renderBacklog() {
    if (!backlogListContainer) {
        console.error("Backlog list container not found for rendering! Was initBacklog called and successful?");
        return;
    }
    const state = data.getState();
    const backlogTodos = state.backlogTodos || [];
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
    item.className = "mv-backlog-todo-item"; // 접두사 적용
    item.dataset.todoId = todo.id;
    item.style.borderLeftColor = todo.color;
    item.draggable = true;

    const textContent = document.createElement("div");
    textContent.className = "mv-todo-text-content"; // 접두사 적용
    const textSpan = document.createElement("span");
    textSpan.textContent = todo.text;
    textContent.appendChild(textSpan);

    const priorityDiv = document.createElement("div");
    priorityDiv.className = "mv-todo-priority"; // 접두사 적용
    const priorityInput = document.createElement("input");
    priorityInput.type = "number";
    priorityInput.min = 0; priorityInput.max = 3;
    priorityInput.value = todo.priority;
    priorityInput.title = `Priority: ${todo.priority}`;
    priorityInput.addEventListener("change", () => {
        data.updateBacklogTodoPriority(todo.id, priorityInput.value);
    });
    priorityDiv.appendChild(priorityInput);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "mv-todo-actions"; // 접두사 적용
    const editBtn = document.createElement("button");
    editBtn.className = "mv-edit-todo-btn"; // 접두사 적용 (또는 .mv-todo-actions button)
    editBtn.innerHTML = "✏️"; editBtn.title = "Edit todo";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mv-delete-todo-btn"; // 접두사 적용 (또는 .mv-todo-actions button)
    deleteBtn.innerHTML = "🗑️"; deleteBtn.title = "Delete todo";

    editBtn.addEventListener("click", () => {
        textSpan.style.display = "none";
        const editInput = document.createElement("input");
        editInput.type = "text"; editInput.value = todo.text;
        // editInput.className = "mv-backlog-text-input"; // 필요시 더 구체적인 클래스
        textContent.appendChild(editInput);
        editInput.focus();
        const finishEditing = () => {
            if (!editInput.parentElement) return;
            data.updateBacklogTodoText(todo.id, editInput.value); // textContent.value -> editInput.value
            editInput.remove();
            textSpan.style.display = "inline"; // textSpan 다시 보이게
            // renderBacklog(); // dataChanged 이벤트가 처리
        };
        editInput.addEventListener("blur", finishEditing);
        editInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") finishEditing();
            if (e.key === "Escape") { editInput.remove(); textSpan.style.display = "inline"; }
        });
    });

    deleteBtn.addEventListener("click", () => {
        if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
            data.deleteBacklogTodo(todo.id);
            // renderBacklog(); // dataChanged 이벤트가 처리
        }
    });
    actionsDiv.append(editBtn, deleteBtn);

    item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.setData("application/x-backlog-source", "true");
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("mv-dragging"); // 접두사 적용
    });
    item.addEventListener("dragend", () => {
        item.classList.remove("mv-dragging"); // 접두사 적용
    });

    item.append(textContent, priorityDiv, actionsDiv);
    return item;
}

function handleAddNewTodo() {
    if (!newTodoTextInput || !newTodoPriorityInput || !addTodoFormContainer) {
        console.error("Backlog form elements not found for handleAddNewTodo."); return;
    }
    const text = newTodoTextInput.value.trim();
    const priority = newTodoPriorityInput.value;
    if (text) {
        data.addBacklogTodo(text, priority);
        newTodoTextInput.value = "";
        newTodoPriorityInput.value = 0;
        addTodoFormContainer.style.display = "none";
        // renderBacklog(); // dataChanged 이벤트가 처리
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.mv-backlog-todo-item:not(.mv-dragging)')]; // 접두사 적용
    const result = draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY });
    return result.element;
}

function handleBacklogDragOver(e) {
    let isCorrectSource = false;
    try {
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) { /* ignore */ }

    if (isCorrectSource) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const draggingItem = backlogListContainer.querySelector('.mv-dragging'); // 접두사 적용
        if (!draggingItem) return;
        const afterElement = getDragAfterElement(backlogListContainer, e.clientY);
        if (afterElement === draggingItem) return;
        if (afterElement == null) {
            if (backlogListContainer.lastChild !== draggingItem) {
                backlogListContainer.appendChild(draggingItem);
            }
        } else {
            if (afterElement !== draggingItem.nextSibling) { 
                backlogListContainer.insertBefore(draggingItem, afterElement);
            }
        }
    }
}

function handleBacklogDrop(e) {
    e.preventDefault();
    let isCorrectSource = false;
    try {
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) { /* ignore */ }
    if (!isCorrectSource) return;

    const droppedTodoId = e.dataTransfer.getData("text/plain");
    const newOrderedIds = [...backlogListContainer.querySelectorAll('.mv-backlog-todo-item')] // 접두사 적용
        .map(item => item.dataset.todoId);
    data.reorderBacklogTodos(newOrderedIds);
}

export function initBacklog() {
    backlogPanelArea = document.getElementById("backlog-panel-area");
    backlogListContainer = document.getElementById("backlogListContainer");
    showAddTodoFormBtn = document.getElementById("showAddTodoFormBtn");
    addTodoFormContainer = document.getElementById("addTodoFormContainer");
    newTodoTextInput = document.getElementById("newTodoTextInput");
    newTodoPriorityInput = document.getElementById("newTodoPriorityInput");
    saveNewTodoBtn = document.getElementById("saveNewTodoBtn");
    cancelNewTodoBtn = document.getElementById("cancelNewTodoBtn");

    if (!backlogPanelArea) { console.error("Backlog panel area (id: backlog-panel-area) not found!"); return; }
    if (!backlogListContainer) { console.error("Backlog list container (id: backlogListContainer) not found!"); return; }
    
    // HTML 템플릿에서 이미 mv-backlog-list, mv-add-todo-form 등의 클래스가 적용되었다고 가정합니다.
    // 만약 JS에서 동적으로 추가해야 한다면 아래와 같이 합니다.
    // if (backlogListContainer) backlogListContainer.className = "mv-backlog-list";
    // if (addTodoFormContainer) addTodoFormContainer.className = "mv-add-todo-form";
    const controlsDiv = addTodoFormContainer?.querySelector('.add-todo-controls'); // 이 클래스도 템플릿에서 mv-로 시작해야 함
    if (controlsDiv && !controlsDiv.classList.contains('mv-add-todo-controls')) {
         controlsDiv.classList.add('mv-add-todo-controls'); // 혹은 className = "mv-add-todo-controls"
    }


    if(showAddTodoFormBtn) {
        // 이벤트 리스너는 mainViewHandler.js에서 관리합니다.
        // showAddTodoFormBtn.addEventListener("click", () => { ... });
    }
    if(addTodoFormContainer && newTodoTextInput && saveNewTodoBtn && cancelNewTodoBtn) {
        // 폼 내부 버튼 이벤트 리스너도 mainViewHandler.js에서 관리합니다.
    }

    if (backlogListContainer) {
        // 드래그 앤 드롭 리스너는 mainViewHandler.js에서 해당 컨테이너에 직접 추가하고 관리합니다.
        // backlogListContainer.addEventListener('dragover', handleBacklogDragOver);
        // backlogListContainer.addEventListener('drop', handleBacklogDrop);
    }
    console.log("Backlog Module Initialized.");
}