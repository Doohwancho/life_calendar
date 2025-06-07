// todo.js

let todos = [];
let todoListContainerElement = null; // The element with id="todo-app-container"
let todoULElement = null; // The UL element for todos
let addBtnContainerElement = null; // The container for the add button
let onTodoDataChangeCallback = () => {};
let draggedTodoId = null; // Store the ID of the todo item being dragged

function generateId() {
    // Using a slightly longer random string for better uniqueness
    return '_t' + Math.random().toString(36).substring(2, 11);
}

function saveTodosToLocalBackup() {
    onTodoDataChangeCallback();
}

// Helper function for drag-and-drop to determine insertion point
function getDragAfterElement(containerUL, y) {
    // << 수정됨: dv- 접두사 추가
    const draggableElements = [...containerUL.querySelectorAll('.dv-todo-item:not(.dragging-todo)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function applyTimeHighlight(todoItemElement, timeValue) {
    // << 수정됨: dv- 접두사 추가
    todoItemElement.classList.remove('dv-highlight-red', 'dv-highlight-blue'); // 기존 하이라이트 제거
    const numericTime = parseInt(timeValue, 10) || 0;

    if (numericTime >= 30) {
        todoItemElement.classList.add('dv-highlight-red'); // << 수정됨
    } else if (numericTime > 0 && numericTime < 30) {
        todoItemElement.classList.add('dv-highlight-blue'); // << 수정됨
    }
}

function createTodoElement(item, index) {
    const li = document.createElement('li');
    // << 수정됨: dv- 접두사 추가
    li.className = `dv-todo-item ${item.completed ? 'completed' : ''}`;
    li.dataset.id = item.id;
    li.draggable = true;

    applyTimeHighlight(li, item.time);

    li.addEventListener('dragstart', (e) => {
        draggedTodoId = item.id;
        e.target.classList.add('dragging-todo'); // 상태 클래스이므로 접두사 없음
        console.log(`[TODO.JS] DRAGSTART for item: ${item.text}, ID: ${item.id}`);
    
        try {
            const todoDataForTimeline = {
                type: 'todo-item-for-timeline',
                id: item.id,
                text: item.text,
                time: item.time || 0
            };
            const dataString = JSON.stringify(todoDataForTimeline);
            e.dataTransfer.setData('application/json', dataString);
            e.dataTransfer.effectAllowed = 'copyMove';
            console.log(`[TODO.JS] Data set for timeline: ${dataString}. effectAllowed: ${e.dataTransfer.effectAllowed}`);
        } catch (err) {
            console.error('[TODO.JS] Error in dragstart setData:', err);
        }
    });

    li.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging-todo');
        if (todoULElement) {
            // << 수정됨: dv- 접두사 추가
            todoULElement.querySelectorAll('.dv-todo-item.dv-drag-over-todo').forEach(el => {
                el.classList.remove('dv-drag-over-todo');
            });
        }
        draggedTodoId = null;
    });

    const numberSpan = document.createElement('span');
    numberSpan.className = 'dv-todo-number'; // << 수정됨
    numberSpan.textContent = `${index + 1}. `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dv-todo-checkbox'; // << 수정됨
    checkbox.checked = item.completed;
    checkbox.addEventListener('change', () => {
        item.completed = checkbox.checked;
        li.classList.toggle('completed', item.completed);
        textInput.classList.toggle('completed', item.completed);
        saveTodosToLocalBackup();
    });

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'dv-todo-text-input'; // << 수정됨
    if (item.completed) textInput.classList.add('completed');
    textInput.value = item.text;
    textInput.placeholder = 'Enter task...';
    textInput.addEventListener('input', () => {
        item.text = textInput.value;
        saveTodosToLocalBackup();
    });
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') textInput.blur(); });
    textInput.addEventListener('blur', () => {
        item.text = textInput.value;
        saveTodosToLocalBackup();
    });

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'dv-todo-controls'; // << 수정됨

    const importanceInput = document.createElement('input');
    importanceInput.type = 'number';
    importanceInput.className = 'dv-todo-importance'; // << 수정됨
    importanceInput.min = 0; importanceInput.max = 3;
    importanceInput.value = item.importance;
    importanceInput.title = "Importance (0-3)";
    importanceInput.addEventListener('change', () => {
        item.importance = parseInt(importanceInput.value) || 0;
        saveTodosToLocalBackup();
    });

    const timeLabel = document.createElement('label');
    timeLabel.className = 'dv-todo-time-label'; // << 수정됨
    timeLabel.innerHTML = '⏱️ ';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.className = 'dv-todo-time'; // << 수정됨
    timeInput.min = 0;
    timeInput.value = item.time;
    timeInput.title = "Estimated time (minutes)";
    timeInput.addEventListener('change', () => {
        const newTime = parseInt(timeInput.value) || 0;
        item.time = newTime;
        applyTimeHighlight(li, newTime);
        saveTodosToLocalBackup();
    });
    timeLabel.appendChild(timeInput);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'dv-todo-delete-btn'; // << 수정됨
    deleteButton.textContent = 'Del';
    deleteButton.addEventListener('click', () => {
        todos = todos.filter(t => t.id !== item.id);
        saveTodosToLocalBackup();
        renderTodoListInternal();
    });

    controlsDiv.appendChild(importanceInput);
    controlsDiv.appendChild(timeLabel);
    controlsDiv.appendChild(deleteButton);

    li.appendChild(numberSpan);
    li.appendChild(checkbox);
    li.appendChild(textInput);
    li.appendChild(controlsDiv);

    return li;
}

