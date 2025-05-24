// Yearly Calendar Module
import * as data from "./dataManager.js";
import { KOREAN_MONTH_NAMES } from "./constants.js";
import {
  getDaysInMonth,
  formatDate,
  isSameDate,
  isDateInCurrentWeek,
  getDateRange,
  generateId,
} from "./uiUtils.js";

const yearlyCalendarArea = document.getElementById("yearly-calendar-area");
let calendarHeaderDaysEl = null;
let calendarGridYearlyEl = null;

// Module-level state for drawing interactions
let isDrawing = false;
let dragStartDate = null;
let dragCurrentDate = null;

let selectedEventId = null;
let isResizing = false;
let resizeHandleType = null; // 'left' or 'right'

let customContextMenu = null;

function handleMouseDown(e) {
  // 1. 이미 존재하는 프로젝트 막대 또는 그 내부 요소에서 이벤트가 시작되었다면,
  //    새로운 그리기를 시작하지 않고 바로 반환합니다.
  if (e.target.closest(".project-bar")) {
    // 클릭된 .project-bar는 자체의 'click' 이벤트 핸들러(handleEventBarClick)에서
    // 선택 및 컨트롤 표시 로직을 처리할 것입니다.
    // 여기서 추가적인 동작을 막아 중복 생성을 방지합니다.
    return;
  }

  // 2. 선택된 라벨이 없거나, 마우스 주 버튼(좌클릭)이 아니면 그리기를 시작하지 않습니다.
  const state = data.getState();

  // 로그는 이전과 동일하게 유지하거나, 필요에 따라 JSON.stringify 사용
  console.log(
    "YEARLY_CALENDAR: handleMouseDown - selectedLabel check. Is selectedLabel present?",
    !!state.selectedLabel,
    "ID:", state.selectedLabel ? state.selectedLabel.id : 'N/A', // ID 직접 확인
    "Value:", JSON.stringify(state.selectedLabel) // 전체 객체 확인
   );

  // --- 중요: selectedLabel 객체뿐만 아니라, 그 안에 id 속성이 있는지도 확인 ---
  if (e.button !== 0 || !state.selectedLabel || !state.selectedLabel.id) { 
      console.warn("YEARLY_CALENDAR: handleMouseDown - Aborting draw: No selected label or selected label has no ID.");
      return;
  }
  // --------------------------------------------------------------------

  const cell = e.target.closest(".day-cell-yearly.interactive");
  if (!cell) return;

  isDrawing = true;
  dragStartDate = cell.dataset.date;
  dragCurrentDate = cell.dataset.date;

  e.preventDefault();
  renderTemporaryHighlight();
}

