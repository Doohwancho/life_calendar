import * as dirtyFileService from './dirtyFileService.js'; // 경로 확인 필요

import { INITIAL_YEAR, PRIORITY_COLORS } from "./constants.js";
import { eventBus } from "./eventBus.js"; // Import the event bus
import {
  generateId,
  getMondayOfWeek,
  formatDate,
} from "./uiUtils.js"; // Ensure generateId is imported

// --- 중앙 상태 객체 (Central State Object) ---
const state = {
  // settings.json에서 로드될 데이터
  settings: {
    colorPalette: [],
    lastOpenedYear: INITIAL_YEAR,
  },
  // yearly/YYYY.json에서 로드될 데이터
  yearlyData: {
    year: INITIAL_YEAR,
    labels: [],
    events: [],
    backlogTodos: [],
    calendarCellTodos: [],
  },
  // 앱의 현재 뷰 상태
  view: {
    currentDisplayYear: INITIAL_YEAR,
    currentWeeklyViewStartDate: getMondayOfWeek(new Date()),
    selectedLabel: null,
  },
};

// --- Getters ---
// 이제 각 데이터 부분에 더 쉽게 접근할 수 있는 getter를 제공합니다.
export function getState() {
  return {
    // settings
    ...state.settings,
    // yearlyData
    ...state.yearlyData,
    // view
    ...state.view,
  };
}

// --- 데이터 로딩 및 초기화 ---

// loadDataForYear 함수 수정
export async function loadDataForYear(year) {
  console.log(`DataManager: Loading data for year ${year}...`);
  const yearlyFileIdentifier = `yearly/${year}.json`;
  const settingsFileIdentifier = `settings.json`;

  try {
      // 1. 설정 데이터 로드 (localStorage 우선)
      let settingsData = dirtyFileService.getDirtyFileData(settingsFileIdentifier);
      if (settingsData) {
          state.settings = settingsData;
          console.log(`Loaded settings from dirty store.`);
      } else {
          const settingsPath = './data/settings.json'; // js 폴더 기준이므로 ./data/
          const settingsResponse = await fetch(settingsPath);
          if (settingsResponse.ok) {
              state.settings = await settingsResponse.json();
              // 파일에서 성공적으로 로드했으면, 해당 파일의 dirty 상태는 제거
              // dirtyFileService.clearDirtyFile(settingsFileIdentifier);
          } else {
              console.warn(`Could not load ${settingsPath}. Using default settings.`);
          }
      }

      // 2. 연간 데이터 로드 (localStorage 우선)
      let yearlyPageData = dirtyFileService.getDirtyFileData(yearlyFileIdentifier);
      if (yearlyPageData) {
          state.yearlyData = yearlyPageData;
          console.log(`Loaded yearly data for ${year} from dirty store.`);
      } else {
          const yearlyPath = `./data/yearly/${year}.json`; // js 폴더 기준
          const yearlyResponse = await fetch(yearlyPath);
          if (yearlyResponse.ok) {
              state.yearlyData = await yearlyResponse.json();
              // dirtyFileService.clearDirtyFile(yearlyFileIdentifier);
          } else {
              console.warn(`Could not load ${yearlyPath}. Initializing empty data for year ${year}.`);
              state.yearlyData = {
                  year: year, labels: [], events: [], backlogTodos: [], calendarCellTodos: [],
              };
          }
      }
      
      state.view.currentDisplayYear = year;
      // 연도가 변경될 때 currentWeeklyViewStartDate를 새 연도 기준으로 업데이트
      const currentMonth = state.view.currentWeeklyViewStartDate.getMonth(); // 기존 주의 월
      const currentDate = state.view.currentWeeklyViewStartDate.getDate();  // 기존 주의 일

      let newWeekStartForYear = new Date(year, currentMonth, currentDate);
      // 만약 새 연도에 해당 월/일이 없다면 (예: 2월 29일), 해당 연도의 1월 1일로 설정
      if (newWeekStartForYear.getFullYear() !== year || 
          newWeekStartForYear.getMonth() !== currentMonth || 
          newWeekStartForYear.getDate() !== currentDate) {
          newWeekStartForYear = new Date(year, 0, 1); // 해당 연도의 1월 1일
      }
      state.view.currentWeeklyViewStartDate = getMondayOfWeek(newWeekStartForYear);
  } catch (error) {
      console.error("Error loading initial data:", error);
  } finally {
      eventBus.dispatch('dataChanged', { source: 'initialLoadOrYearChange' });
  }
}

// --- Setters / Updaters ---
export function updateCurrentDisplayYear(year) {
  const numericYear = parseInt(year, 10);
  if (state.view.currentDisplayYear !== numericYear) {
    // 연도가 바뀌면 해당 연도의 데이터를 새로 로드합니다.
    loadDataForYear(numericYear);
  }
}

