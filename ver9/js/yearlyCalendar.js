// Yearly Calendar Module
import * as data from "./dataManager.js";
import { KOREAN_MONTH_NAMES } from "./constants.js";
import {
  getDaysInMonth,
  formatDate,
  isSameDate,
  // isDateInCurrentWeek,
  getDateRange,
  generateId,
} from "./uiUtils.js";
import { navigate } from './spaRouter.js'; // [수정] 라우터의 navigate 함수 임포트

const todayStatic = new Date(); // 파일 로드 시점의 '오늘' (시간 정규화는 renderYearlyCalendar에서)
todayStatic.setHours(0, 0, 0, 0);

// 아래 변수들은 ensureCalendarStructure 내부에서 할당됩니다.
let yearlyCalendarArea = null;
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
  if (e.target.closest(".mv-project-bar")) {
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

  const cell = e.target.closest(".mv-day-cell-yearly.mv-interactive");
  if (!cell) return;

  isDrawing = true;
  dragStartDate = cell.dataset.date;
  dragCurrentDate = cell.dataset.date;

  e.preventDefault();
  renderTemporaryHighlight();
}

function handleMouseMove(e) {
  if (!isDrawing) return;
  const cellUnderMouse = e.target.closest(".mv-day-cell-yearly.mv-interactive"); // 접두사 적용
  if (cellUnderMouse && cellUnderMouse.dataset.date && cellUnderMouse.dataset.date !== dragCurrentDate) {
      dragCurrentDate = cellUnderMouse.dataset.date;
      renderTemporaryHighlight();
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
  if (e.dataTransfer.types.includes("application/x-backlog-source")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      e.target.closest(".mv-day-cell-yearly")?.classList.add("mv-drag-over"); // 접두사 클래스
  }
}

function handleDragLeave(e) {
  e.target.closest(".mv-day-cell-yearly")?.classList.remove("mv-drag-over"); // 접두사 클래스
}

function handleDrop(e) {
  // [수정] 커스텀 데이터 타입을 확인
  if (e.dataTransfer.types.includes("application/x-backlog-source")) {
      e.preventDefault(); // 기본 동작 방지 및 이벤트 전파 중단 효과
      const targetCell = e.target.closest(".mv-day-cell-yearly");
      if (targetCell) {
          targetCell.classList.remove("mv-drag-over");

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
      cell.classList.add("mv-temp-highlight");
    }

    console.log("dateStr:", dateStr);
    console.log("cell:", cell);
  });
}