function handleMouseMove(e) {
  if (!isDrawing) return;

  const cell = e.target.closest(".day-cell-yearly.interactive");
  if (cell && cell.dataset.date !== dragCurrentDate) {
    dragCurrentDate = cell.dataset.date;
    renderTemporaryHighlight();
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;
  const state = data.getState();

  isDrawing = false; // 먼저 isDrawing을 false로 설정
  clearTemporaryHighlight();

  if (!dragStartDate || !dragCurrentDate || !state.selectedLabel) {
    return;
  }

  let finalStartDate = dragStartDate;
  let finalEndDate = dragCurrentDate;
  if (new Date(finalStartDate) > new Date(finalEndDate)) {
    [finalStartDate, finalEndDate] = [finalEndDate, finalStartDate];
  }

  const newEvent = {
    // name과 color 속성 제거
    id: generateId(),
    labelId: state.selectedLabel.id,
    startDate: finalStartDate,
    endDate: finalEndDate,
  };

  if (data.isDuplicateEvent(newEvent)) {
    // isDuplicateEvent는 labelId, startDate, endDate만 비교해야 함
    console.log("Duplicate event prevented.");
    return;
  }

  data.addEvent(newEvent);
  // renderAllYearlyCellContent(); // dataChanged 이벤트가 처리하므로 직접 호출 불필요
}

function handleDragOver(e) {
  e.preventDefault();
  const source = e.dataTransfer.getData("source");
  if (source === "backlog") {
    e.dataTransfer.dropEffect = "move";
    e.target.closest(".day-cell-yearly")?.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  e.target.closest(".day-cell-yearly")?.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.target.closest(".day-cell-yearly")?.classList.remove("drag-over");

  const todoId = e.dataTransfer.getData("text/plain");
  const source = e.dataTransfer.getData("source");
  const targetDate = e.target.closest(".day-cell-yearly")?.dataset.date;

  if (source === "backlog" && todoId && targetDate) {
    data.moveBacklogTodoToCalendar(todoId, targetDate);
  }
}

// --- Event Handlers for Editing ---
function handleEventBarClick(e, event) {
  e.stopPropagation(); // Prevent triggering other clicks
  selectedEventId = event.id;
  // Re-render to show selection and controls
  renderAllYearlyCellContent();
}

function handleEventDelete(e, eventId) {
  e.stopPropagation();
  if (confirm("이 프로젝트 일정을 삭제하시겠습니까?")) {
    data.deleteEvent(eventId);
  }
}

function handleResizeMouseDown(e, eventId, handleType) {
  e.stopPropagation();
  isResizing = true;
  resizeHandleType = handleType;
  selectedEventId = eventId;
  document.body.style.cursor = "ew-resize";
}

// --- Rendering Logic ---

function renderTemporaryHighlight() {
  console.log("여기까지 옴!");
  clearTemporaryHighlight();
  if (!dragStartDate || !dragCurrentDate) return;

  let start = dragStartDate;
  let end = dragCurrentDate;
  if (new Date(start) > new Date(end)) {
    [start, end] = [end, start];
  }

  const dateRange = getDateRange(start, end);
  // This loop correctly highlights all cells in between (Bug Fix A.3.2.1.3)
  dateRange.forEach((date) => {
    const dateStr = formatDate(date);
    const cell = calendarGridYearlyEl.querySelector(`[data-date="${dateStr}"]`);

    if (cell) {
      cell.classList.add("temp-highlight");
    }

    console.log("dateStr:", dateStr);
    console.log("cell:", cell);
  });
}

function clearTemporaryHighlight() {
  const highlightedCells =
    calendarGridYearlyEl.querySelectorAll(".temp-highlight");
  highlightedCells.forEach((cell) => cell.classList.remove("temp-highlight"));
}

/**
 * Clears all existing project bars from the grid.
 */
function clearAllProjectBars() {
  const bars = calendarGridYearlyEl.querySelectorAll(".project-bar");
  bars.forEach((bar) => bar.remove());
}

/**
 * Renders a single project bar in its correct cell with vertical stacking.
 * @param {object} event - The event object.
 * @param {string} dateStr - The specific date string (YYYY-MM-DD) to render the bar for.
 */
function renderProjectBarInCell(event, dateStr) {
  const cell = calendarGridYearlyEl.querySelector(`[data-date="${dateStr}"]`);
  if (!cell) return;

  // Stacking Logic: Check for existing bars to determine Y-offset
  const existingBarCount = cell.querySelectorAll(".project-bar").length;
  const barHeight = 8;
  const barMargin = 1;

  const barEl = document.createElement("div");
  barEl.className = "project-bar";
  barEl.dataset.eventId = event.id;
  barEl.style.backgroundColor = event.color;
  barEl.style.top = `${existingBarCount * (barHeight + barMargin)}px`;
  barEl.style.height = `${barHeight}px`;
  barEl.textContent = event.name;
  barEl.title = event.name;

  cell.appendChild(barEl);
}

/**
 * Main function to render all events as stacked bars in their respective cells.
 */
export function renderAllYearlyCellContent() {
  clearAllCellItems(); // New function to clear both bars and boxes

  const state = data.getState(); // Get current state once
  const { events, calendarCellTodos, labels } = state;
  const dailyItems = {};

  // 1. 모든 이벤트를 dailyItems에 'itemType: "project"'로 추가
  events.forEach((event) => {
    const dateRange = getDateRange(event.startDate, event.endDate);
    dateRange.forEach((date) => {
      const dateStr = formatDate(date);
      if (!dailyItems[dateStr]) dailyItems[dateStr] = [];
      dailyItems[dateStr].push({ ...event, itemType: "project" });
    });
  });

  // 2. 모든 달력 내 할 일을 dailyItems에 'itemType: "todo"'로 추가
  calendarCellTodos.forEach((todo) => {
    const dateStr = todo.date;
    if (!dailyItems[dateStr]) dailyItems[dateStr] = [];
    // dailyItems[dateStr].push(todo);
    dailyItems[dateStr].push({ ...todo, itemType: "todo" });
  });

  console.log("Yearly rendering with dailyItems:", dailyItems); // dailyItems에 todo가 포함되는지 확인

  // Render items with stacking logic
  for (const dateStr in dailyItems) {
    // const cell = calendarGridYearlyEl.querySelector(`[data-date="${dateStr}"]`);
    const cell = calendarGridYearlyEl.querySelector(
      `.day-cell-yearly[data-date="${dateStr}"]`
    );
    if (!cell) continue;

    const contentWrapper = cell.querySelector(
      ".day-cell-content-wrapper-yearly"
    );
    if (!contentWrapper) continue;

    contentWrapper.innerHTML = ''; // 해당 셀의 내용만 다시 그림 (이전 아이템들 제거)

    // 프로젝트를 우선으로 정렬
    dailyItems[dateStr].sort((a, b) =>
      a.itemType === "project" ? -1 : b.itemType === "project" ? 1 : 0
    );

    let yOffset = 0;

    dailyItems[dateStr].forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.title = item.name || item.text;
      itemEl.textContent = item.name || item.text;

      let itemHeight = 0;
      const sourceLabel = item.labelId
        ? labels.find((l) => l.id === item.labelId)
        : null;

      if (item.itemType === "project") {
        if (!sourceLabel) return; // 라벨 없으면 렌더링 안함 (또는 기본 스타일)

        itemEl.className = "project-bar";
        itemEl.dataset.eventId = item.id;
        itemEl.style.backgroundColor = sourceLabel.color; // 동적으로 라벨 색상 참조
        itemEl.textContent = sourceLabel.name; // 동적으로 라벨 이름 참조
        itemEl.title = sourceLabel.name;
        itemHeight = 8;
        itemEl.style.height = `${itemHeight}px`;
        itemEl.style.top = `${yOffset}px`;
        // yOffset += 6;

        itemEl.addEventListener("click", (e) => handleEventBarClick(e, item)); // 좌클릭: 이벤트 선택
        itemEl.addEventListener("contextmenu", (e) =>
          handleProjectBarContextMenu(e, item)
        ); // 우클릭: 라벨 관리

        // Add selection class and controls if this event is selected
        if (item.id === selectedEventId) {
          itemEl.classList.add("selected");

          // Add Delete Button
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-event-btn";
          deleteBtn.innerHTML = "&times;";
          deleteBtn.title = "Delete Event";
          deleteBtn.addEventListener("click", (e) =>
            handleEventDelete(e, item.id)
          );

          // Add Resize Handles
          const leftHandle = document.createElement("div");
          leftHandle.className = "resize-handle left";
          leftHandle.addEventListener("mousedown", (e) =>
            handleResizeMouseDown(e, item.id, "left")
          );

          const rightHandle = document.createElement("div");
          rightHandle.className = "resize-handle right";
          rightHandle.addEventListener("mousedown", (e) =>
            handleResizeMouseDown(e, item.id, "right")
          );

          itemEl.append(deleteBtn, leftHandle, rightHandle);
        }
      } else if (item.itemType === "todo") {
        itemEl.className = "todo-box-in-calendar";
        itemEl.dataset.todoId = item.id;
        itemEl.style.backgroundColor = item.color;
        itemEl.style.color = "#ffffff"; // 또는 item.textColor
        itemEl.textContent = item.text; // 텍스트 내용 설정 확인
        itemEl.title = item.text;
        itemHeight = 14;
        itemEl.style.height = `${itemHeight}px`;
        // itemEl.className = 'todo-box-in-calendar';
        // itemEl.dataset.todoId = item.id;
        // itemEl.style.backgroundColor = item.color;
        // itemEl.style.color = '#fff'; // Assuming dark colors for todos
        // itemEl.style.height = '14px';
        // itemEl.style.top = `${yOffset}px`;
        // yOffset += 15; // 14px height + 1px margin
      }

      if (itemHeight > 0) {
        itemEl.style.top = `${yOffset}px`;
        contentWrapper.appendChild(itemEl);
        yOffset += itemHeight;
      }
    });
  }
}

