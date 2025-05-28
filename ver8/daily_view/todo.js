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
}

function createTodoElement(item, index) {
    const li = document.createElement('li');
    li.className = `todo-item ${item.completed ? 'completed' : ''}`;
    li.dataset.id = item.id;
    li.draggable = true; // Make the list item draggable

    applyTimeHighlight(li, item.time);

    // Drag and Drop Event Listeners for LI elements
    li.addEventListener('dragstart', (e) => {
        draggedTodoId = item.id;
        e.target.classList.add('dragging-todo');
        console.log(`[TODO.JS] DRAGSTART for item: ${item.text}, ID: ${item.id}`); // 로그 추가
    
        try {
            const todoDataForTimeline = {
                type: 'todo-item-for-timeline',
                id: item.id,
                text: item.text,
                time: item.time || 0
            };
            const dataString = JSON.stringify(todoDataForTimeline);
            e.dataTransfer.setData('application/json', dataString);
            e.dataTransfer.effectAllowed = 'copyMove'; // 또는 'copyMove'
            console.log(`[TODO.JS] Data set for timeline: ${dataString}. effectAllowed: ${e.dataTransfer.effectAllowed}`); // 로그 추가
        } catch (err) {
            console.error('[TODO.JS] Error in dragstart setData:', err);
        }
    });

    li.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging-todo');
        // Clean up any lingering drag-over classes on all items in the UL
        if (todoULElement) {
            todoULElement.querySelectorAll('.todo-item.drag-over-todo').forEach(el => {
                el.classList.remove('drag-over-todo');
            });
        }
        draggedTodoId = null;
    });

    // Note: 'dragover' and 'drop' events are primarily handled by the parent UL (todoULElement)
    // to manage the overall list reordering. Individual LIs could have 'dragenter'/'dragleave'
    // for more granular feedback, but the current approach with UL handling is often simpler.

    const numberSpan = document.createElement('span');
    numberSpan.className = 'todo-number';
    numberSpan.textContent = `${index + 1}. `; // Numbering based on current index

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
    textInput.addEventListener('input', () => { // Save on input for more real-time feel
        item.text = textInput.value;
        saveTodosToLocalBackup();
    });
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') textInput.blur(); });
    textInput.addEventListener('blur', () => { // Also save on blur
        item.text = textInput.value; // Ensure final value is captured
        saveTodosToLocalBackup();
    });

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
    timeInput.addEventListener('change', () => {
        const newTime = parseInt(timeInput.value) || 0;
        item.time = newTime;
        applyTimeHighlight(li, newTime);
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

    // Preserve focus if possible
    const focusedElement = document.activeElement;
    const focusedTodoId = focusedElement?.closest('.todo-item')?.dataset.id;
    const selectionStart = focusedElement?.selectionStart;
    const selectionEnd = focusedElement?.selectionEnd;

    todoULElement.innerHTML = '';
    todos.forEach((item, index) => {
        todoULElement.appendChild(createTodoElement(item, index));
    });

    // Restore focus
    if (focusedTodoId && focusedElement?.classList.contains('todo-text-input')) {
        const newFocusedElement = todoULElement.querySelector(`.todo-item[data-id="${focusedTodoId}"] .todo-text-input`);
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

    todoULElement = todoListContainerElement.querySelector('.todo-list');
    if (!todoULElement) {
        todoULElement = document.createElement('ul');
        todoULElement.className = 'todo-list';
        todoListContainerElement.appendChild(todoULElement);
    }

    // --- Drag and Drop Event Listeners for the UL element ---
    todoULElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping.
        if (!draggedTodoId) return; // Only proceed if a todo is being dragged.

        const afterElement = getDragAfterElement(todoULElement, e.clientY);

        // Clear previous 'drag-over-todo' markers from other items.
        const currentOverElement = todoULElement.querySelector('.drag-over-todo');
        if (currentOverElement && currentOverElement !== afterElement) {
            currentOverElement.classList.remove('drag-over-todo');
        }

        if (afterElement) {
            // Add 'drag-over-todo' to the element we are about to insert before.
            // Do not add to the element being dragged itself.
            if (afterElement.dataset.id !== draggedTodoId) {
                 afterElement.classList.add('drag-over-todo');
            }
        } else {
            // If no 'afterElement', means dragging to the end.
            // You could add a class to the last item or UL for visual feedback if desired.
            // For now, the `drag-over-todo` on the element it would go above is the primary indicator.
        }
        e.dataTransfer.dropEffect = 'move'; // Visual cue for the user.
    });

    todoULElement.addEventListener('dragleave', (e) => {
        // This event can be tricky as it fires when moving over child elements.
        // It's often more reliable to manage removal of 'drag-over-todo' in 'dragover' or 'drop'/'dragend'.
        // However, if the mouse truly leaves the UL area:
        if (e.target === todoULElement && !todoULElement.contains(e.relatedTarget)) {
            const currentOverElement = todoULElement.querySelector('.drag-over-todo');
            if (currentOverElement) {
                currentOverElement.classList.remove('drag-over-todo');
            }
        }
    });

    todoULElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedTodoId) return; // No item was being dragged.

        const currentOverElement = todoULElement.querySelector('.drag-over-todo');
        if (currentOverElement) {
            currentOverElement.classList.remove('drag-over-todo');
        }

        const draggedItemIndex = todos.findIndex(todo => todo.id === draggedTodoId);
        if (draggedItemIndex === -1) { // Should not happen if dragstart was correct.
            draggedTodoId = null;
            return;
        }

        const [draggedItem] = todos.splice(draggedItemIndex, 1); // Remove item from old position.

        const afterElement = getDragAfterElement(todoULElement, e.clientY);

        if (afterElement) {
            const afterElementId = afterElement.dataset.id;
            const targetIndex = todos.findIndex(todo => todo.id === afterElementId);
            if (targetIndex !== -1) {
                todos.splice(targetIndex, 0, draggedItem); // Insert at new position.
            } else {
                // Fallback: if target not found (e.g., element removed mid-drag), add to end.
                todos.push(draggedItem);
            }
        } else {
            // Dropped at the end of the list.
            todos.push(draggedItem);
        }

        // draggedTodoId is reset in the 'dragend' event of the LI.
        saveTodosToLocalBackup();
        renderTodoListInternal(); // Re-render to show new order and updated numbers.
    });
    // --- End of Drag and Drop UL Listeners ---

    addBtnContainerElement = todoListContainerElement.querySelector('#add-todo-btn-container');
    if (!addBtnContainerElement) {
        addBtnContainerElement = document.createElement('div');
        addBtnContainerElement.id = 'add-todo-btn-container';
        const addButton = document.createElement('button');
        addButton.id = 'add-todo-btn';
        addButton.textContent = 'Add New TODO';
        addButton.addEventListener('click', () => {
            const newItem = { id: generateId(), text: '', importance: 0, time: 0, completed: false };
            todos.push(newItem);
            saveTodosToLocalBackup();
            renderTodoListInternal();
            const newInputs = todoULElement.querySelectorAll('.todo-text-input');
            if (newInputs.length > 0) {
                const lastInput = newInputs[newInputs.length - 1];
                // Focus only if the new task isn't somehow already completed
                if (!lastInput.classList.contains('completed')) {
                    lastInput.focus();
                }
            }
        });
        addBtnContainerElement.appendChild(addButton);
        todoListContainerElement.appendChild(addBtnContainerElement);
    }
    setTodoDataAndRender(initialData || []);
}

