import * as data from "./dataManager.js";
import {
  formatDate,
  getMondayOfWeek,
  getDayNameKO,
  isSameDate,
} from "./uiUtils.js";

const weeklyCalendarArea = document.getElementById("weekly-calendar-area");
const today = new Date(); // Use provided date as "today"
today.setHours(0, 0, 0, 0);

let draggedTodoId = null; // 드래그 중인 할 일 ID (모듈 스코프)
let draggedTodoOriginalDate = null; // 드래그 시작 시 할 일의 원래 날짜


// --- 렌더링 함수들 ---
/**
 * 주간 달력 전체를 렌더링합니다.
 * @param {Date} weekStartDate - 표시할 주의 월요일 날짜 객체
 */
export function renderWeeklyCalendar(weekStartDate) {
    if (!weeklyCalendarArea) return;
    weeklyCalendarArea.innerHTML = "";

    const header = document.createElement("header");
    header.className = "weekly-header";
    const grid = document.createElement("div");
    grid.className = "weekly-grid";

    const datesOfWeek = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        datesOfWeek.push(date);
        const dayHeaderEl = document.createElement("div");
        dayHeaderEl.className = "weekly-day-header";
        dayHeaderEl.innerHTML = `${date.getDate()}<br>${getDayNameKO(date)}`;
        if (isSameDate(date, today)) dayHeaderEl.style.color = "#007bff";
        header.appendChild(dayHeaderEl);
    }

    datesOfWeek.forEach((date) => {
        const dateStr = formatDate(date);
        const dayCell = document.createElement("div");
        dayCell.className = "weekly-day-cell";
        dayCell.dataset.date = dateStr;
        if (isSameDate(date, today)) dayCell.classList.add("today");

        const cellHeader = document.createElement("div");
        cellHeader.className = "weekly-cell-header";
        const addTodoBtn = document.createElement("button");
        addTodoBtn.className = "add-todo-in-weekly";
        addTodoBtn.textContent = "+";
        addTodoBtn.title = "Add Todo";
        addTodoBtn.addEventListener("click", (e) => handleAddTodoInWeekly(e, dateStr));
        cellHeader.append(addTodoBtn);

        const cellContentContainer = document.createElement("div");
        cellContentContainer.className = "weekly-cell-content";
        renderWeeklyDayCellContent(dateStr, cellContentContainer);
        
        dayCell.append(cellHeader, cellContentContainer);
        dayCell.addEventListener("dragover", handleCellDragOver);
        dayCell.addEventListener("dragleave", handleCellDragLeave);
        dayCell.addEventListener("drop", handleCellDrop);
        grid.appendChild(dayCell);
    });
    weeklyCalendarArea.append(header, grid);
}

export function initWeeklyCalendar() {
    if (!weeklyCalendarArea) console.error("Weekly calendar area not found!");
    else console.log("Weekly Calendar Initialized.");
}

/**
 * 특정 날짜 셀의 내용을 렌더링합니다. (프로젝트, 할 일 포함)
 */
function renderWeeklyDayCellContent(dateStr, cellContentContainer) {
    cellContentContainer.innerHTML = "";
    const { events, labels } = data.getState(); // calendarCellTodos 대신 getTodosForDate 사용
    const todosForDay = data.getTodosForDate(dateStr) || []; // [수정]
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

    // [수정] dataManager.getTodosForDate를 통해 가져온 To-do 사용
    todosForDay.forEach((todo) => {
        itemsToRender.push({
            ...todo,
            date: dateStr, // To-do 객체에 날짜 정보 추가 (수정/삭제 시 필요)
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
            : createWeeklyTodoElement(item); // To-do 객체에 date 정보가 포함되어 전달됨
        cellContentContainer.appendChild(itemEl);
    });
}


/**
 * 주간 달력에 표시될 프로젝트 바 요소를 생성합니다.
 * @param {object} item - 프로젝트 이벤트 객체
 */
function createWeeklyProjectElement(item) {
    const itemEl = document.createElement("div");
    itemEl.className = "project-bar-weekly"; // 주간용 클래스
    itemEl.style.backgroundColor = item.displayColor;
    itemEl.textContent = item.displayName;
    itemEl.title = item.displayName;
    return itemEl;
}

/**
 * 주간 달력 셀 내의 할 일 DOM 요소를 생성합니다.
 * @param {object} todo - 할 일 객체
 */
function createWeeklyTodoElement(todo) { // 이제 todo 객체는 todo.date 속성을 가짐
    const item = document.createElement("div");
    item.className = "weekly-todo-item";
    item.style.backgroundColor = todo.color || "#6c757d";
    item.dataset.todoId = todo.id;
    item.draggable = true;

    const textSpan = document.createElement("span");
    textSpan.className = "todo-text-display";
    textSpan.textContent = todo.text;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "todo-actions";
    const editBtn = document.createElement("button");
    editBtn.innerHTML = "✏️"; editBtn.title = "Edit Todo";
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️"; deleteBtn.title = "Delete Todo";

    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.querySelector(".todo-edit-input")) return;
        textSpan.style.display = "none";
        actionsDiv.style.display = "none";
        const editInput = document.createElement("input");
        editInput.type = "text"; editInput.value = todo.text;
        editInput.className = "todo-edit-input";
        item.insertBefore(editInput, textSpan.nextSibling);
        editInput.focus(); editInput.select();
        const finishTodoEditing = () => {
            if (!editInput.parentElement) return;
            const newText = editInput.value.trim();
            editInput.remove();
            textSpan.style.display = ""; actionsDiv.style.display = "";
            if (newText && newText !== todo.text) {
                // [수정] dataManager의 새 함수 호출
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
            // [수정] dataManager의 새 함수 호출
            data.deleteTodoForDate(todo.date, todo.id);
        }
    });
    
    item.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        draggedTodoId = todo.id;
        draggedTodoOriginalDate = todo.date; // todo.date 사용
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.setData("application/x-weekly-todo-source", "true");
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
    });
    
    item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
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
        // [수정] dataManager의 새 함수 호출
        data.addTodoForDate(dateStr, text.trim());
    }
}