function clearAllCellItems() {
  // calendarGridYearlyEl.querySelectorAll('.project-bar, .todo-box-in-calendar').forEach(el => el.remove());
  calendarGridYearlyEl
    .querySelectorAll(
      ".day-cell-content-wrapper-yearly .project-bar, .day-cell-content-wrapper-yearly .todo-box-in-calendar"
    )
    .forEach((el) => el.remove());
}

function ensureCalendarStructure() {
  if (!yearlyCalendarArea) {
    console.error("Yearly calendar area not found!");
    return false;
  }
  calendarHeaderDaysEl = document.getElementById("calendarHeaderDaysYearly");
  if (!calendarHeaderDaysEl) {
    calendarHeaderDaysEl = document.createElement("div");
    calendarHeaderDaysEl.id = "calendarHeaderDaysYearly";
    calendarHeaderDaysEl.className = "calendar-header-days-yearly";
    yearlyCalendarArea.appendChild(calendarHeaderDaysEl);
  }

  calendarGridYearlyEl = document.getElementById("calendarGridYearly");
  if (!calendarGridYearlyEl) {
    calendarGridYearlyEl = document.createElement("div");
    calendarGridYearlyEl.id = "calendarGridYearly";
    calendarGridYearlyEl.className = "calendar-grid-yearly";
    yearlyCalendarArea.appendChild(calendarGridYearlyEl);
  }
  return true;
}