function renderTodoListInternal() {
    if (!todoULElement) return;

    // Preserve focus if possible (기존 포커스 로직 유지)
    const focusedElement = document.activeElement;
    const focusedTodoId = focusedElement?.closest('.dv-todo-item')?.dataset.id;
    const selectionStart = focusedElement?.selectionStart;
    const selectionEnd = focusedElement?.selectionEnd;

    todoULElement.innerHTML = ''; // 기존 목록 아이템들 (및 버튼이 있었다면 버튼도) 지우기
    
    todos.forEach((item, index) => {
        todoULElement.appendChild(createTodoElement(item, index)); // 목록 아이템들 다시 추가
    });

    if (addBtnContainerElement) { 
        // addBtnContainerElement는 initTodoApp에서 이미 생성되어 있어야 합니다.
        todoULElement.appendChild(addBtnContainerElement);
    }

    // Restore focus (기존 포커스 로직 유지)
    if (focusedTodoId && focusedElement?.classList.contains('dv-todo-text-input')) {
        const newFocusedElement = todoULElement.querySelector(`.dv-todo-item[data-id="${focusedTodoId}"] .dv-todo-text-input`);
        if (newFocusedElement) {
            newFocusedElement.focus();
            if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
                newFocusedElement.setSelectionRange(selectionStart, selectionEnd);
            }
        }
    }
}


