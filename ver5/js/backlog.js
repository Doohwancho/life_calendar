import * as data from './dataManager.js';
import { PRIORITY_COLORS } from './constants.js';
import { generateId } from './uiUtils.js';

const backlogPanelArea = document.getElementById('backlog-panel-area');
// const addBacklogTodoBtn = document.getElementById('addBacklogTodoBtn'); // Assuming it's in HTML
const backlogListContainer = document.getElementById('backlogListContainer');
const showAddTodoFormBtn = document.getElementById('showAddTodoFormBtn');
const addTodoFormContainer = document.getElementById('addTodoFormContainer');
const newTodoTextInput = document.getElementById('newTodoTextInput');
const newTodoPriorityInput = document.getElementById('newTodoPriorityInput');
const saveNewTodoBtn = document.getElementById('saveNewTodoBtn');
const cancelNewTodoBtn = document.getElementById('cancelNewTodoBtn');


// Placeholder for rendering backlog items
export function renderBacklog() {
    if (!backlogListContainer) {
        console.error("Backlog list container not found for rendering!");
        return;
    }
    
    const { backlogTodos } = data.getState(); // getState() 사용
    backlogListContainer.innerHTML = ''; // 이전 목록 지우기

    if (backlogTodos.length === 0) {
        // Optional: Display a message when backlog is empty
        // backlogListContainer.innerHTML = "<p class='empty-backlog-message'>No backlog items yet.</p>";
    } else {
        backlogTodos.forEach(todo => {
            const todoEl = createTodoElement(todo); // 이미 파일 내에 있는 함수 사용
            backlogListContainer.appendChild(todoEl);
        });
    }
}

// Placeholder for CRUD operations for backlog todos
// Placeholder for drag/drop functionality

// initBacklog();

/**
 * Creates a DOM element for a single todo item.
 * @param {object} todo - The todo object from dataManager.
 * @returns {HTMLElement}
 */
function createTodoElement(todo) {
    const item = document.createElement('div');
    item.className = 'backlog-todo-item';
    item.dataset.todoId = todo.id;
    item.style.borderLeftColor = todo.color;
    item.draggable = true;

    // Todo Text Content
    const textContent = document.createElement('div');
    textContent.className = 'todo-text-content';
    const textSpan = document.createElement('span');
    textSpan.textContent = todo.text;
    textContent.appendChild(textSpan);
    
    // Priority Input
    const priorityDiv = document.createElement('div');
    priorityDiv.className = 'todo-priority';
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.min = 0;
    priorityInput.max = 3;
    priorityInput.value = todo.priority;
    priorityInput.title = `Priority: ${todo.priority}`;
    priorityInput.addEventListener('change', () => {
        data.updateBacklogTodoPriority(todo.id, priorityInput.value);
        renderBacklog(); // Re-render to update color and potentially order
    });
    priorityDiv.appendChild(priorityInput);

    // Action Buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'todo-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-todo-btn';
    editBtn.innerHTML = '✏️'; // Edit icon
    editBtn.title = 'Edit todo';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-todo-btn';
    deleteBtn.innerHTML = '🗑️'; // Delete icon
    deleteBtn.title = 'Delete todo';

    // Edit functionality
    editBtn.addEventListener('click', () => {
        textSpan.style.display = 'none';
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.value = todo.text;
        textContent.appendChild(editInput);
        editInput.focus();

        const finishEditing = () => {
            data.updateBacklogTodoText(todo.id, editInput.value);
            textSpan.textContent = editInput.value;
            editInput.remove();
            textSpan.style.display = 'inline';
        };

        editInput.addEventListener('blur', finishEditing);
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEditing();
            if (e.key === 'Escape') {
                editInput.remove();
                textSpan.style.display = 'inline';
            }
        });
    });

    // Delete functionality
    deleteBtn.addEventListener('click', () => {
        if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
            data.deleteBacklogTodo(todo.id);
            renderBacklog();
        }
    });

    actionsDiv.append(editBtn, deleteBtn);

    // Drag & Drop (Phase 7 will handle dropping)
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', todo.id);
        e.dataTransfer.setData('source', 'backlog');
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });

    item.append(textContent, priorityDiv, actionsDiv);
    return item;
}



function handleAddNewTodo() {
    const text = newTodoTextInput.value.trim();
    const priority = newTodoPriorityInput.value;
    if (text) {
        data.addBacklogTodo(text, priority);
        renderBacklog();
        // Reset and hide form
        newTodoTextInput.value = '';
        newTodoPriorityInput.value = 0;
        addTodoFormContainer.style.display = 'none';
    }
}

export function initBacklog() {
    if (!backlogPanelArea) {
        console.error("Backlog panel area not found!");
        return;
    }
    
    showAddTodoFormBtn.addEventListener('click', () => {
        addTodoFormContainer.style.display = 'flex';
        newTodoTextInput.focus();
    });

    cancelNewTodoBtn.addEventListener('click', () => {
        addTodoFormContainer.style.display = 'none';
        newTodoTextInput.value = '';
    });

    saveNewTodoBtn.addEventListener('click', handleAddNewTodo);
    newTodoTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddNewTodo();
    });

    console.log("Backlog Module Initialized.");
}