export function renderYearlyCalendar(year) {
  if (!ensureCalendarStructure()) return;

  // DOM 요소 가져오기 또는 생성
  const yearlyArea = document.getElementById("yearly-calendar-area");
  if (!yearlyArea) {
    console.error("Yearly calendar area not found!");
    return;
  }

  let headerDaysEl = document.getElementById("calendarHeaderDaysYearly");
  if (!headerDaysEl) {
    headerDaysEl = document.createElement("div");
    headerDaysEl.id = "calendarHeaderDaysYearly";
    headerDaysEl.className = "calendar-header-days-yearly";
    yearlyArea.insertBefore(headerDaysEl, yearlyArea.firstChild); // 그리드보다 먼저 추가
  }

  let gridEl = document.getElementById("calendarGridYearly");
  if (!gridEl) {
    gridEl = document.createElement("div");
    gridEl.id = "calendarGridYearly";
    gridEl.className = "calendar-grid-yearly";
    yearlyArea.appendChild(gridEl);
  }

  calendarHeaderDaysEl = headerDaysEl; // 모듈 변수 업데이트 (필요하다면)
  calendarGridYearlyEl = gridEl; // 모듈 변수 업데이트 (필요하다면)

  // calendarHeaderDaysEl.innerHTML = '';
  // calendarGridYearlyEl.innerHTML = '';

  // Detach event listeners before clearing grid to avoid memory leaks
  calendarGridYearlyEl.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);

  // ... (Day Header rendering from Phase 2, same code) ...
  const monthPlaceholder = document.createElement("div");
  monthPlaceholder.className = "month-column-placeholder";
  calendarHeaderDaysEl.appendChild(monthPlaceholder);
  for (let i = 1; i <= 31; i++) {
    const dayHeaderCell = document.createElement("div");
    dayHeaderCell.className = "day-header-cell-yearly";
    dayHeaderCell.textContent = i;
    calendarHeaderDaysEl.appendChild(dayHeaderCell);
  }

  const today = new Date();

  KOREAN_MONTH_NAMES.forEach((monthName, monthIndex) => {
    const monthRow = document.createElement("div");
    monthRow.className = "month-row-yearly";
    monthRow.id = `month-yearly-${monthIndex}`;

    const monthHeader = document.createElement("div");
    monthHeader.className = "month-header-yearly";
    monthHeader.textContent = monthName;
    monthRow.appendChild(monthHeader);

    const daysInCurrentMonth = getDaysInMonth(year, monthIndex);

    for (let day = 1; day <= 31; day++) {
      const dayCell = document.createElement("div");
      dayCell.className = "day-cell-yearly";

      // --- 중요: 콘텐츠 래퍼 추가 ---
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "day-cell-content-wrapper-yearly";
      dayCell.appendChild(contentWrapper);

      if (day <= daysInCurrentMonth) {
        const currentDateObj = new Date(year, monthIndex, day);
        const dateStr = formatDate(currentDateObj);
        dayCell.dataset.date = dateStr;
        dayCell.classList.add("interactive");

        // Add Drag & Drop Listeners
        dayCell.addEventListener("dragover", handleDragOver);
        dayCell.addEventListener("dragleave", handleDragLeave);
        dayCell.addEventListener("drop", handleDrop);
        dayCell.addEventListener("mousedown", handleMouseDown);

        if (isSameDate(currentDateObj, today)) dayCell.classList.add("today");
        if (isDateInCurrentWeek(currentDateObj, today))
          dayCell.classList.add("current-week-day");
      } else {
        dayCell.classList.add("empty");
      }
      monthRow.appendChild(dayCell);
    }
    calendarGridYearlyEl.appendChild(monthRow);
  });

  // Attach delegated/global event listeners for drawing
  calendarGridYearlyEl.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  // After creating the grid, render all events
  renderAllYearlyCellContent();
}

function removeCustomContextMenu() {
  if (customContextMenu) {
    customContextMenu.remove();
    customContextMenu = null;
  }
  window.removeEventListener("click", removeCustomContextMenuOnOutsideClick);
}