export function setTodoDataAndRender(newTodoData) {
    todos = Array.isArray(newTodoData) ? newTodoData.map(todo => ({ ...todo, id: todo.id || generateId() })) : [];
    // saveTodosToLocalBackup();
    renderTodoListInternal();
}

export function getTodoData() {
    // Filter out truly empty placeholder todos before saving,
    // unless it's the only one (allowing a user to start with a blank item).
    const filteredTodos = todos.filter(todo => {
        const isEffectivelyEmpty =
            todo.text.trim() === '' &&
            (todo.importance === 0 || typeof todo.importance === 'undefined') &&
            (todo.time === 0 || typeof todo.time === 'undefined') &&
            !todo.completed;

        // Keep if it's not effectively empty, OR if it's the only item in the list.
        return !isEffectivelyEmpty || todos.length === 1;
    });

    // If the above filter results in an empty list, but the original list had one effectively empty item,
    // return an empty list (as per the filter logic: !isEffectivelyEmpty OR todos.length === 1)
    // If all items were effectively empty and there were more than one, they'd all be removed.
    if (filteredTodos.length === 0 && todos.length > 0 && todos.every(todo =>
        todo.text.trim() === '' &&
        (todo.importance === 0 || typeof todo.importance === 'undefined') &&
        (todo.time === 0 || typeof todo.time === 'undefined') &&
        !todo.completed
    )) {
        return [];
    }
    return [...filteredTodos]; // Return a copy
}