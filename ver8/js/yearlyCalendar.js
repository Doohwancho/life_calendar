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

const today = new Date(); // 실제 오늘 날짜
today.setHours(0, 0, 0, 0); // 시간 정규화

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

function handleYearlyCellClick(e) {
  // --- 중요: 만약 현재 새로운 프로젝트를 그리고 있는 중이라면,
  // --- 주간 포커스 변경 로직을 실행하지 않습니다.
  if (isDrawing) {
    // console.log("Yearly cell click ignored because drawing is in progress.");
    return;
  }
  // ----------------------------------------------------

  const cell = e.currentTarget;
  const clickedDateStr = cell.dataset.date;

  if (clickedDateStr) {
    console.log(`Yearly cell clicked (not drawing): ${clickedDateStr}`);
    data.updateCurrentWeeklyViewStartDate(new Date(clickedDateStr));
  }
}

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
    "ID:",
    state.selectedLabel ? state.selectedLabel.id : "N/A", // ID 직접 확인
    "Value:",
    JSON.stringify(state.selectedLabel) // 전체 객체 확인
  );

  // --- 중요: selectedLabel 객체뿐만 아니라, 그 안에 id 속성이 있는지도 확인 ---
  if (e.button !== 0 || !state.selectedLabel || !state.selectedLabel.id) {
    console.warn(
      "YEARLY_CALENDAR: handleMouseDown - Aborting draw: No selected label or selected label has no ID."
    );
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

  // 마우스 위치에 따라 가장 가까운 .day-cell-yearly.interactive 찾기
  // e.target 대신 document.elementFromPoint(e.clientX, e.clientY) 사용 고려 가능 (더 정확할 수 있음)
  let cellUnderMouse = e.target.closest(".day-cell-yearly.interactive");

  // 만약 마우스가 빠르게 움직여 셀 밖으로 나갔다가 다시 들어올 경우,
  // e.target이 grid 자체가 될 수 있으므로, 포인터 위치로 셀을 찾는 것이 더 안정적일 수 있습니다.
  // 여기서는 일단 e.target.closest로 유지합니다.

  if (
    cellUnderMouse &&
    cellUnderMouse.dataset.date &&
    cellUnderMouse.dataset.date !== dragCurrentDate
  ) {
    dragCurrentDate = cellUnderMouse.dataset.date;
    renderTemporaryHighlight();
  } else if (!cellUnderMouse && dragCurrentDate) {
    // 마우스가 달력 그리드 밖으로 나갔지만 여전히 isDrawing 상태일 때,
    // dragCurrentDate를 마지막 유효한 셀로 유지하거나, null로 설정하여 하이라이트 범위를 조절할 수 있습니다.
    // 여기서는 dragCurrentDate를 유지하여 마지막 셀까지 하이라이트되도록 합니다.
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;

  const wasActuallyDragging = dragStartDate !== dragCurrentDate; // 실제로 드래그가 발생했는지 여부
  const state = data.getState();

  isDrawing = false;
  clearTemporaryHighlight();

  if (
    !dragStartDate ||
    !dragCurrentDate ||
    !state.selectedLabel ||
    !state.selectedLabel.id
  ) {
    // dragStartDate가 있는데 selectedLabel이 없다는 것은 거의 발생 안 함 (mousedown에서 체크하므로)
    // 하지만 방어적으로 코딩
    dragStartDate = null; // 상태 초기화
    dragCurrentDate = null;
    return;
  }

  let finalStartDate = dragStartDate;
  let finalEndDate = dragCurrentDate;

  if (new Date(finalStartDate) > new Date(finalEndDate)) {
    [finalStartDate, finalEndDate] = [finalEndDate, finalStartDate];
  }

  // --- 수정된 로직: 실제 드래그를 했는지, 아니면 단순 클릭에 가까웠는지 판단 ---
  // "단순 클릭"의 기준: 시작 날짜와 끝 날짜가 동일하고, 마우스 이동이 거의 없었음을 의미할 수 있음
  // 여기서는 시작 날짜와 현재 (마우스업 시점의) 커서 위치 날짜가 같은지로 판단
  const isSimpleClickEquivalent = dragStartDate === dragCurrentDate;

  if (isSimpleClickEquivalent && dragStartDate) {
    // 드래그가 거의 없었고, 클릭에 가까운 동작이었다면 주간 포커싱 변경
    console.log(`Yearly cell simple click detected on: ${dragStartDate}`);
    data.updateCurrentWeeklyViewStartDate(new Date(dragStartDate));
  } else {
    // 드래그가 발생했다면 새 이벤트 생성
    const newEvent = {
      id: generateId(),
      labelId: state.selectedLabel.id,
      startDate: finalStartDate,
      endDate: finalEndDate,
    };

    if (data.isDuplicateEvent(newEvent)) {
      console.log("Duplicate event prevented.");
    } else {
      data.addEvent(newEvent);
    }
  }

  // 상태 변수 초기화
  dragStartDate = null;
  dragCurrentDate = null;
}

function handleDragOver(e) {
  // [수정] 커스텀 데이터 타입을 확인하여 backlog에서 온 경우에만 드롭 허용
  if (e.dataTransfer.types.includes("application/x-backlog-source")) {
    e.preventDefault(); // 드롭을 허용하기 위해 필수
    e.dataTransfer.dropEffect = "move";
    e.target.closest(".day-cell-yearly")?.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  e.target.closest(".day-cell-yearly")?.classList.remove("drag-over");
}

function handleDrop(e) {
  // [수정] 커스텀 데이터 타입을 확인
  if (e.dataTransfer.types.includes("application/x-backlog-source")) {
      e.preventDefault(); // 기본 동작 방지 및 이벤트 전파 중단 효과
      const targetCell = e.target.closest(".day-cell-yearly");
      if (targetCell) {
          targetCell.classList.remove("drag-over");

          const todoId = e.dataTransfer.getData("text/plain"); // ID는 text/plain으로 가져옴
          const targetDate = targetCell.dataset.date;

          if (todoId && targetDate) {
              console.log(`[YearlyCalendar Drop] Moving backlog item ${todoId} to ${targetDate}`);
              data.moveBacklogTodoToCalendar(todoId, targetDate);
          } else {
              console.warn("[YearlyCalendar Drop] todoId or targetDate is missing.");
          }
      }
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

    contentWrapper.innerHTML = ""; // 해당 셀의 내용만 다시 그림 (이전 아이템들 제거)

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
    console.error("Yearly calendar area (yearly-calendar-area) not found!");
    return false;
  }

  calendarHeaderDaysEl = document.getElementById("calendarHeaderDaysYearly");
  if (!calendarHeaderDaysEl) {
    console.log("Creating calendarHeaderDaysYearly element.");
    calendarHeaderDaysEl = document.createElement("div");
    calendarHeaderDaysEl.id = "calendarHeaderDaysYearly";
    calendarHeaderDaysEl.className = "calendar-header-days-yearly";
    // yearlyCalendarArea에 header를 grid보다 먼저 추가하기 위해 insertBefore 사용 고려
    // 또는 yearlyCalendarArea의 자식 순서를 CSS로 제어 (예: flex-direction: column)
    // 여기서는 HTML 구조가 <div id="calendarHeaderDaysYearly"></div> <div id="calendarGridYearly"></div> 순서라고 가정
    yearlyCalendarArea.appendChild(calendarHeaderDaysEl); // 또는 insertBefore
  }

  calendarGridYearlyEl = document.getElementById("calendarGridYearly");
  if (!calendarGridYearlyEl) {
    console.log("Creating calendarGridYearly element.");
    calendarGridYearlyEl = document.createElement("div");
    calendarGridYearlyEl.id = "calendarGridYearly";
    calendarGridYearlyEl.className = "calendar-grid-yearly";
    yearlyCalendarArea.appendChild(calendarGridYearlyEl);
  }

  if (!calendarHeaderDaysEl || !calendarGridYearlyEl) {
    console.error(
      "Failed to obtain header or grid elements for yearly calendar."
    );
    return false;
  }
  return true;
}

export function renderYearlyCalendar(year) {
  if (!ensureCalendarStructure()) return;

  // 내용 채우기 전에 기존 내용 비우기
  calendarHeaderDaysEl.innerHTML = "";
  calendarGridYearlyEl.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // '이번 주 하이라이트'를 위한 기준 날짜 (포커싱된 주의 월요일)
  const state = data.getState(); // 상태 가져오기
  const focusedWeekMonday = state.currentWeeklyViewStartDate;
  let focusedWeekSunday = null;
  if (focusedWeekMonday) {
    focusedWeekSunday = new Date(focusedWeekMonday);
    focusedWeekSunday.setDate(focusedWeekMonday.getDate() + 6);
    focusedWeekSunday.setHours(0, 0, 0, 0); // 시간 정규화
    console.log(
      "YEARLY_CALENDAR - renderYearlyCalendar: Focused week for highlight: Mon=",
      formatDate(focusedWeekMonday),
      "Sun=",
      formatDate(focusedWeekSunday)
    );
  } else {
    console.warn(
      "YEARLY_CALENDAR - renderYearlyCalendar: focusedWeekMonday is not set!"
    );
  }

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
        currentDateObj.setHours(0, 0, 0, 0); // 비교를 위해 시간 정규화
        const dateStr = formatDate(currentDateObj);
        dayCell.dataset.date = dateStr;
        dayCell.classList.add("interactive");

        // Add Drag & Drop Listeners
        dayCell.addEventListener("mousedown", handleMouseDown);
        dayCell.addEventListener("click", handleYearlyCellClick);
        dayCell.addEventListener("dblclick", handleYearlyCellDoubleClick);
        dayCell.addEventListener("dragover", handleDragOver);
        dayCell.addEventListener("dragleave", handleDragLeave);
        dayCell.addEventListener("drop", handleDrop);

        if (isSameDate(currentDateObj, today)) dayCell.classList.add("today");

        // '포커싱된 주' 하이라이트 (state.currentWeeklyViewStartDate 기준)
        if (
          focusedWeekMonday &&
          focusedWeekSunday &&
          currentDateObj.getTime() >= focusedWeekMonday.getTime() &&
          currentDateObj.getTime() <= focusedWeekSunday.getTime()
        ) {
          dayCell.classList.add("current-week-day");
          // console.log("YEARLY_CALENDAR (renderYearlyCalendar): Adding current-week-day to:", formatDate(currentDateObj));
        }
      } else {
        dayCell.classList.add("empty");
      }
      monthRow.appendChild(dayCell);
    }
    calendarGridYearlyEl.appendChild(monthRow);
  });

  // Attach delegated/global event listeners for drawing
  calendarGridYearlyEl.addEventListener("mousemove", handleMouseMove);
  // window.addEventListener("mouseup", handleMouseUp);

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