function clearTemporaryHighlight() {
  if (!calendarGridYearlyEl) {
    // console.warn("calendarGridYearlyEl not ready for clearTemporaryHighlight");
    return;
}
  const highlightedCells =
    calendarGridYearlyEl.querySelectorAll(".mv-temp-highlight");
  highlightedCells.forEach((cell) => cell.classList.remove("mv-temp-highlight"));
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
 * 연간 캘린더의 모든 셀 내용을 렌더링합니다. (프로젝트 및 To-do 포함)
 */
export function renderAllYearlyCellContent() {
  if (!calendarGridYearlyEl) { // calendarGridYearlyEl이 확보되었는지 확인
    console.warn("[renderAllYearlyCellContent] calendarGridYearlyEl is not available. Ensure renderYearlyCalendar was called and structure is ready.");
    if (!ensureCalendarStructure() || !calendarGridYearlyEl) { // 다시 한번 시도
         console.error("[renderAllYearlyCellContent] Failed to ensure structure. Aborting.");
        return;
    }
  }

  clearAllCellItems(); // 셀 내용 초기화

  const state = data.getState();
  // [수정] calendarCellTodos를 직접 사용하지 않고, events와 labels만 가져옵니다.
  // To-do는 각 날짜별로 data.getTodosForDate()를 통해 가져옵니다.
  const { events, labels, currentDisplayYear } = state;
  const dailyItems = {}; // 날짜별로 아이템(프로젝트, To-do)을 그룹화할 객체

  // 1. 모든 프로젝트 이벤트를 dailyItems에 추가
  if (events && Array.isArray(events)) {
      events.forEach((event) => {
          const dateRange = getDateRange(event.startDate, event.endDate);
          dateRange.forEach((date) => {
              const dateStr = formatDate(date);
              if (!dailyItems[dateStr]) dailyItems[dateStr] = [];
              dailyItems[dateStr].push({ ...event, itemType: "project" });
          });
      });
  }

  // 2. [수정] 현재 표시 연도의 모든 날짜에 대해 To-do를 가져와 dailyItems에 추가
  if (currentDisplayYear) { // currentDisplayYear가 유효한지 확인
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const daysInCurrentMonth = getDaysInMonth(currentDisplayYear, monthIndex);
          for (let day = 1; day <= daysInCurrentMonth; day++) {
              const currentDateObj = new Date(currentDisplayYear, monthIndex, day);
              const dateStr = formatDate(currentDateObj);
              
              const todosForDay = data.getTodosForDate(dateStr); // 새 함수로 To-do 가져오기
              if (todosForDay && todosForDay.length > 0) {
                  if (!dailyItems[dateStr]) dailyItems[dateStr] = [];
                  todosForDay.forEach(todo => {
                      dailyItems[dateStr].push({ 
                          ...todo, 
                          date: dateStr, // 렌더링 시점에 날짜 정보가 필요할 수 있으므로 명시적 추가
                          itemType: "todo" 
                      });
                  });
              }
          }
      }
  }
  
  // console.log("Yearly rendering with dailyItems (after fetching todos):", dailyItems);

  // 3. dailyItems 객체를 기반으로 DOM 요소 생성 및 렌더링 (기존 로직과 유사)
  for (const dateStr in dailyItems) {
      const cell = calendarGridYearlyEl.querySelector(
          `.mv-day-cell-yearly[data-date="${dateStr}"]`
      );
      if (!cell) continue;

      const contentWrapper = cell.querySelector(".mv-day-cell-content-wrapper-yearly");
      if (!contentWrapper) continue;

      contentWrapper.innerHTML = ""; // 이전 아이템들 제거

      // 프로젝트를 우선으로 정렬 (선택 사항)
      dailyItems[dateStr].sort((a, b) =>
          a.itemType === "project" ? -1 : b.itemType === "project" ? 1 : 0
      );

      let yOffset = 0;
      dailyItems[dateStr].forEach((item) => {
          const itemEl = document.createElement("div");
          // 프로젝트와 To-do에 따라 적절한 텍스트와 title 설정
          itemEl.title = item.itemType === "project" ? item.name : item.text;
          itemEl.textContent = item.itemType === "project" ? item.name : item.text;

          let itemHeight = 0;
          
          if (item.itemType === "project") {
              const sourceLabel = item.labelId ? labels.find((l) => l.id === item.labelId) : null;
              if (!sourceLabel) return; 

              itemEl.className = "mv-project-bar";
              itemEl.dataset.eventId = item.id;
              itemEl.style.backgroundColor = sourceLabel.color;
              itemEl.textContent = sourceLabel.name; // 프로젝트 이름은 라벨 이름으로
              itemEl.title = sourceLabel.name;      // title도 라벨 이름으로
              itemHeight = 8;
              itemEl.style.height = `${itemHeight}px`;
              
              itemEl.addEventListener("click", (e) => handleEventBarClick(e, item));
              itemEl.addEventListener("contextmenu", (e) => handleProjectBarContextMenu(e, item));

              if (item.id === selectedEventId) {
                  itemEl.classList.add("mv-selected");
                  const deleteBtn = document.createElement("button");
                  deleteBtn.className = "delete-event-btn";
                  deleteBtn.innerHTML = "&times;";
                  deleteBtn.title = "Delete Event";
                  deleteBtn.addEventListener("click", (e) => handleEventDelete(e, item.id));
                  const leftHandle = document.createElement("div");
                  leftHandle.className = "resize-handle left";
                  leftHandle.addEventListener("mousedown", (e) => handleResizeMouseDown(e, item.id, "left"));
                  const rightHandle = document.createElement("div");
                  rightHandle.className = "resize-handle right";
                  rightHandle.addEventListener("mousedown", (e) => handleResizeMouseDown(e, item.id, "right"));
                  itemEl.append(deleteBtn, leftHandle, rightHandle);
              }
          } else if (item.itemType === "todo") {
              itemEl.className = "mv-todo-box-in-calendar";
              itemEl.dataset.todoId = item.id;
              itemEl.style.backgroundColor = item.color || "#6c757d";
              itemEl.style.color = "#ffffff"; 
              itemEl.textContent = item.text; // To-do 텍스트
              itemEl.title = item.text;       // To-do title
              itemHeight = 14; 
              itemEl.style.height = `${itemHeight}px`;
          }

          if (itemHeight > 0) {
              itemEl.style.top = `${yOffset}px`;
              contentWrapper.appendChild(itemEl);
              yOffset += itemHeight + 1; // 아이템 간 간격 1px 추가
          }
      });
  }
}


function clearAllCellItems() {
  // calendarGridYearlyEl.querySelectorAll('.project-bar, .todo-box-in-calendar').forEach(el => el.remove());
  calendarGridYearlyEl
    .querySelectorAll(
      ".mv-day-cell-content-wrapper-yearly .mv-project-bar, .mv-day-cell-content-wrapper-yearly .mv-todo-box-in-calendar"
    )
    .forEach((el) => el.remove());
}

function ensureCalendarStructure() {
  yearlyCalendarArea = document.getElementById("yearly-calendar-area"); // 템플릿의 ID
  if (!yearlyCalendarArea) {
      console.error("Yearly calendar area (id: yearly-calendar-area) not found!");
      return false;
  }

  calendarHeaderDaysEl = document.getElementById("calendarHeaderDaysYearly");
  if (!calendarHeaderDaysEl) {
      calendarHeaderDaysEl = document.createElement("div");
      calendarHeaderDaysEl.id = "calendarHeaderDaysYearly"; // HTML 템플릿과 ID 일치
      calendarHeaderDaysEl.className = "mv-calendar-header-days-yearly"; // 접두사 클래스
      yearlyCalendarArea.appendChild(calendarHeaderDaysEl);
  }

  calendarGridYearlyEl = document.getElementById("calendarGridYearly");
  if (!calendarGridYearlyEl) {
      calendarGridYearlyEl = document.createElement("div");
      calendarGridYearlyEl.id = "calendarGridYearly"; // HTML 템플릿과 ID 일치
      calendarGridYearlyEl.className = "mv-calendar-grid-yearly"; // 접두사 클래스
      yearlyCalendarArea.appendChild(calendarGridYearlyEl);
  }
  return true;
}