function removeCustomContextMenuOnOutsideClick(e) {
  if (customContextMenu && !customContextMenu.contains(e.target)) {
    removeCustomContextMenu();
  }
}

function handleProjectBarContextMenu(e, eventItem) {
  e.preventDefault();
  removeCustomContextMenu(); // Remove any existing menu

  const state = data.getState();
  const sourceLabel = state.labels.find((l) => l.id === eventItem.labelId);
  if (!sourceLabel) return;

  customContextMenu = document.createElement("div");
  customContextMenu.id = "customLabelContextMenu";
  customContextMenu.style.position = "absolute";
  customContextMenu.style.top = `0px`;
  customContextMenu.style.left = `${e.clientX}px`;
  customContextMenu.style.top = `${e.clientY}px`;
  customContextMenu.style.background = "white";
  customContextMenu.style.border = "1px solid #ccc";
  customContextMenu.style.padding = "5px";
  customContextMenu.style.zIndex = "1000";

  const editNameLi = document.createElement("div");
  editNameLi.textContent = `라벨 이름 변경 ("${sourceLabel.name}")`;
  editNameLi.style.padding = "5px";
  editNameLi.style.cursor = "pointer";
  editNameLi.onmouseover = () => (editNameLi.style.backgroundColor = "#f0f0f0");
  editNameLi.onmouseout = () => (editNameLi.style.backgroundColor = "white");
  editNameLi.addEventListener("click", () => {
    const newName = prompt("새 라벨 이름을 입력하세요:", sourceLabel.name);
    if (newName !== null) {
      // prompt에서 취소를 누르면 null 반환
      data.updateLabelName(sourceLabel.id, newName);
    }
    removeCustomContextMenu();
  });

  const deleteLabelLi = document.createElement("div");
  deleteLabelLi.textContent = `라벨 삭제 ("${sourceLabel.name}")`;
  deleteLabelLi.style.padding = "5px";
  deleteLabelLi.style.cursor = "pointer";
  deleteLabelLi.style.color = "red";
  deleteLabelLi.onmouseover = () =>
    (deleteLabelLi.style.backgroundColor = "#f0f0f0");
  deleteLabelLi.onmouseout = () =>
    (deleteLabelLi.style.backgroundColor = "white");
  deleteLabelLi.addEventListener("click", () => {
    if (
      confirm(
        `"${sourceLabel.name}" 라벨과 관련된 모든 프로젝트 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      data.deleteLabelAndAssociatedEvents(sourceLabel.id);
    }
    removeCustomContextMenu();
  });

  customContextMenu.append(editNameLi, deleteLabelLi);
  document.body.appendChild(customContextMenu);

  // Click outside to close
  setTimeout(
    () =>
      window.addEventListener("click", removeCustomContextMenuOnOutsideClick),
    0
  );
}

// Attach a single mousemove to the window for resizing performance
window.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const cell = e.target.closest(".day-cell-yearly.interactive");
  if (cell) {
    const currentDate = cell.dataset.date;
    const event = data
      .getState()
      .events.find((ev) => ev.id === selectedEventId);
    if (!event) return;

    // Create a temporary copy for preview
    const tempEvent = { ...event };
    if (resizeHandleType === "left") {
      tempEvent.startDate = currentDate;
    } else {
      tempEvent.endDate = currentDate;
    }

    // Preview the resize
    renderAllYearlyCellContent(); // Re-render all
    // In a more advanced version, you'd only clear and re-render the previewed event
  }
});

window.addEventListener("mouseup", (e) => {
  if (!isResizing) return;

  document.body.style.cursor = "default";
  const cell = e.target.closest(".day-cell-yearly.interactive");
  if (cell && selectedEventId) {
    const finalDate = cell.dataset.date;
    const event = data
      .getState()
      .events.find((ev) => ev.id === selectedEventId);

    let { startDate, endDate } = event;
    if (resizeHandleType === "left") {
      startDate = finalDate;
    } else {
      endDate = finalDate;
    }

    if (new Date(startDate) > new Date(endDate)) {
      [startDate, endDate] = [endDate, startDate]; // Swap if needed
    }

    data.updateEventDates(selectedEventId, startDate, endDate);
  }

  isResizing = false;
  resizeHandleType = null;
  // The dataChanged event from updateEventDates will handle the final re-render
});

// Deselect when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".project-bar")) {
    if (selectedEventId) {
      selectedEventId = null;
      renderAllYearlyCellContent();
    }
  }
});