function handleYearlyCellDoubleClick(e) {
  const cell = e.currentTarget; 
  const dateStr = cell.dataset.date;

  if (dateStr) {
    console.log(`[YearlyCalendar] Cell double-clicked: ${dateStr}. Opening daily view...`);
    
    const dailyViewUrl = `daily_view/index.html?date=${dateStr}`;
    const dailyViewWindow = window.open(dailyViewUrl, '_blank');

    if (dailyViewWindow) {
      // 플래그: 부모가 자식의 초기화 함수를 성공적으로 호출했는지 여부
      let initFunctionCalledByParent = false;

      dailyViewWindow.onload = function() {
        console.log('[YearlyCalendar] Daily view window.onload event fired.');
        console.log('[YearlyCalendar] Parent "data" object (dataManager) to be passed:', (data ? 'Exists' : 'data IS NULL/UNDEFINED!'));
        
        if (typeof dailyViewWindow.initializeDailyViewWithDataManager === 'function') {
          if (!dailyViewWindow.isDailyViewInitialized) { // 자식 창에 플래그가 없다면 (또는 false라면)
            console.log('[YearlyCalendar] Calling initializeDailyViewWithDataManager (via onload)...');
            dailyViewWindow.initializeDailyViewWithDataManager(data, dateStr);
            // 자식 창 자체에 초기화되었음을 표시하는 플래그를 설정하도록 유도할 수 있습니다.
            // 예: dailyViewWindow.isDailyViewInitialized = true; (이것은 initializeDailyViewWithDataManager 함수 내부에서 설정)
            initFunctionCalledByParent = true; 
          } else {
            console.log('[YearlyCalendar] Daily view already initialized (flag found on child). Skipping onload call.');
          }
        } else {
          console.error('[YearlyCalendar] FATAL: dailyViewWindow.initializeDailyViewWithDataManager is NOT a function.');
          alert("Daily view 페이지의 초기화 함수를 찾을 수 없습니다.");
        }
      };

      // setTimeout은 onload가 불안정할 경우를 대비한 보조 수단
      setTimeout(() => {
        // isDailyViewInitialized 플래그는 daily_view/main.js의 initializeDailyViewWithDataManager 끝에 설정
        if (dailyViewWindow && !dailyViewWindow.isDailyViewInitialized && // 자식 창의 플래그 확인
            typeof dailyViewWindow.initializeDailyViewWithDataManager === 'function' && 
            !initFunctionCalledByParent) { // 부모의 onload 핸들러에서 이미 호출되지 않았다면
          console.warn('[YearlyCalendar] Forcing call to initializeDailyViewWithDataManager due to timeout (onload might have issues or not set flag).');
          dailyViewWindow.initializeDailyViewWithDataManager(data, dateStr);
        }
      }, 700); // 시간을 약간 늘려봄 (0.7초)
    } else {
      alert("팝업이 차단되었거나 새 창을 열 수 없습니다.");
    }
  }
}

