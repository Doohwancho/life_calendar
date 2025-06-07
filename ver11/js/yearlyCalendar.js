// Yearly Calendar Module
import * as data from "./dataManager.js";
import { KOREAN_MONTH_NAMES } from "./constants.js";
import {
  getDaysInMonth,
  formatDate,
  isSameDate,
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

let dayCellMarkContextMenuEl = null; // 컨텍스트 메뉴 DOM 요소
let currentContextMenuDateStr = null; // 현재 메뉴가 열린 셀의 날짜 문자열

// 사용 가능한 마크 정의 (나중에 dataManager 등에서 관리 가능)
const AVAILABLE_MARKS = [
  { type: "heart", symbol: "❤️", name: "하트", cssClass: "mark-heart" },
  { type: "star", symbol: "⭐", name: "별", cssClass: "mark-star" },
  { type: "check", symbol: "✅", name: "체크", cssClass: "mark-check" },
  { type: "pin", symbol: "📌", name: "핀", cssClass: "mark-pin" },
  { type: "warning", symbol: "⚠️", name: "경고", cssClass: "mark-warning" },
  { type: "question", symbol: "❓", name: "물음표", cssClass: "mark-question" },
  { type: "exclamation", symbol: "❗", name: "느낌표", cssClass: "mark-exclamation" },
  { type: "cross", symbol: "❌", name: "X 표시", cssClass: "mark-cross" },
  { type: "none", symbol: "🚫", name: "표시 없음", cssClass: "mark-none" }
];

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

  // const wasActuallyDragging = dragStartDate !== dragCurrentDate; // 이 변수는 이제 직접 사용하지 않음
  const state = data.getState();

  isDrawing = false;
  clearTemporaryHighlight();

  if (
      !dragStartDate || // dragCurrentDate는 마우스 업 시점에 항상 dragStartDate와 같거나 다름
      !state.selectedLabel ||
      !state.selectedLabel.id
  ) {
      dragStartDate = null;
      dragCurrentDate = null; // dragCurrentDate도 확실히 초기화
      return;
  }

  let finalStartDate = dragStartDate;
  let finalEndDate = dragCurrentDate || dragStartDate; // dragCurrentDate가 없으면 dragStartDate 사용 (클릭의 경우)

  if (new Date(finalStartDate) > new Date(finalEndDate)) {
      [finalStartDate, finalEndDate] = [finalEndDate, finalStartDate];
  }

  const newEvent = {
      id: generateId(), // uiUtils에서 가져온 함수 사용
      labelId: state.selectedLabel.id,
      startDate: finalStartDate,
      endDate: finalEndDate, // 클릭만 한 경우 finalStartDate와 동일
  };

  if (data.isDuplicateEvent(newEvent)) { // dataManager.js에 이 함수가 있어야 함
      console.log("[YearlyCalendar] Duplicate event prevented for date(s):", finalStartDate, "-", finalEndDate);
  } else {
      data.addEvent(newEvent); // dataManager.js에 있는 함수 호출
      console.log("[YearlyCalendar] Event added:", newEvent);
  }

  // 주간 뷰 포커스는 별도의 클릭 핸들러(handleYearlyCellClick)에서 처리하거나,
  // 여기서 조건을 추가하여 (예: 이벤트 생성 후 포커스 이동) 처리할 수 있습니다.
  // 현재 로직은 이벤트 생성 후, 해당 날짜로 주간 뷰를 업데이트하지는 않습니다.
  // 만약 단일 클릭으로 이벤트 생성 후 해당 주로 포커스 이동을 원한다면 아래 코드 추가:
  if (dragStartDate === (dragCurrentDate || dragStartDate)) { // 단순 클릭이었던 경우
       data.updateCurrentWeeklyViewStartDate(new Date(dragStartDate));
  }


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
/**
 * 연간 캘린더의 모든 셀 내용을 렌더링합니다. (프로젝트, To-do, 그리고 이제 셀 마크 포함)
 */
export function renderAllYearlyCellContent() {
  if (!calendarGridYearlyEl) {
      if (!ensureCalendarStructure() || !calendarGridYearlyEl) {
          console.error("[renderAllYearlyCellContent] Failed to ensure structure. Aborting.");
          return;
      }
  }

  clearAllCellItems(); // 기존 프로젝트 바, 투두 박스, 셀 마크 모두 제거

  const state = data.getState();
  const { events, projects, currentDisplayYear } = state;
  const labels = projects;
  const dailyItems = {}; // 날짜별 프로젝트/투두 그룹화

  // TODO: 실제로는 dataManager에서 날짜별 마크 정보를 가져와야 함.
  // 예: const cellMark = data.getCellMarkForDate(dateStr);
  // 여기서는 아직 dataManager 연동 전이므로, 위 handleMarkSelectionFromMenu에서 임시로 DOM에 직접 추가/제거.
  // 만약 dataManager에 cellMark 정보가 있다면, 여기서 읽어서 dailyItems에 포함시키거나 별도로 처리.
  // 예를 들어, data.getYearlyCellMarks(currentDisplayYear) 같은 함수로 해당 연도의 모든 마크 정보를 가져올 수 있음.
  // let yearMarks = data.getYearlyCellMarks(currentDisplayYear) || {};


  // 1. 프로젝트 이벤트 처리 (기존과 동일)
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

  // 2. To-do 처리 (기존과 동일)
  if (currentDisplayYear) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const daysInCurrentMonth = getDaysInMonth(currentDisplayYear, monthIndex);
          for (let day = 1; day <= daysInCurrentMonth; day++) {
              const currentDateObj = new Date(currentDisplayYear, monthIndex, day);
              const dateStr = formatDate(currentDateObj);
              const todosForDay = data.getTodosForDate(dateStr);
              if (todosForDay && todosForDay.length > 0) {
                  if (!dailyItems[dateStr]) dailyItems[dateStr] = [];
                  todosForDay.forEach(todo => {
                      dailyItems[dateStr].push({ ...todo, date: dateStr, itemType: "todo" });
                  });
              }
              const markType = data.getCellMark(dateStr); // dataManager에서 해당 날짜의 마크 정보 가져오기
              if (markType) { // markType이 null이나 undefined가 아니면 (즉, 마크가 설정되어 있으면)
                  const markDefinition = AVAILABLE_MARKS.find(m => m.type === markType);
                  if (markDefinition) {
                      const cell = calendarGridYearlyEl.querySelector(`.mv-day-cell-yearly[data-date="${dateStr}"]`);
                      if (cell) {
                          const markEl = document.createElement('span');
                          markEl.className = `cell-mark-on-date ${markDefinition.cssClass}`; // CSS 적용 위함
                          markEl.textContent = markDefinition.symbol; // 이모지 표시
                          
                          const contentWrapper = cell.querySelector(".mv-day-cell-content-wrapper-yearly") || cell;
                          // 마크는 다른 아이템들과 겹치지 않도록 contentWrapper보다는 cell에 직접 추가하는 것이
                          // z-index 관리나 위치 잡기에 더 용이할 수 있습니다. CSS에서 .cell-mark-on-date 위치를 잘 잡아주세요.
                          // 여기서는 예시로 contentWrapper에 추가합니다. CSS에 맞게 조정 필요.
                          cell.appendChild(markEl); // 또는 contentWrapper.appendChild(markEl);
                      }
                  }
              }
          }
      }
  }
  // console.log("Yearly rendering with dailyItems (after fetching todos):", dailyItems);

    // 3. dailyItems (프로젝트, 투두) DOM 렌더링 (기존과 동일)
    // ... (기존 for (const dateStr in dailyItems) 루프) ...
    for (const dateStr in dailyItems) {
      const cell = calendarGridYearlyEl.querySelector(
          `.mv-day-cell-yearly[data-date="${dateStr}"]`
      );
      if (!cell) continue;

      const contentWrapper = cell.querySelector(".mv-day-cell-content-wrapper-yearly");
      if (!contentWrapper) continue;

      // contentWrapper.innerHTML = ""; // clearAllCellItems에서 이미 처리됨

      dailyItems[dateStr].sort((a, b) =>
          a.itemType === "project" ? -1 : b.itemType === "project" ? 1 : 0
      );

      let yOffset = 0;
      // contentWrapper에 있는 기존 .cell-mark-on-date는 유지하면서 프로젝트/투두를 추가해야 함.
      // 또는, clearAllCellItems에서 .cell-mark-on-date도 지우고, 여기서 마크를 다시 그려야 함. (후자가 더 깔끔)
      // 여기서는 clearAllCellItems에서 마크도 지운다고 가정.

      dailyItems[dateStr].forEach((item) => {
          const itemEl = document.createElement("div");
          itemEl.title = item.itemType === "project" ? item.name : item.text;
          itemEl.textContent = item.itemType === "project" ? item.name : item.text;
          let itemHeight = 0;
          
          if (item.itemType === "project") {
              const sourceLabel = item.labelId ? labels.find((l) => l.id === item.labelId) : null;
              if (!sourceLabel) return; 
              const itemEl = document.createElement("div");
              itemEl.className = "mv-project-bar";
              itemEl.dataset.eventId = item.id;
              itemEl.style.backgroundColor = sourceLabel.color;
              itemEl.style.top = `${yOffset}px`;
              itemEl.title = sourceLabel.name;
              
              // const textSpan = document.createElement('span');
              // textSpan.className = 'mv-project-bar-text';
              // textSpan.textContent = sourceLabel.name;
              // itemEl.appendChild(textSpan);

              // ▼▼▼ [추가] 삭제 버튼(X) 생성 및 이벤트 리스너 추가 ▼▼▼
              const deleteBtn = document.createElement('span');
              deleteBtn.className = 'mv-project-bar-delete';
              deleteBtn.innerHTML = '&times;'; // 'X' 문자
              deleteBtn.title = 'Delete this schedule';
              deleteBtn.addEventListener('click', (e) => handleEventDelete(e, item.id));
              itemEl.appendChild(deleteBtn);
              // ▲▲▲ [추가] ▲▲▲
              
              itemEl.title = sourceLabel.name;
              const itemHeight = 12; // 높이 조절
              itemEl.style.height = `${itemHeight}px`;

              itemEl.addEventListener("click", (e) => handleEventBarClick(e, item));
              itemEl.addEventListener("contextmenu", (e) => handleProjectBarContextMenu(e, item));

              contentWrapper.appendChild(itemEl);
              yOffset += itemHeight + 1;
          } else if (item.itemType === "todo") {
              itemEl.className = "mv-todo-box-in-calendar";
              itemEl.dataset.todoId = item.id;
              itemEl.style.backgroundColor = item.color || "#6c757d";
              itemEl.style.color = "#ffffff"; 
              itemEl.textContent = item.text;
              itemEl.title = item.text;
              itemHeight = 14; 
              itemEl.style.height = `${itemHeight}px`;
          }

          if (itemHeight > 0) {
              itemEl.style.top = `${yOffset}px`;
              contentWrapper.appendChild(itemEl);
              yOffset += itemHeight + 1;
          }
      });
  }
}


