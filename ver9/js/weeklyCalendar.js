// js/weeklyCalendar.js
import * as data from "./dataManager.js";
import {
    formatDate,
    getMondayOfWeek,
    getDayNameKO,
    isSameDate,
} from "./uiUtils.js";

let weeklyCalendarArea = null;
const today = new Date();
today.setHours(0, 0, 0, 0);

let draggedTodoId = null;
let draggedTodoOriginalDate = null;

export function renderWeeklyCalendar(weekStartDate) {
    if (!weeklyCalendarArea) {
        console.error("[renderWeeklyCalendar] weeklyCalendarArea is not initialized. Call initWeeklyCalendar first.");
        return;
    }
    weeklyCalendarArea.innerHTML = "";

    const header = document.createElement("header");
    header.className = "mv-weekly-header"; // 접두사 적용
    const grid = document.createElement("div");
    grid.className = "mv-weekly-grid";   // 접두사 적용

    const datesOfWeek = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        datesOfWeek.push(date);
        const dayHeaderEl = document.createElement("div");
        dayHeaderEl.className = "mv-weekly-day-header"; // 접두사 적용
        dayHeaderEl.innerHTML = `${date.getDate()}<br>${getDayNameKO(date)}`;
        if (isSameDate(date, today)) dayHeaderEl.style.color = "#007bff"; // 특정 스타일은 유지
        header.appendChild(dayHeaderEl);
    }

    datesOfWeek.forEach((date) => {
        const dateStr = formatDate(date);
        const dayCell = document.createElement("div");
        dayCell.className = "mv-weekly-day-cell"; // 접두사 적용
        dayCell.dataset.date = dateStr;
        if (isSameDate(date, today)) dayCell.classList.add("mv-today"); // 접두사 적용

        const cellHeader = document.createElement("div");
        cellHeader.className = "mv-weekly-cell-header"; // 접두사 적용
        const addTodoBtn = document.createElement("button");
        addTodoBtn.className = "mv-add-todo-in-weekly"; // 접두사 적용
        addTodoBtn.textContent = "+";
        addTodoBtn.title = "Add Todo";
        // addTodoBtn에 대한 이벤트 리스너는 mainViewHandler.js에서 DOM 생성 후 추가하는 것이 좋습니다.
        // 여기서는 구조만 생성하고, 이벤트 리스너는 initMainCalendarView 내에서 위임하거나 직접 추가.
        // 일단 기존 로직 유지하되, mainViewHandler에서 관리하는 activeEventListeners에 추가해야 함.
        addTodoBtn.addEventListener("click", (e) => handleAddTodoInWeekly(e, dateStr));
        cellHeader.append(addTodoBtn);

        const cellContentContainer = document.createElement("div");
        cellContentContainer.className = "mv-weekly-cell-content"; // 접두사 적용
        renderWeeklyDayCellContent(dateStr, cellContentContainer);
        
        dayCell.append(cellHeader, cellContentContainer);
        // drag & drop 리스너들도 mainViewHandler에서 관리하거나, 여기서 추가 시 activeEventListeners에 등록
        dayCell.addEventListener("dragover", handleCellDragOver);
        dayCell.addEventListener("dragleave", handleCellDragLeave);
        dayCell.addEventListener("drop", handleCellDrop);
        grid.appendChild(dayCell);
    });
    weeklyCalendarArea.append(header, grid);
}

export function initWeeklyCalendar() {
    weeklyCalendarArea = document.getElementById("weekly-calendar-area"); // 템플릿의 ID
    if (!weeklyCalendarArea) {
        console.error("Weekly calendar area (id: weekly-calendar-area) not found!");
        return;
    }
    // HTML 템플릿에서 <section id="weekly-calendar-area" class="mv-grid-area mv-weekly-view"> 로
    // mv-weekly-view 클래스가 이미 적용되어 있다고 가정합니다.
    console.log("Weekly Calendar Initialized with area:", weeklyCalendarArea);
}

function renderWeeklyDayCellContent(dateStr, cellContentContainer) {
    cellContentContainer.innerHTML = "";
    const state = data.getState();
    const events = state.events || [];
    const labels = state.labels || [];
    const todosForDay = data.getTodosForDate(dateStr) || [];
    const itemsToRender = [];

    events.forEach((event) => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        const currentDate = new Date(dateStr);
        eventStartDate.setHours(0,0,0,0); eventEndDate.setHours(0,0,0,0); currentDate.setHours(0,0,0,0);
        if (currentDate >= eventStartDate && currentDate <= eventEndDate) {
            const label = labels.find((l) => l.id === event.labelId);
            itemsToRender.push({
                ...event, itemType: "project",
                displayName: label ? label.name : "Project",
                displayColor: label ? label.color : "#ccc",
            });
        }
    });

    todosForDay.forEach((todo) => {
        itemsToRender.push({
            ...todo,
            date: dateStr, 
            itemType: "todo",
            displayName: todo.text,
            displayColor: todo.color,
        });
    });

    itemsToRender.sort((a, b) => {
        if (a.itemType === "project" && b.itemType !== "project") return -1;
        if (a.itemType !== "project" && b.itemType === "project") return 1;
        return 0;
    });

    itemsToRender.forEach((item) => {
        const itemEl = (item.itemType === 'project')
            ? createWeeklyProjectElement(item)
            : createWeeklyTodoElement(item);
        cellContentContainer.appendChild(itemEl);
    });
}

function createWeeklyProjectElement(item) {
    const itemEl = document.createElement("div");
    itemEl.className = "mv-project-bar-weekly"; // 접두사 적용
    itemEl.style.backgroundColor = item.displayColor;
    itemEl.textContent = item.displayName;
    itemEl.title = item.displayName;
    return itemEl;
}

