// js/backlog.js
import * as data from "./dataManager.js";

let backlogPanelArea = null;
let backlogListContainer = null;
let showAddTodoFormBtn = null;
let addTodoFormContainer = null;
let newTodoTextInput = null;
let newTodoPriorityInput = null;
let saveNewTodoBtn = null; // 이 변수는 backlog.js 내에서 직접 사용되지 않지만, mainViewHandler.js에서 참조할 수 있음
let cancelNewTodoBtn = null; // 위와 동일

// renderBacklog 함수는 외부에서 호출될 수 있도록 export 유지
export function renderBacklog() {
    if (!backlogListContainer) {
        console.error("Backlog list container not found for rendering! Was initBacklog called and successful?");
        return;
    }
    const state = data.getState();
    const backlogTodos = state.backlogTodos || [];
    backlogListContainer.innerHTML = ""; // 기존 목록 비우기

    // 새 할 일 추가 폼이 있다면, 목록을 다시 그릴 때 목록의 일부로 다시 추가되지 않도록 주의
    // (현재 구조상 addTodoFormContainer는 backlogListContainer의 형제 DOM일 가능성이 높음)

    if (backlogTodos && backlogTodos.length > 0) {
        backlogTodos.forEach((todo) => {
            const todoEl = createTodoElement(todo);
            backlogListContainer.appendChild(todoEl);
        });
    }
}

function createTodoElement(todo) {
    const item = document.createElement("div");
    item.className = "mv-backlog-todo-item";
    item.dataset.todoId = todo.id;
    item.style.borderLeftColor = todo.color;
    item.draggable = true;

    const textContent = document.createElement("div");
    textContent.className = "mv-todo-text-content";
    const textSpan = document.createElement("span");
    textSpan.textContent = todo.text;
    textContent.appendChild(textSpan);

    const priorityDiv = document.createElement("div");
    priorityDiv.className = "mv-todo-priority";
    const priorityInput = document.createElement("input");
    priorityInput.type = "number";
    priorityInput.min = 0; priorityInput.max = 3;
    priorityInput.value = todo.priority;
    priorityInput.title = `Priority: ${todo.priority}`;
    priorityInput.addEventListener("change", () => {
        data.updateBacklogTodoPriority(todo.id, parseInt(priorityInput.value, 10)); // parseInt 추가
    });
    priorityDiv.appendChild(priorityInput);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "mv-todo-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "mv-edit-todo-btn";
    editBtn.innerHTML = "✏️"; editBtn.title = "Edit todo";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mv-delete-todo-btn";
    deleteBtn.innerHTML = "🗑️"; deleteBtn.title = "Delete todo";

    editBtn.addEventListener("click", () => {
        textSpan.style.display = "none";
        const editInput = document.createElement("input");
        editInput.type = "text"; editInput.value = todo.text;
        editInput.className = "mv-backlog-edit-input"; // 편집 input을 위한 클래스 (스타일링용)
        textContent.appendChild(editInput);
        editInput.focus();
        const finishEditing = () => {
            if (!editInput.parentElement) return; // 이미 DOM에서 제거된 경우
            const newText = editInput.value.trim();
            if (newText !== todo.text) { // 변경된 경우에만 업데이트
                data.updateBacklogTodoText(todo.id, newText);
            }
            editInput.remove();
            textSpan.style.display = "inline";
            // renderBacklog(); // dataChanged 이벤트가 처리
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
            // renderBacklog(); // dataChanged 이벤트가 처리
        }
    });
    actionsDiv.append(editBtn, deleteBtn);

    item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.setData("application/x-backlog-source", "true"); // 드래그 소스 식별자
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("mv-dragging");
    });
    item.addEventListener("dragend", () => {
        item.classList.remove("mv-dragging");
    });

    item.append(textContent, priorityDiv, actionsDiv);
    return item;
}

// ▼▼▼ [수정] 이 함수를 외부에서 호출할 수 있도록 export 추가 ▼▼▼
export function handleAddNewTodo() {
    if (!newTodoTextInput || !newTodoPriorityInput || !addTodoFormContainer) {
        console.error("Backlog form elements not found for handleAddNewTodo. Ensure initBacklog has been called and elements exist.");
        return;
    }
    const text = newTodoTextInput.value.trim();
    const priority = parseInt(newTodoPriorityInput.value, 10); // 숫자로 변환

    if (text) {
        data.addBacklogTodo(text, priority); // dataManager를 통해 할 일 추가
        newTodoTextInput.value = ""; // 입력 필드 초기화
        newTodoPriorityInput.value = 0; // 우선순위 초기화 (기본값 0)
        addTodoFormContainer.style.display = "none"; // 폼 숨기기
        // renderBacklog(); // 데이터 변경 이벤트에 의해 renderBacklog가 호출될 것으로 예상
    } else {
        alert("할 일 내용을 입력해주세요.");
        newTodoTextInput.focus();
    }
}

