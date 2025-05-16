// todo.js

const TODO_LOCAL_STORAGE_KEY = 'timeLedgerTodos_v2'; // Version bump for new features
let todos = [];
let todoListContainerElement = null; // The element with id="todo-app-container"
let todoULElement = null; // The UL element for todos
let addBtnContainerElement = null; // The container for the add button
let onTodoDataChangeCallback = () => {};
let draggedTodoItem = null; // To store info about the item being dragged

function generateId() {
    return '_t' + Math.random().toString(36).substr(2, 8); // 't' for todo
}

function saveTodosToLocalBackup() {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TODO_LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
    onTodoDataChangeCallback();
}

// Helper function for drag-and-drop to determine insertion point
function getDragAfterElement(containerUL, y) {
    const draggableElements = [...containerUL.querySelectorAll('.todo-item:not(.dragging-todo)')];
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
    todoItemElement.classList.remove('highlight-red', 'highlight-blue'); // 기존 하이라이트 제거
    const numericTime = parseInt(timeValue, 10) || 0;

    if (numericTime >= 30) {
        todoItemElement.classList.add('highlight-red');
    } else if (numericTime > 0 && numericTime < 30) {
        todoItemElement.classList.add('highlight-blue');
    }
    // 0 또는 유효하지 않은 값이면 아무 클래스도 추가하지 않음 (기본 스타일)
}

function createTodoElement(item, index) {
    const li = document.createElement('li');
    li.className = `todo-item ${item.completed ? 'completed' : ''}`;
    li.dataset.id = item.id;
    li.draggable = true;

    applyTimeHighlight(li, item.time); // <<<< 초기 하이라이트 적용

    // Drag and Drop Event Listeners
    li.addEventListener('dragstart', (e) => { /* ... (이전과 동일) ... */ });
    li.addEventListener('dragover', (e) => { /* ... (이전과 동일) ... */ });
    li.addEventListener('dragleave', (e) => { /* ... (이전과 동일) ... */ });
    li.addEventListener('drop', (e) => { /* ... (이전과 동일) ... */ });
    li.addEventListener('dragend', () => { /* ... (이전과 동일) ... */ });

    const numberSpan = document.createElement('span');
    numberSpan.className = 'todo-number';
    numberSpan.textContent = `${index + 1}. `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = item.completed;
    checkbox.addEventListener('change', () => {
        item.completed = checkbox.checked;
        li.classList.toggle('completed', item.completed);
        textInput.classList.toggle('completed', item.completed);
        saveTodosToLocalBackup();
    });

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'todo-text-input';
    if (item.completed) textInput.classList.add('completed');
    textInput.value = item.text;
    textInput.placeholder = 'Enter task...';
    textInput.addEventListener('input', () => {
        item.text = textInput.value;
        saveTodosToLocalBackup();
    });
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') textInput.blur(); });

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'todo-controls';

    const importanceInput = document.createElement('input');
    importanceInput.type = 'number';
    importanceInput.className = 'todo-importance';
    importanceInput.min = 0; importanceInput.max = 3;
    importanceInput.value = item.importance;
    importanceInput.title = "Importance (0-3)";
    importanceInput.addEventListener('change', () => {
        item.importance = parseInt(importanceInput.value) || 0;
        saveTodosToLocalBackup();
    });

    const timeLabel = document.createElement('label');
    timeLabel.className = 'todo-time-label';
    timeLabel.innerHTML = '⏱️ ';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.className = 'todo-time';
    timeInput.min = 0;
    timeInput.value = item.time;
    timeInput.title = "Estimated time (minutes)";
    timeInput.addEventListener('change', () => { // 'input' 이벤트로 변경하면 더 즉각적일 수 있음
        const newTime = parseInt(timeInput.value) || 0;
        item.time = newTime;
        applyTimeHighlight(li, newTime); // <<<< 시간 변경 시 하이라이트 업데이트
        saveTodosToLocalBackup();
    });
    timeLabel.appendChild(timeInput);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'todo-delete-btn';
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
    todoULElement.innerHTML = ''; 
    todos.forEach((item, index) => {
        todoULElement.appendChild(createTodoElement(item, index));
    });
}


export function initTodoApp(containerSelector, initialData = null, dataChangedCallback = () => {}) {
    // ... (이전과 동일한 initTodoApp 상단부: container, todoULElement, addBtnContainerElement 설정) ...
    const container = document.querySelector(containerSelector);
    if (!container) { console.error(`TODO app container "${containerSelector}" not found.`); return; }
    todoListContainerElement = container; onTodoDataChangeCallback = dataChangedCallback;
    todoULElement = todoListContainerElement.querySelector('.todo-list');
    if (!todoULElement) { todoULElement = document.createElement('ul'); todoULElement.className = 'todo-list'; todoListContainerElement.appendChild(todoULElement); }
    addBtnContainerElement = todoListContainerElement.querySelector('#add-todo-btn-container');
    if (!addBtnContainerElement) {
        addBtnContainerElement = document.createElement('div'); addBtnContainerElement.id = 'add-todo-btn-container';
        const addButton = document.createElement('button'); addButton.id = 'add-todo-btn'; addButton.textContent = 'Add New TODO';
        addButton.addEventListener('click', () => { /* ... (새 항목 추가 로직) ... */
            const newItem = { id: generateId(), text: '', importance: 0, time: 0, completed: false };
            todos.push(newItem); saveTodosToLocalBackup(); renderTodoListInternal();
            const newInputs = todoULElement.querySelectorAll('.todo-text-input');
            if (newInputs.length > 0) newInputs[newInputs.length - 1].focus();
        });
        addBtnContainerElement.appendChild(addButton); todoListContainerElement.appendChild(addBtnContainerElement);
    }

    if (initialData && Array.isArray(initialData)) { todos = initialData; }
    else {
        const storedTodos = (typeof localStorage !== 'undefined') ? localStorage.getItem(TODO_LOCAL_STORAGE_KEY) : null;
        if (storedTodos) { try { todos = JSON.parse(storedTodos); } catch(e) { todos = [];} }
        if (!todos || todos.length === 0) {
            todos = [ { id: generateId(), text: 'Sample Task 1', importance: 1, time: 15, completed: false }, { id: generateId(), text: 'Sample Task 2', importance: 2, time: 45, completed: true }, ];
        }
    }
    saveTodosToLocalBackup();
    renderTodoListInternal();
}

export function setTodoDataAndRender(newTodoData) {
    todos = Array.isArray(newTodoData) ? newTodoData : [];
    saveTodosToLocalBackup();
    renderTodoListInternal();
}

export function getTodoData() {
    // Filter out placeholder empty new todos before saving, unless it's the only one.
    if (todos.length > 1) {
        return todos.filter(todo => todo.text.trim() !== '' || todo.importance !== 0 || todo.time !== 0 || todo.completed);
    } else if (todos.length === 1 && (todos[0].text.trim() !== '' || todos[0].importance !== 0 || todos[0].time !== 0 || todos[0].completed)) {
        return [...todos];
    } else if (todos.length === 1 && todos[0].text.trim() === '' && todos[0].importance === 0 && todos[0].time === 0 && !todos[0].completed) {
        return []; 
    }
    return [...todos];
}