/**
 * 셀의 모든 동적 아이템들(프로젝트 바, 투두 박스, 그리고 셀 마크)을 제거합니다.
 */
function clearAllCellItems() {
  if (!calendarGridYearlyEl) return;
  calendarGridYearlyEl
      .querySelectorAll(
          ".mv-day-cell-content-wrapper-yearly .mv-project-bar, " + // 프로젝트 바
          ".mv-day-cell-content-wrapper-yearly .mv-todo-box-in-calendar, " + // 캘린더 내 투두
          ".mv-day-cell-yearly .cell-mark-on-date" // 셀에 표시된 마크
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

              dayCell.addEventListener("contextmenu", (e) => {
                if (isDrawing) { // 그리기 중에는 컨텍스트 메뉴 안 뜨게 (선택적)
                    isDrawing = false;
                    clearTemporaryHighlight();
                    dragStartDate = null;
                    dragCurrentDate = null;
                    // e.preventDefault(); // 이미 drawing 중이었다면, 여기서 preventDefault 불필요할 수도
                    // return;
                }
                showDayCellMarkContextMenu(e, dateStr);
            });

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




function createDayCellMarkContextMenuOnce() {
  if (dayCellMarkContextMenuEl) return; // 이미 생성되었으면 반환

  dayCellMarkContextMenuEl = document.createElement('div');
  dayCellMarkContextMenuEl.className = 'mv-day-cell-context-menu'; // CSS 클래스 적용
  // 기본적으로 숨김 (JS로 display 제어)
  dayCellMarkContextMenuEl.style.display = 'none'; 
  dayCellMarkContextMenuEl.style.position = 'absolute'; // 위치는 JS로

  const titleEl = document.createElement('div');
  titleEl.className = 'context-menu-title';
  titleEl.textContent = '표시 선택:';
  dayCellMarkContextMenuEl.appendChild(titleEl);

  AVAILABLE_MARKS.forEach(mark => {
      const itemEl = document.createElement('div');
      itemEl.className = 'context-menu-item';
      itemEl.dataset.markType = mark.type;
      // itemEl.dataset.markSymbol = mark.symbol; // 심볼은 textContent로 충분

      const iconSpan = document.createElement('span');
      iconSpan.className = `mark-icon ${mark.cssClass}`;
      iconSpan.textContent = mark.symbol;
      itemEl.appendChild(iconSpan);

      const textSpan = document.createElement('span');
      textSpan.textContent = ` ${mark.name}`; // 이름 앞에 공백 추가
      itemEl.appendChild(textSpan);

      itemEl.addEventListener('click', handleMarkSelectionFromMenu);
      dayCellMarkContextMenuEl.appendChild(itemEl);
  });

  document.body.appendChild(dayCellMarkContextMenuEl);
}

function showDayCellMarkContextMenu(event, dateStr) {
  event.preventDefault(); // 브라우저 기본 우클릭 메뉴 방지
  event.stopPropagation(); // 이벤트 버블링 중단

  createDayCellMarkContextMenuOnce(); // 메뉴가 없으면 생성

  currentContextMenuDateStr = dateStr; // 현재 작업 대상 날짜 저장

  // 이전 메뉴 닫기 리스너들 제거 (중복 방지)
  window.removeEventListener('click', hideDayCellMarkContextMenuOnClickOutside, true);
  window.removeEventListener('contextmenu', hideDayCellMarkContextMenuOnAnotherRightClick, true);
  
  dayCellMarkContextMenuEl.style.left = `${event.pageX}px`;
  dayCellMarkContextMenuEl.style.top = `${event.pageY}px`;
  dayCellMarkContextMenuEl.style.display = 'block';

  // 메뉴 외부 클릭 시 메뉴 닫기 (capture true로 다른 클릭보다 먼저 처리 시도)
  setTimeout(() => { // 현재 이벤트 사이클 직후에 리스너 등록
      window.addEventListener('click', hideDayCellMarkContextMenuOnClickOutside, { once: true, capture: true });
      // 다른 우클릭 시 현재 메뉴 닫기 (선택적)
      window.addEventListener('contextmenu', hideDayCellMarkContextMenuOnAnotherRightClick, { once: true, capture: true });
  }, 0);
}

function hideDayCellMarkContextMenu() {
  if (dayCellMarkContextMenuEl) {
      dayCellMarkContextMenuEl.style.display = 'none';
  }
  currentContextMenuDateStr = null;
  // 리스너 제거는 once:true로 인해 자동으로 처리될 수 있지만, 명시적으로 제거할 수도 있음
  window.removeEventListener('click', hideDayCellMarkContextMenuOnClickOutside, true);
  window.removeEventListener('contextmenu', hideDayCellMarkContextMenuOnAnotherRightClick, true);
}

function hideDayCellMarkContextMenuOnClickOutside(event) {
  // 메뉴 자체를 클릭한 경우는 닫지 않음 (메뉴 아이템 클릭은 handleMarkSelectionFromMenu에서 처리)
  if (dayCellMarkContextMenuEl && !dayCellMarkContextMenuEl.contains(event.target)) {
      hideDayCellMarkContextMenu();
  } else if (dayCellMarkContextMenuEl && dayCellMarkContextMenuEl.contains(event.target) && !event.target.closest('.context-menu-item')) {
      // 메뉴 내부지만 아이템이 아닌 곳(예: 타이틀, 빈 공간) 클릭 시, 리스너를 다시 달아줘야 할 수 있음 (once:true 때문)
      // 하지만 아이템 클릭 시 메뉴가 닫히므로 크게 문제되지 않을 수 있음
      // 안전하게 하려면, 아이템 클릭 핸들러에서도 명시적으로 닫고, 여기서도 닫도록.
  }
}

function hideDayCellMarkContextMenuOnAnotherRightClick(event) {
  // 또 다른 우클릭이 메뉴 내부가 아니면 현재 메뉴를 닫음
  if (dayCellMarkContextMenuEl && !dayCellMarkContextMenuEl.contains(event.target)) {
      hideDayCellMarkContextMenu();
  }
}


function handleMarkSelectionFromMenu(event) {
  const selectedMarkType = event.currentTarget.dataset.markType;
  // const markDefinition = AVAILABLE_MARKS.find(m => m.type === selectedMarkType); // data.setCellMark는 markType만 받음

  if (currentContextMenuDateStr) {
      console.log(`[YearlyCalendar] Mark type selected: ${selectedMarkType} for date: ${currentContextMenuDateStr}`);

      // dataManager를 통해 데이터 상태 업데이트 요청
      // selectedMarkType이 "none"이면 null을 전달하여 마크 제거를 나타냄.
      data.setCellMark(currentContextMenuDateStr, selectedMarkType === "none" ? null : selectedMarkType);
      // data.setCellMark 내부의 updateDailyData가 'dataChanged' 이벤트를 발생시킬 것입니다.
      // 이 이벤트는 mainViewHandler에 의해 감지되어 renderYearlyCalendar -> renderAllYearlyCellContent를 호출,
      // 결과적으로 전체 캘린더가 데이터 기준으로 다시 그려지며 마크가 표시/제거됩니다.
  }
  hideDayCellMarkContextMenu(); // 메뉴 아이템 클릭 후 메뉴 닫기
}