// getDragAfterElement, handleBacklogDragOver, handleBacklogDrop 함수는 그대로 유지
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.mv-backlog-todo-item:not(.mv-dragging)')];
    const result = draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY });
    return result.element;
}

// handleBacklogDragOver 함수는 외부(mainViewHandler.js)에서 사용될 수 있으므로 export (선택 사항)
export function handleBacklogDragOver(e) {
    let isCorrectSource = false;
    try {
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) { /* ignore */ }

    if (isCorrectSource) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const draggingItem = backlogListContainer.querySelector('.mv-dragging');
        if (!draggingItem) return;
        const afterElement = getDragAfterElement(backlogListContainer, e.clientY);
        // 직접 DOM 조작 최소화, 데이터 변경 후 renderBacklog 권장.
        // 여기서는 임시 시각적 피드백으로 DOM을 옮기지만, drop 시 데이터 기준으로 재정렬
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
// handleBacklogDrop 함수는 외부(mainViewHandler.js)에서 사용될 수 있으므로 export (선택 사항)
export function handleBacklogDrop(e) {
    e.preventDefault();
    let isCorrectSource = false;
    try {
        if (e.dataTransfer.types && e.dataTransfer.types.includes("application/x-backlog-source")) {
            isCorrectSource = true;
        }
    } catch (err) { /* ignore */ }
    if (!isCorrectSource) return;

    // const droppedTodoId = e.dataTransfer.getData("text/plain"); // 사용되지 않으므로 주석 처리 가능
    const newOrderedIds = [...backlogListContainer.querySelectorAll('.mv-backlog-todo-item')]
        .map(item => item.dataset.todoId);
    data.reorderBacklogTodos(newOrderedIds); // 데이터 순서 변경 후 dataChanged 이벤트로 renderBacklog 호출 기대
}


export function initBacklog() {
    backlogPanelArea = document.getElementById("backlog-panel-area");
    backlogListContainer = document.getElementById("backlogListContainer");
    showAddTodoFormBtn = document.getElementById("showAddTodoFormBtn");
    addTodoFormContainer = document.getElementById("addTodoFormContainer");
    newTodoTextInput = document.getElementById("newTodoTextInput");
    newTodoPriorityInput = document.getElementById("newTodoPriorityInput");
    saveNewTodoBtn = document.getElementById("saveNewTodoBtn"); // mainViewHandler.js에서 사용
    cancelNewTodoBtn = document.getElementById("cancelNewTodoBtn"); // mainViewHandler.js에서 사용

    if (!backlogPanelArea || !backlogListContainer || !showAddTodoFormBtn || !addTodoFormContainer || !newTodoTextInput || !newTodoPriorityInput || !saveNewTodoBtn || !cancelNewTodoBtn) {
        console.error("One or more Backlog DOM elements are missing! Check HTML IDs.");
        // 필수 요소가 없으면 기능이 제대로 동작하지 않으므로, 여기서 초기화를 중단하거나 사용자에게 알릴 수 있습니다.
        return; // 필수 요소가 없으면 더 이상 진행하지 않음
    }
    
    // 클래스명 설정 (HTML 템플릿에서 이미 설정되어있다면 불필요)
    // 예: backlogListContainer.classList.add("mv-backlog-list");
    // 예: addTodoFormContainer.classList.add("mv-add-todo-form");
    // 예: showAddTodoFormBtn.classList.add("mv-show-form-btn");


    // 주석에 명시된 대로, 실제 이벤트 리스너는 mainViewHandler.js에서 설정합니다.
    // 예시:
    // if (showAddTodoFormBtn && addTodoFormContainer) {
    //    showAddTodoFormBtn.addEventListener("click", () => {
    //      addTodoFormContainer.style.display = "flex"; // 또는 "block"
    //      newTodoTextInput.focus();
    //    });
    // }
    // if (saveNewTodoBtn) {
    //    saveNewTodoBtn.addEventListener("click", handleAddNewTodo); // 이제 export 되었으므로 직접 참조 가능
    // }
    // if (cancelNewTodoBtn && addTodoFormContainer) {
    //    cancelNewTodoBtn.addEventListener("click", () => {
    //      addTodoFormContainer.style.display = "none";
    //      newTodoTextInput.value = "";
    //      newTodoPriorityInput.value = 0;
    //    });
    // }
    // if (backlogListContainer) {
    //    backlogListContainer.addEventListener('dragover', handleBacklogDragOver);
    //    backlogListContainer.addEventListener('drop', handleBacklogDrop);
    // }

    renderBacklog(); // 초기 백로그 목록 렌더링
    console.log("Backlog Module Initialized.");
}