export function initTodoApp(containerSelector, initialData = null, dataChangedCallback = () => {}) {
    const container = document.querySelector(containerSelector);
    if (!container) { console.error(`TODO app container "${containerSelector}" not found.`); return; }
    todoListContainerElement = container;
    onTodoDataChangeCallback = dataChangedCallback;

    todoULElement = todoListContainerElement.querySelector('.dv-todo-list');
    if (!todoULElement) {
        todoULElement = document.createElement('ul');
        todoULElement.className = 'dv-todo-list';
        todoListContainerElement.appendChild(todoULElement);
    }

    todoULElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedTodoId) return;

        const afterElement = getDragAfterElement(todoULElement, e.clientY);

        // << 수정됨: dv- 접두사 추가
        const currentOverElement = todoULElement.querySelector('.dv-drag-over-todo');
        if (currentOverElement && currentOverElement !== afterElement) {
            currentOverElement.classList.remove('dv-drag-over-todo');
        }

        if (afterElement) {
            if (afterElement.dataset.id !== draggedTodoId) {
                 afterElement.classList.add('dv-drag-over-todo'); // << 수정됨
            }
        }
        e.dataTransfer.dropEffect = 'move';
    });

    todoULElement.addEventListener('dragleave', (e) => {
        if (e.target === todoULElement && !todoULElement.contains(e.relatedTarget)) {
            // << 수정됨: dv- 접두사 추가
            const currentOverElement = todoULElement.querySelector('.dv-drag-over-todo');
            if (currentOverElement) {
                currentOverElement.classList.remove('dv-drag-over-todo');
            }
        }
    });

    todoULElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedTodoId) return;

        // << 수정됨: dv- 접두사 추가
        const currentOverElement = todoULElement.querySelector('.dv-drag-over-todo');
        if (currentOverElement) {
            currentOverElement.classList.remove('dv-drag-over-todo');
        }

        const draggedItemIndex = todos.findIndex(todo => todo.id === draggedTodoId);
        if (draggedItemIndex === -1) {
            draggedTodoId = null;
            return;
        }

        const [draggedItem] = todos.splice(draggedItemIndex, 1);
        const afterElement = getDragAfterElement(todoULElement, e.clientY);

        if (afterElement) {
            const afterElementId = afterElement.dataset.id;
            const targetIndex = todos.findIndex(todo => todo.id === afterElementId);
            if (targetIndex !== -1) {
                todos.splice(targetIndex, 0, draggedItem);
            } else {
                todos.push(draggedItem);
            }
        } else {
            todos.push(draggedItem);
        }

        saveTodosToLocalBackup();
        renderTodoListInternal();
    });

    // << 수정됨: ID를 클래스로 변경 및 dv- 접두사 추가
    addBtnContainerElement = todoListContainerElement.querySelector('.dv-add-todo-btn-container');
    if (!addBtnContainerElement) {
        addBtnContainerElement = document.createElement('div');
        addBtnContainerElement.className = 'dv-add-todo-btn-container'; // 클래스명 사용
        const addButton = document.createElement('button');
        addButton.className = 'dv-add-todo-btn'; // 클래스명 사용
        addButton.textContent = 'Add New TODO';
        addButton.addEventListener('click', () => {
            const newItem = { id: generateId(), text: '', importance: 0, time: 0, completed: false };
            todos.push(newItem);
            saveTodosToLocalBackup();
            renderTodoListInternal();
            const newInputs = todoULElement.querySelectorAll('.dv-todo-text-input');
            if (newInputs.length > 0) {
                const lastInput = newInputs[newInputs.length - 1];
                if (!lastInput.classList.contains('completed')) {
                    lastInput.focus();
                }
            }
        });
        addBtnContainerElement.appendChild(addButton);

        // ▼▼▼ [중요] 버튼 컨테이너 추가 위치 변경 ▼▼▼
        if (todoULElement) { // UL 요소가 확실히 존재할 때
            todoULElement.appendChild(addBtnContainerElement); // UL의 마지막 자식으로 추가
        } else {
            // 비상시 원래 위치 (하지만 이 경우는 거의 없음)
            todoListContainerElement.appendChild(addBtnContainerElement);
        }
        // ▲▲▲ [중요] 버튼 컨테이너 추가 위치 변경 ▲▲▲
    }
    setTodoDataAndRender(initialData || []);
}

export function setTodoDataAndRender(newTodoData) {
    todos = Array.isArray(newTodoData) ? newTodoData.map(todo => ({ ...todo, id: todo.id || generateId() })) : [];
    renderTodoListInternal();
}

export function getTodoData() {
    const filteredTodos = todos.filter(todo => {
        const isEffectivelyEmpty =
            todo.text.trim() === '' &&
            (todo.importance === 0 || typeof todo.importance === 'undefined') &&
            (todo.time === 0 || typeof todo.time === 'undefined') &&
            !todo.completed;
        return !isEffectivelyEmpty || todos.length === 1;
    });
    
    if (filteredTodos.length === 0 && todos.length > 0 && todos.every(todo =>
        todo.text.trim() === '' &&
        (todo.importance === 0 || typeof todo.importance === 'undefined') &&
        (todo.time === 0 || typeof todo.time === 'undefined') &&
        !todo.completed
    )) {
        return [];
    }
    return [...filteredTodos];
}