export function updateCurrentWeeklyViewStartDate(date) {
  const newMonday = getMondayOfWeek(new Date(date));
  newMonday.setHours(0, 0, 0, 0);

  if (
    state.view.currentWeeklyViewStartDate &&
    newMonday.getTime() === state.view.currentWeeklyViewStartDate.getTime()
  ) {
    return;
  }
  state.view.currentWeeklyViewStartDate = newMonday;
  eventBus.dispatch("dataChanged", {
    source: "updateCurrentWeeklyViewStartDate",
  });
}

export function addLabel(label) {
  state.yearlyData.labels.push(label);
  eventBus.dispatch('dataChanged', { source: 'addLabel' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function setSelectedLabel(label) {
  state.view.selectedLabel = label;
  console.log("[DataManager] setSelectedLabel:", label);
  // 필요하다면 여기서 eventBus.dispatch('dataChanged', { source: 'selectedLabelChanged' }); 호출 가능
  // 하지만 현재 Yearly Calendar는 getState()를 통해 직접 읽으므로 필수는 아님.
  eventBus.dispatch('dataChanged', { source: 'selectedLabelChanged' });
}

/**
 * 라벨 배열의 순서를 변경합니다. (드래그 앤 드롭용)
 * @param {string[]} orderedLabelIds - 새로운 순서의 라벨 ID 배열
 */
export function reorderLabels(orderedLabelIds) {
  state.yearlyData.labels = orderedLabelIds
      .map(id => state.yearlyData.labels.find(l => l.id === id))
      .filter(Boolean);
  eventBus.dispatch('dataChanged', { source: 'reorderLabels' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function addEvent(event) {
  state.yearlyData.events.push(event);
  eventBus.dispatch("dataChanged", { source: "addEvent" });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

// --- Event (Project Bar) Manipulators ---
export function deleteEvent(eventId) {
  state.yearlyData.events = state.yearlyData.events.filter(event => event.id !== eventId);
  eventBus.dispatch('dataChanged', { source: 'deleteEvent' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateEventDates(eventId, newStartDate, newEndDate) {
  const event = state.yearlyData.events.find((event) => event.id === eventId);
  if (event) {
    eventBus.dispatch('dataChanged', { source: 'updateEventDates' });
    dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function isDuplicateEvent({ labelId, startDate, endDate }) {
  return state.yearlyData.events.some(
    (event) =>
      event.labelId === labelId &&
      event.startDate === startDate &&
      event.endDate === endDate
  );
}

/**
 * Replaces the entire application state with data from a loaded file.
 * @param {object} dataBundle - The `calendarData` object from a saved JSON file.
 */
export function loadAllData(loadedYearlyData = {}) {
  // 파일 구조 유효성 검사
  if (typeof loadedYearlyData.year !== "number") {
    alert("잘못된 형식의 연간 데이터 파일입니다.");
    return;
  }

  state.yearlyData = loadedYearlyData;
  state.view.currentDisplayYear = loadedYearlyData.year;

  console.log("Data loaded into state from file:", state);
  eventBus.dispatch("dataChanged", { source: "fileLoad" });
}

export function getAllDataForSave() {
  return state.yearlyData;
}

////////////////////////////////////////////////
//   Backlog
////////////////////////////////////////////////

export function addBacklogTodo(text, priority = 0) {
  if (!text) return;
  const newTodo = {
    id: generateId(),
    text,
    priority: parseInt(priority, 10),
    color: PRIORITY_COLORS[priority] || "#ccc",
  };
  state.yearlyData.backlogTodos.push(newTodo);
  eventBus.dispatch('dataChanged', { source: 'addBacklogTodo' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteBacklogTodo(todoId) {
  state.yearlyData.backlogTodos = state.yearlyData.backlogTodos.filter(todo => todo.id !== todoId);
  eventBus.dispatch('dataChanged', { source: 'deleteBacklogTodo' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateBacklogTodoText(todoId, newText) {
  const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
  if (todo && newText && todo.text !== newText.trim()) { // newText.trim()으로 공백 제거 후 비교
      todo.text = newText.trim(); // <<--- 실제 데이터 변경 코드
      eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoText' });
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function updateBacklogTodoPriority(todoId, newPriority) {
  const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
  const priority = parseInt(newPriority, 10);
  if (todo && !isNaN(priority) && todo.priority !== priority) { // 값 변경 시에만
      todo.priority = priority; // <<--- 실제 데이터 변경 코드
      todo.color = PRIORITY_COLORS[priority] || "#ccc"; // 색상도 함께 업데이트
      eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoPriority' });
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}


/**
 * Moves a todo from the backlog to a specific date on the calendar.
 * @param {string} todoId - The ID of the todo to move.
 * @param {string} targetDate - The date string (YYYY-MM-DD) to move the todo to.
 */
export function moveBacklogTodoToCalendar(todoId, targetDate) {
  const todoToMoveIndex = state.yearlyData.backlogTodos.findIndex(
      (todo) => todo.id === todoId
  );

  if (todoToMoveIndex > -1) {
      const [todoToMove] = state.yearlyData.backlogTodos.splice(todoToMoveIndex, 1);

      // --- [수정 및 추가] newCalendarTodo 객체 생성 ---
      const newCalendarTodo = {
          id: generateId('cal_'), // 새 ID 생성 (calendarCellTodo용)
          originalBacklogId: todoToMove.id, // 원래 backlog ID 추적 가능
          date: targetDate,
          text: todoToMove.text,
          color: todoToMove.color, // 백로그 아이템의 색상 유지
          type: "todo", 
      };
      // -----------------------------------------

      state.yearlyData.calendarCellTodos.push(newCalendarTodo); // 여기서 newCalendarTodo 사용
      eventBus.dispatch('dataChanged', { source: 'backlog-to-calendar' });
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function moveCalendarTodoToDate(todoId, newDate) {
  const todo = state.yearlyData.calendarCellTodos.find(t => t.id === todoId);
  if (todo) {
      todo.date = newDate;
      eventBus.dispatch('dataChanged', { source: 'moveCalendarTodo' });
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

// --- Calendar Cell Todo Manipulators ---
export function addCalendarTodo({ date, text }) {
  if (!date || !text) return;
  const newTodo = {
    id: generateId(),
    date,
    text,
    color: "#6c757d", // Default color for directly added todos
    type: "todo",
  };
  state.yearlyData.calendarCellTodos.push(newTodo);
  eventBus.dispatch('dataChanged', { source: 'addCalendarTodo' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteCalendarTodo(todoId) {
  state.yearlyData.calendarCellTodos = state.yearlyData.calendarCellTodos.filter(todo => todo.id !== todoId);
  eventBus.dispatch('dataChanged', { source: 'deleteCalendarTodo' });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateCalendarTodoText(todoId, newText) {
  const todo = state.yearlyData.calendarCellTodos.find(todo => todo.id === todoId);
  if (todo && newText && todo.text !== newText.trim()) {
      todo.text = newText.trim();
      eventBus.dispatch('dataChanged', { source: 'updateCalendarTodoText' });
      // --- [Phase 6] 추가: yearlyData가 변경되었으므로 dirty 표시 ---
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function updateLabelName(labelId, newName) {
  const label = state.yearlyData.labels.find(l => l.id === labelId);
  if (label && newName && newName.trim() !== '' && label.name !== newName.trim()) { // 변경이 있을 때만
      label.name = newName.trim();
      eventBus.dispatch('dataChanged', { source: 'updateLabelName' });
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function deleteLabelAndAssociatedEvents(labelIdToDelete) {
  const originalLabelCount = state.yearlyData.labels.length;
  const originalEventCount = state.yearlyData.events.length;

  state.yearlyData.labels = state.yearlyData.labels.filter(label => label.id !== labelIdToDelete);
  state.yearlyData.events = state.yearlyData.events.filter(event => event.labelId !== labelIdToDelete);

  if (state.yearlyData.labels.length !== originalLabelCount || state.yearlyData.events.length !== originalEventCount) {
      if (state.view.selectedLabel && state.view.selectedLabel.id === labelIdToDelete) {
          setSelectedLabel(null); // dataChanged 이벤트를 발생시킴
      } else {
          eventBus.dispatch('dataChanged', { source: 'deleteLabelAndEvents' });
      }
      dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

/**
 * 특정 날짜의 calendarCellTodos 순서를 변경합니다.
 * @param {string} date - 대상 날짜 (YYYY-MM-DD)
 * @param {string[]} orderedTodoIds - 새로운 순서의 할 일 ID 배열
 */
export function reorderCalendarCellTodos(date, orderedTodoIds) {
  const state = getState();
  const todosForOtherDates = state.calendarCellTodos.filter(
    (todo) => todo.date !== date
  );
  const todosForTargetDate = orderedTodoIds
    .map((id) =>
      state.calendarCellTodos.find(
        (todo) => todo.id === id && todo.date === date
      )
    )
    .filter(Boolean); // 유효한 todo만 필터링

  if (
    todosForTargetDate.length !== orderedTodoIds.length &&
    state.yearlyData.calendarCellTodos.filter((todo) => todo.date === date).length !==
      orderedTodoIds.length
  ) {
    // ID 배열과 실제 해당 날짜의 투두 개수가 다르면 오류 가능성이 있으므로 로깅
    console.warn(
      "DataManager: Mismatch in reordering calendar cell todos for date",
      date
    );
  }

  state.yearlyData.calendarCellTodos = [...todosForOtherDates, ...todosForTargetDate];
  eventBus.dispatch('dataChanged', { source: 'reorderCalendarCellTodos', date });
  dirtyFileService.markFileAsDirty(`yearly/${state.view.currentDisplayYear}.json`, state.yearlyData);
}
