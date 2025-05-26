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
    weeklyCalendarArea.innerHTML = ""; // 기존 내용 비우기

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

    // 날짜 셀 렌더링
    datesOfWeek.forEach((date) => {
        const dateStr = formatDate(date);
        const dayCell = document.createElement("div");
        dayCell.className = "weekly-day-cell";
        dayCell.dataset.date = dateStr;

        if (isSameDate(date, today)) {
            dayCell.classList.add("today");
        }

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

        // --- Drag & Drop 리스너 연결 (분리된 함수 사용) ---
        dayCell.addEventListener("dragover", handleCellDragOver);
        dayCell.addEventListener("dragleave", handleCellDragLeave);
        dayCell.addEventListener("drop", handleCellDrop);
        
        grid.appendChild(dayCell);
    });

    weeklyCalendarArea.append(header, grid);
}

export function initWeeklyCalendar() {
  if (!weeklyCalendarArea) {
    console.error("Weekly calendar area not found!");
    return;
  }
  console.log("Weekly Calendar Initialized.");
}

/**
 * 특정 날짜 셀의 내용을 렌더링합니다. (프로젝트, 할 일 포함)
 */
function renderWeeklyDayCellContent(dateStr, cellContentContainer) {
    cellContentContainer.innerHTML = "";
    const { events, calendarCellTodos, labels } = data.getState();
    const itemsToRender = [];

    // 1. 이 날짜에 해당하는 프로젝트 이벤트 추가
    events.forEach((event) => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        const currentDate = new Date(dateStr);
        eventStartDate.setHours(0, 0, 0, 0);
        eventEndDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        if (currentDate >= eventStartDate && currentDate <= eventEndDate) {
            const label = labels.find((l) => l.id === event.labelId);
            itemsToRender.push({
                ...event,
                itemType: "project",
                displayName: label ? label.name : "Project",
                displayColor: label ? label.color : "#ccc",
            });
        }
    });

    // 2. 이 날짜에 해당하는 할 일 추가
    calendarCellTodos.forEach((todo) => {
        if (todo.date === dateStr) {
            itemsToRender.push({
                ...todo,
                itemType: "todo",
                displayName: todo.text,
                displayColor: todo.color,
            });
        }
    });

    // 프로젝트를 할 일보다 위에 표시
    itemsToRender.sort((a, b) => {
        if (a.itemType === "project" && b.itemType !== "project") return -1;
        if (a.itemType !== "project" && b.itemType === "project") return 1;
        return 0;
    });

    // 4. DOM 요소 생성 및 추가
    itemsToRender.forEach((item) => {
        const itemEl = (item.itemType === 'project')
            ? createWeeklyProjectElement(item)
            : createWeeklyTodoElement(item);
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
function createWeeklyTodoElement(todo) {
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
    editBtn.innerHTML = "✏️";
    editBtn.title = "Edit Todo";
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete Todo";

    // --- [수정된 부분 시작] ---
    // 수정 버튼 클릭 이벤트
    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.querySelector(".todo-edit-input")) return; // 이미 편집 중이면 중복 실행 방지

        textSpan.style.display = "none"; // 기존 텍스트 숨기기
        actionsDiv.style.display = "none"; // 기존 버튼들 임시 숨기기 (선택 사항)

        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = todo.text;
        editInput.className = "todo-edit-input"; // 스타일링을 위한 클래스

        // 입력 필드를 textSpan 자리에 삽입 (또는 item의 적절한 위치)
        item.insertBefore(editInput, textSpan.nextSibling); // textSpan 다음에 삽입하거나, item.firstChild로 맨 앞에
        editInput.focus();
        editInput.select();

        const finishTodoEditing = () => {
            // 입력 필드가 DOM에서 제거되었는지 확인 (blur와 Enter 동시 처리 방지)
            if (!editInput.parentElement) return;

            const newText = editInput.value.trim();
            editInput.remove(); // 입력 필드 제거
            textSpan.style.display = ""; // 원래 텍스트 스팬 다시 표시
            actionsDiv.style.display = ""; // 버튼들 다시 표시

            if (newText && newText !== todo.text) {
                data.updateCalendarTodoText(todo.id, newText); // dataManager 호출 -> dataChanged 이벤트 발생
            }
            // 변경이 없거나 빈 텍스트면 UI는 원래대로 복구되고, dataChanged는 발생하지 않음
        };

        editInput.addEventListener("blur", () => {
            // 약간의 딜레이를 주어 'Enter'와의 충돌 방지
            setTimeout(finishTodoEditing, 100);
        });

        editInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                finishTodoEditing();
            } else if (ev.key === "Escape") {
                editInput.remove();
                textSpan.style.display = "";
                actionsDiv.style.display = "";
            }
        });
    });
    // --- [수정된 부분 끝] ---

    // 삭제 버튼 클릭 이벤트
    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
            data.deleteCalendarTodo(todo.id);
        }
    });
    
    // 드래그 시작 이벤트
    item.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        draggedTodoId = todo.id;
        draggedTodoOriginalDate = todo.date;
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.setData("source", "weekly-todo");
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
    });
    
    // 드래그 종료 이벤트
    item.addEventListener("dragend", () => item.classList.remove("dragging"));

    actionsDiv.append(editBtn, deleteBtn);
    item.append(textSpan, actionsDiv);

    return item;
}



function handleAddTodoInWeekly(e, dateStr) {
  e.stopPropagation();
  console.log(
    `WEEKLY_CALENDAR: handleAddTodoInWeekly called for date ${dateStr}. Event type: ${e.type}`
  ); // <<< 로그 추가
  const text = prompt(`"${dateStr}"에 추가할 할 일 내용을 입력하세요:`);
  if (text && text.trim()) {
    data.addCalendarTodo({ date: dateStr, text: text.trim() });
  }
}

// --- 이벤트 핸들러 함수들 ---

/**
 * Weekly Cell 위로 드래그 요소가 들어왔을 때 실행됩니다.
 * @param {DragEvent} e
 */
function handleCellDragOver(e) {
    e.preventDefault();
    const source = e.dataTransfer.getData("source");
    if (source === "weekly-todo" || source === "backlog") {
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
    const source = e.dataTransfer.getData("source");
    const targetDate = dayCell.dataset.date;

    if (!droppedTodoId || !targetDate) return;

    if (source === "backlog") {
        // 시나리오 1: Backlog에서 온 할 일 처리
        data.moveBacklogTodoToCalendar(droppedTodoId, targetDate);

    } else if (source === "weekly-todo") {
        if (draggedTodoOriginalDate === targetDate) {
            // 시나리오 2: 같은 날짜 내에서 순서 변경
            reorderTodoInCell(e, dayCell, droppedTodoId);
        } else {
            // 시나리오 3: 다른 날짜로 할 일 이동
            data.moveCalendarTodoToDate(droppedTodoId, targetDate);
        }
    }

    // 드래그 상태 초기화
    draggedTodoId = null;
    draggedTodoOriginalDate = null;
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
    data.reorderCalendarCellTodos(dayCell.dataset.date, newOrderedIds);
}