// Attach a single mousemove to the window for resizing performance
window.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;

  // if (!isResizing) return;
  // const cell = e.target.closest(".day-cell-yearly.interactive");
  // if (cell) {
  //   const currentDate = cell.dataset.date;
  //   const event = data
  //     .getState()
  //     .events.find((ev) => ev.id === selectedEventId);
  //   if (!event) return;

  //   // Create a temporary copy for preview
  //   const tempEvent = { ...event };
  //   if (resizeHandleType === "left") {
  //     tempEvent.startDate = currentDate;
  //   } else {
  //     tempEvent.endDate = currentDate;
  //   }

  //   // Preview the resize
  //   renderAllYearlyCellContent(); // Re-render all
  //   // In a more advanced version, you'd only clear and re-render the previewed event
  // }

  handleMouseMove(e);
});

window.addEventListener("mouseup", (e) => {
  // 이름 변경: handleGlobalMouseUp
  // 이 함수는 isResizing 플래그와 isDrawing 플래그를 모두 확인해야 합니다.
  if (isResizing) {
    // 리사이징 종료 로직 (이전 Phase 8 코드)
    document.body.style.cursor = "default";
    const cell = e.target.closest(".day-cell-yearly.interactive");
    if (cell && selectedEventId) {
      const finalDate = cell.dataset.date;
      const event = data
        .getState()
        .events.find((ev) => ev.id === selectedEventId);
      if (event) {
        // event가 존재하는지 확인
        let { startDate, endDate } = event;
        if (resizeHandleType === "left") {
          startDate = finalDate;
        } else {
          endDate = finalDate;
        }
        if (new Date(startDate) > new Date(endDate)) {
          [startDate, endDate] = [endDate, startDate];
        }
        data.updateEventDates(selectedEventId, startDate, endDate);
      }
    }
    isResizing = false;
    resizeHandleType = null;
    selectedEventId = null; // 선택 해제 또는 renderAllYearlyCellContent에서 처리
  }

  if (isDrawing) {
    // 그리기 종료 로직
    handleMouseUp(e); // 모듈 내부의 handleMouseUp 호출
  }
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