export function renderYearlyCalendar(year) {
  if (!ensureCalendarStructure()) {
      console.error("[renderYearlyCalendar] Aborting render due to missing calendar structure.");
      return;
  }
  if (!calendarHeaderDaysEl || !calendarGridYearlyEl) {
       console.error("[renderYearlyCalendar] Critical DOM elements not found after ensure. Aborting.");
      return;
  }

  calendarHeaderDaysEl.innerHTML = "";
  calendarGridYearlyEl.innerHTML = "";

  const today = new Date(); // 여기서 '오늘' 날짜 생성 및 정규화
  today.setHours(0, 0, 0, 0);

  const state = data.getState();
  const focusedWeekMonday = state.currentWeeklyViewStartDate;
  let focusedWeekSunday = null;
  if (focusedWeekMonday) {
      focusedWeekSunday = new Date(focusedWeekMonday);
      focusedWeekSunday.setDate(focusedWeekMonday.getDate() + 6);
      focusedWeekSunday.setHours(0, 0, 0, 0);
  }

  const monthPlaceholder = document.createElement("div");
  monthPlaceholder.className = "mv-month-column-placeholder"; // 접두사 클래스
  calendarHeaderDaysEl.appendChild(monthPlaceholder);
  for (let i = 1; i <= 31; i++) {
      const dayHeaderCell = document.createElement("div");
      dayHeaderCell.className = "mv-day-header-cell-yearly"; // 접두사 클래스
      dayHeaderCell.textContent = i;
      calendarHeaderDaysEl.appendChild(dayHeaderCell);
  }

  KOREAN_MONTH_NAMES.forEach((monthName, monthIndex) => {
      const monthRow = document.createElement("div");
      monthRow.className = "mv-month-row-yearly"; // 접두사 클래스
      monthRow.id = `month-yearly-${monthIndex}`;

      const monthHeader = document.createElement("div");
      monthHeader.className = "mv-month-header-yearly"; // 접두사 클래스
      monthHeader.textContent = monthName;
      monthRow.appendChild(monthHeader);

      const daysInCurrentMonth = getDaysInMonth(year, monthIndex);
      for (let day = 1; day <= 31; day++) {
          const dayCell = document.createElement("div");
          dayCell.className = "mv-day-cell-yearly"; // 접두사 클래스

          const contentWrapper = document.createElement("div");
          contentWrapper.className = "mv-day-cell-content-wrapper-yearly"; // 접두사 클래스
          dayCell.appendChild(contentWrapper);

          if (day <= daysInCurrentMonth) {
              const currentDateObj = new Date(year, monthIndex, day);
              currentDateObj.setHours(0, 0, 0, 0);
              const dateStr = formatDate(currentDateObj);
              dayCell.dataset.date = dateStr;
              dayCell.classList.add("mv-interactive"); // 접두사 클래스

              dayCell.addEventListener("mousedown", handleMouseDown);
              dayCell.addEventListener("click", handleYearlyCellClick);
              dayCell.addEventListener("dblclick", handleYearlyCellDoubleClick); // mainViewHandler 또는 spaRouter에서 처리
              dayCell.addEventListener("dragover", handleDragOver);
              dayCell.addEventListener("dragleave", handleDragLeave);
              dayCell.addEventListener("drop", handleDrop);
              // 주의: 이벤트 리스너는 cleanup 시 제거해야 함 (mainViewHandler에서 관리)

              if (isSameDate(currentDateObj, today)) dayCell.classList.add("mv-today"); // 접두사 클래스
              if (focusedWeekMonday && focusedWeekSunday &&
                  currentDateObj.getTime() >= focusedWeekMonday.getTime() &&
                  currentDateObj.getTime() <= focusedWeekSunday.getTime()) {
                  dayCell.classList.add("mv-current-week-day"); // 접두사 클래스
              }
          } else {
              dayCell.classList.add("mv-empty"); // 접두사 클래스
          }
          monthRow.appendChild(dayCell);
      }
      calendarGridYearlyEl.appendChild(monthRow);
  });

  // calendarGridYearlyEl.addEventListener("mousemove", handleMouseMove); // mainViewHandler에서 관리
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
    console.log(`[YearlyCalendar] Cell double-clicked: ${dateStr}. Navigating to daily view...`);
    // navigate 함수는 spaRouter.js에서 import 해야 합니다.
    // navigate 함수의 경로는 '#/daily/:date' 형식을 따릅니다.
    navigate(`/daily/${dateStr}`);
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