// --- 이벤트 핸들러 함수들 ---

/**
 * Weekly Cell 위로 드래그 요소가 들어왔을 때 실행됩니다.
 * @param {DragEvent} e
 */
function handleCellDragOver(e) {
    // [수정] backlog 또는 weekly-todo 출처인지 커스텀 타입으로 확인
    if (e.dataTransfer.types.includes("application/x-backlog-source") ||
        e.dataTransfer.types.includes("application/x-weekly-todo-source")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drag-over");
    }
}

/**
 * Weekly Cell 에서 드래그 요소가 나갔을 때 실행됩니다.
 * @param {DragEvent} e
 */
function handleCellDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
}

/**
 * Weekly Cell 에 드래그 요소를 드롭했을 때 실행됩니다.
 * @param {DragEvent} e
 */
function handleCellDrop(e) {
    const dayCell = e.currentTarget;
    e.preventDefault();
    dayCell.classList.remove("drag-over");

    const droppedTodoId = e.dataTransfer.getData("text/plain");
    const targetDate = dayCell.dataset.date;

    if (!droppedTodoId || !targetDate) return;

    if (e.dataTransfer.types.includes("application/x-backlog-source")) {
        data.moveBacklogTodoToCalendar(droppedTodoId, targetDate); // 이 함수는 dataManager에서 이미 수정됨
    } else if (e.dataTransfer.types.includes("application/x-weekly-todo-source")) {
        if (draggedTodoOriginalDate === targetDate) {
            reorderTodoInCell(e, dayCell, droppedTodoId);
        } else {
            // [수정] dataManager의 새 함수 호출 (또는 기존 moveCalendarTodoToDate의 내부 로직 변경)
            // 이 경우, 기존 todo를 삭제하고 새 위치에 추가하는 로직이 필요할 수 있음
            // 또는 dataManager에 moveDailyTodo(oldDate, newDate, todoId) 와 같은 함수 구현
            // 여기서는 우선 기존 todo를 삭제하고 새로 추가하는 방식으로 가정 (dataManager에 구현 필요)
            
            // 간단한 방법: dataManager에 deleteTodoForDate와 addTodoForDate를 순차적으로 호출
            const todoToMove = data.getTodosForDate(draggedTodoOriginalDate).find(t => t.id === droppedTodoId);
            if (todoToMove) {
                data.deleteTodoForDate(draggedTodoOriginalDate, droppedTodoId);
                data.addTodoForDate(targetDate, todoToMove.text, todoToMove); // todoToMove에 color, importance 등 포함
            }
        }
    }
}


/**
 * 같은 날짜 셀 내에서 할 일의 순서를 변경합니다.
 * @param {DragEvent} e - 드롭 이벤트
 * @param {HTMLElement} dayCell - 드롭된 셀
 * @param {string} droppedTodoId - 드롭된 할 일의 ID
 */
function reorderTodoInCell(e, dayCell, droppedTodoId) {
    const contentContainer = dayCell.querySelector(".weekly-cell-content");
    const todoElements = Array.from(contentContainer.querySelectorAll(".weekly-todo-item"));
    const targetDropElement = e.target.closest(".weekly-todo-item");

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
    // [수정] dataManager의 새 함수 호출
    data.reorderTodosForDate(dayCell.dataset.date, newOrderedIds);
}