function createWeeklyTodoElement(todo) {
    const item = document.createElement("div");
    item.className = "mv-weekly-todo-item"; // 접두사 적용
    item.style.backgroundColor = todo.color || "#6c757d";
    item.dataset.todoId = todo.id;
    item.draggable = true;

    const textSpan = document.createElement("span");
    textSpan.className = "mv-todo-text-display"; // 접두사 적용
    textSpan.textContent = todo.text;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "mv-todo-actions"; // 접두사 적용
    const editBtn = document.createElement("button");
    // editBtn.className = "mv-edit-btn"; // 더 구체적인 클래스 사용 가능
    editBtn.innerHTML = "✏️"; editBtn.title = "Edit Todo";
    const deleteBtn = document.createElement("button");
    // deleteBtn.className = "mv-delete-btn";
    deleteBtn.innerHTML = "🗑️"; deleteBtn.title = "Delete Todo";

    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.querySelector(".mv-todo-edit-input")) return; // 접두사 적용
        textSpan.style.display = "none";
        actionsDiv.style.display = "none"; 
        const editInput = document.createElement("input");
        editInput.type = "text"; editInput.value = todo.text;
        editInput.className = "mv-todo-edit-input"; // 접두사 적용
        item.insertBefore(editInput, textSpan.nextSibling);
        editInput.focus(); editInput.select();
        const finishTodoEditing = () => {
            if (!editInput.parentElement) return;
            const newText = editInput.value.trim();
            editInput.remove();
            textSpan.style.display = ""; actionsDiv.style.display = "";
            if (newText && newText !== todo.text) {
                data.updateTodoPropertyForDate(todo.date, todo.id, 'text', newText);
            }
        };
        editInput.addEventListener("blur", () => { setTimeout(finishTodoEditing, 100); });
        editInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") { ev.preventDefault(); finishTodoEditing(); }
            else if (ev.key === "Escape") {
                editInput.remove(); textSpan.style.display = ""; actionsDiv.style.display = "";
            }
        });
    });

    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
            data.deleteTodoForDate(todo.date, todo.id);
        }
    });
    
    item.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        draggedTodoId = todo.id;
        draggedTodoOriginalDate = todo.date;
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.setData("application/x-weekly-todo-source", "true");
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("mv-dragging"); // 접두사 적용
    });
    
    item.addEventListener("dragend", () => {
        item.classList.remove("mv-dragging"); // 접두사 적용
        draggedTodoId = null;
        draggedTodoOriginalDate = null;
    });

    actionsDiv.append(editBtn, deleteBtn);
    item.append(textSpan, actionsDiv);
    return item;
}

function handleAddTodoInWeekly(e, dateStr) {
    e.stopPropagation();
    const text = prompt(`"${dateStr}"에 추가할 할 일 내용을 입력하세요:`);
    if (text && text.trim()) {
        data.addTodoForDate(dateStr, text.trim());
    }
}

function handleCellDragOver(e) {
    if (e.dataTransfer.types.includes("application/x-backlog-source") ||
        e.dataTransfer.types.includes("application/x-weekly-todo-source")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("mv-drag-over"); // 접두사 적용
    }
}

function handleCellDragLeave(e) {
    e.currentTarget.classList.remove("mv-drag-over"); // 접두사 적용
}

function handleCellDrop(e) {
    const dayCell = e.currentTarget; // .mv-weekly-day-cell
    e.preventDefault();
    dayCell.classList.remove("mv-drag-over"); // 접두사 적용

    const droppedTodoId = e.dataTransfer.getData("text/plain");
    const targetDate = dayCell.dataset.date;

    if (!droppedTodoId || !targetDate) return;

    if (e.dataTransfer.types.includes("application/x-backlog-source")) {
        data.moveBacklogTodoToCalendar(droppedTodoId, targetDate);
    } else if (e.dataTransfer.types.includes("application/x-weekly-todo-source")) {
        if (draggedTodoOriginalDate === targetDate) {
            reorderTodoInCell(e, dayCell, droppedTodoId);
        } else {
            const todoToMove = data.getTodosForDate(draggedTodoOriginalDate).find(t => t.id === droppedTodoId);
            if (todoToMove) {
                data.deleteTodoForDate(draggedTodoOriginalDate, droppedTodoId);
                data.addTodoForDate(targetDate, todoToMove.text, todoToMove);
            }
        }
    }
}

function reorderTodoInCell(e, dayCell, droppedTodoId) {
    const contentContainer = dayCell.querySelector(".mv-weekly-cell-content"); // 접두사 적용
    if (!contentContainer) return;
    const todoElements = Array.from(contentContainer.querySelectorAll(".mv-weekly-todo-item")); // 접두사 적용
    const targetDropElement = e.target.closest(".mv-weekly-todo-item"); // 접두사 적용

    let newOrderedIds = todoElements.map((el) => el.dataset.todoId);
    const draggedItemIndex = newOrderedIds.indexOf(droppedTodoId);

    if (draggedItemIndex !== -1) {
        newOrderedIds.splice(draggedItemIndex, 1);
    }

    if (targetDropElement && targetDropElement.dataset.todoId !== droppedTodoId) {
        let targetIndex = newOrderedIds.indexOf(targetDropElement.dataset.todoId);
        const rect = targetDropElement.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
            newOrderedIds.splice(targetIndex, 0, droppedTodoId);
        } else {
            newOrderedIds.splice(targetIndex + 1, 0, droppedTodoId);
        }
    } else {
        newOrderedIds.push(droppedTodoId);
    }
    data.reorderTodosForDate(dayCell.dataset.date, newOrderedIds);
}