import * as dirtyFileService from './dirtyFileService.js'; // 경로 확인 필요

import { INITIAL_YEAR, PRIORITY_COLORS } from "./constants.js";
import { eventBus } from "./eventBus.js"; // Import the event bus
import {
  generateId,
  getMondayOfWeek,
  formatDate,
} from "./uiUtils.js"; // Ensure generateId is imported

/////////////////////////////////////////
//   State 
/////////////////////////////////////////

// --- 중앙 상태 객체 (Central State Object) ---
let state = {
  // 전역 설정: 앱 전체에 걸쳐 유지됨
  settings: {
      colorPalette: [], // 마스터 색상 팔레트
      lastOpenedYear: INITIAL_YEAR,
  },
  // 연간 데이터: 항상 '하나의 연도'에 대한 데이터만 담음
  yearlyData: null, // { year, labels, events, ... }
  // 월별 데이터: 로드된 연도에 속한 월별 데이터 맵
  dailyData: new Map(), // <'YYYY-MM', { timelines, ... }>
  // 앱의 현재 뷰 상태
  view: {
      currentDisplayYear: INITIAL_YEAR,
      currentWeeklyViewStartDate: getMondayOfWeek(new Date()),
      selectedLabel: null,
  },
};

// --- Getters ---
export function getState() {
  // 필요한 데이터를 조합하여 반환
  const currentYearData = state.yearlyData || {};
  const labels = currentYearData.labels || [];
  
  // 월별 데이터에서 colorPalette를 찾아, 없으면 settings의 마스터 팔레트 사용
  const currentMonthKey = `${state.view.currentDisplayYear}-${String(state.view.currentWeeklyViewStartDate.getMonth() + 1).padStart(2, '0')}`;
  const monthlyPalette = state.dailyData.get(currentMonthKey)?.colorPalette;
  const activeColorPalette = monthlyPalette || state.settings.colorPalette || [];

  return {
      ...state.settings,
      ...currentYearData,
      ...state.view,
      labels: labels, // yearlyData의 labels를 최상위로 노출
      colorPalette: activeColorPalette, // 현재 활성화된 컬러 팔레트
  };
}

/**
 * [헬퍼] daily_view에서 호출할 함수. 특정 월의 원본 데이터를 반환합니다.
 * @param {string} yearMonth - "YYYY-MM"
 * @returns {object | undefined}
 */
export function getRawDailyDataForMonth(yearMonth) {
  return state.dailyData.get(yearMonth);
}

/**
 * [헬퍼] daily_view에서 호출할 함수. 전역 설정 객체를 반환합니다.
 * @returns {object}
 */
export function getSettings() {
  return state.settings;
}

///////////////////////////////////////////
//   Data Save & Load
///////////////////////////////////////////

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


// --- 데이터 로딩 및 초기화 ---
export async function loadDataForYear(year) {
  console.log(`DataManager: Unloading old year and loading data for ${year}...`);
  state.yearlyData = null;
  state.dailyData.clear();

  const settingsIdentifier = 'settings.json';
  let settingsData = dirtyFileService.getDirtyFileData(settingsIdentifier);
  if (settingsData) {
      state.settings = settingsData;
  } else {
      try {
          const response = await fetch(`./data/settings.json`);
          if (response.ok) state.settings = await response.json();
          else state.settings = { colorPalette: [], lastOpenedYear: INITIAL_YEAR }; // Fallback
      } catch (e) {
          console.warn('Could not load settings.json.');
          state.settings = { colorPalette: [], lastOpenedYear: INITIAL_YEAR }; // Fallback
      }
  }

  const yearlyIdentifier = `${year}/${year}.json`;
  let yearlyPageData = dirtyFileService.getDirtyFileData(yearlyIdentifier);
  if (yearlyPageData) {
      state.yearlyData = yearlyPageData;
  } else {
      try {
          const response = await fetch(`./data/${yearlyIdentifier}`);
          // [수정] calendarCellTodos 없는 기본 구조
          state.yearlyData = response.ok ? await response.json() : { year, labels: [], events: [], backlogTodos: [] };
      } catch (e) {
          state.yearlyData = { year, labels: [], events: [], backlogTodos: [] }; // [수정]
          console.warn(`Could not load ${yearlyIdentifier}. Initializing empty data.`);
      }
  }
  // yearlyData에 backlogTodos가 없으면 초기화
  if (state.yearlyData && !state.yearlyData.backlogTodos) {
      state.yearlyData.backlogTodos = [];
  }


  for (let i = 1; i <= 12; i++) {
      const month = String(i).padStart(2, '0');
      const dailyIdentifier = `${year}/${year}-${month}.json`;
      let dailyPageData = dirtyFileService.getDirtyFileData(dailyIdentifier);
      if (dailyPageData) {
          state.dailyData.set(`${year}-${month}`, dailyPageData);
      } else {
          try {
              const response = await fetch(`./data/${dailyIdentifier}`);
              if (response.ok) {
                  state.dailyData.set(`${year}-${month}`, await response.json());
              }
          } catch (e) { /* 오류 처리 생략 */ }
      }
  }

  const todayDate = new Date(); // 변수명 변경
  todayDate.setHours(0, 0, 0, 0);
  state.view.currentDisplayYear = year;
  if (year === todayDate.getFullYear()) {
      state.view.currentWeeklyViewStartDate = getMondayOfWeek(todayDate);
  } else {
      state.view.currentWeeklyViewStartDate = getMondayOfWeek(new Date(year, 0, 1));
  }
  eventBus.dispatch('dataChanged', { source: 'yearChange' });
}


export function getAllDataForSave() {
  return state.yearlyData;
}



/**
 * 현재 로드된 연도의 모든 데이터를 수집하여 반환 (연간 저장용)
 */

export function getCurrentYearDataForSave() {
  const year = state.view.currentDisplayYear;
  const files = [];
  if (state.yearlyData) { // yearlyData에는 이제 calendarCellTodos가 없음
      files.push({
          filenameInZip: `${year}/${year}.json`,
          data: state.yearlyData
      });
  }
  state.dailyData.forEach((monthData, key) => {
      const dataForSave = { ...monthData };
      if (!dataForSave.hasOwnProperty('colorPalette')) {
          dataForSave.colorPalette = state.settings.colorPalette || [];
      }
      files.push({
          filenameInZip: `${year}/${key}.json`,
          data: dataForSave
      });
  });
  return files;
}


/**
 * 불러온 연간 백업 데이터로 특정 연도 데이터를 덮어쓰기
 */
export function loadYearFromBackup(year, filesData) {
  // 현재 표시 연도와 백업 연도가 다르면, 기존 메모리 내 데이터 초기화
  if (state.view.currentDisplayYear !== year) {
      state.yearlyData = null;
      state.dailyData.clear();
      state.view.currentDisplayYear = year;
  } else {
      // 같은 연도 데이터를 덮어쓰는 경우에도, 기존 dailyData는 비워주는 것이 안전
      state.dailyData.clear();
  }

  filesData.forEach(fileInfo => {
      const { filenameInZip, data } = fileInfo;

      if (filenameInZip === `${year}/${year}.json`) {
          state.yearlyData = data;
          if (state.yearlyData && !state.yearlyData.backlogTodos) {
              state.yearlyData.backlogTodos = [];
          }
          dirtyFileService.markFileAsDirty(filenameInZip, state.yearlyData);
      } else if (filenameInZip.startsWith(`${year}/${year}-`)) {
          const key = filenameInZip.replace(`${year}/`, '').replace('.json', ''); // 예: "2025-05"
          state.dailyData.set(key, data);
          dirtyFileService.markFileAsDirty(filenameInZip, data);
      }
  });

  // Settings는 ZIP에 포함되지 않았으므로, settings.json을 dirty로 만들 필요는 없습니다.
  // 만약 settings도 ZIP에 포함하고 로드한다면, 여기서 settings.json도 dirty로 마킹해야 합니다.

  eventBus.dispatch('dataChanged', { source: 'fileLoad', yearLoaded: year }); // 어떤 연도가 로드되었는지 정보 추가
  
  // ZIP 로드 후에는 해당 연도의 dirty 파일 상태는 LocalStorage의 내용으로 "깨끗해진" 것이므로,
  // clearAllDirtyFilesForYear를 호출할 필요가 없습니다.
  // 오히려 호출하면 방금 dirty로 마킹한 것을 지우게 됩니다.
  // clearAllDirtyFilesForYear(year); // <--- 이 줄은 주석 처리하거나 삭제해야 합니다.
}



export function clearAllDirtyFilesForYear(year) {
  dirtyFileService.clearDirtyFile(`${year}/${year}.json`);
  for (let i = 1; i <= 12; i++) {
      const month = String(i).padStart(2, '0');
      dirtyFileService.clearDirtyFile(`${year}/${year}-${month}.json`);
  }
}


/**
 * 월별 데이터를 업데이트하고 dirty로 표시하는 전용 함수
 * @param {string} yearMonth - 업데이트할 월의 키 (예: "2025-05")
 * @param {object} newData - 해당 월의 새로운 전체 데이터 객체
 */
export function updateDailyData(yearMonth, newData) {
  const year = yearMonth.split('-')[0];
  if (state.view.currentDisplayYear != year) {
      console.warn(`Attempted to update daily data for ${yearMonth}, but current view is ${state.view.currentDisplayYear}.`);
      return;
  }
  state.dailyData.set(yearMonth, newData);
  const fileIdentifier = `${year}/${yearMonth}.json`;
  dirtyFileService.markFileAsDirty(fileIdentifier, newData);
  eventBus.dispatch('dataChanged', { source: 'updateDailyData', payload: { yearMonth } });
}

/////////////////////////////////////////////////////////
//   sync todo within weekly calendar with dailyData
///////////////////////////////////////////////////////// 

function getOrInitializeDayDataStructure(monthDataObject, dateStr) {
  if (!monthDataObject.dailyData) {
      monthDataObject.dailyData = {};
  }
  if (!monthDataObject.dailyData[dateStr]) {
      monthDataObject.dailyData[dateStr] = {
          timeBlock: {},
          goalBlock: {},
          scheduledTimelineTasks: [],
          todos: [], // 여기가 핵심
          projectTodos: [],
          routines: [],
          diary: {}
      };
  } else if (!monthDataObject.dailyData[dateStr].todos) {
      monthDataObject.dailyData[dateStr].todos = [];
  }
  return monthDataObject.dailyData[dateStr];
}

export function getTodosForDate(dateStr) {
  const yearMonth = dateStr.substring(0, 7);
  const monthData = state.dailyData.get(yearMonth);
  return monthData?.dailyData?.[dateStr]?.todos || [];
}

////////////////////////////////////////////////
//   Data Manipulators
////////////////////////////////////////////////

// --- Setters / Updaters ---
export function updateCurrentDisplayYear(year) {
  const numericYear = parseInt(year, 10);
  if (state.view.currentDisplayYear !== numericYear) {
      loadDataForYear(numericYear);
  }
}

export function updateCurrentWeeklyViewStartDate(date) {
  const newMonday = getMondayOfWeek(new Date(date));
  newMonday.setHours(0, 0, 0, 0);
  if (state.view.currentWeeklyViewStartDate && newMonday.getTime() === state.view.currentWeeklyViewStartDate.getTime()) {
      return;
  }
  state.view.currentWeeklyViewStartDate = newMonday;
  eventBus.dispatch("dataChanged", { source: "updateCurrentWeeklyViewStartDate" });
}

export function addLabel(label) {
  if (!state.yearlyData) state.yearlyData = { year: state.view.currentDisplayYear, labels: [], events: [], backlogTodos: [] };
  if (!state.yearlyData.labels) state.yearlyData.labels = [];
  state.yearlyData.labels.push(label);
  eventBus.dispatch('dataChanged', { source: 'addLabel' });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
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
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

/**
 * Backlog의 할 일 순서를 변경합니다.
 * @param {string[]} orderedTodoIds - 새로운 순서의 할 일 ID 배열
 */
// dataManager.js의 reorderBacklogTodos 함수 내에 로그 추가
export function reorderBacklogTodos(orderedTodoIds) {
  console.log("[DataManager reorderBacklogTodos] Received ordered IDs:", orderedTodoIds);
  if (!state.yearlyData || !state.yearlyData.backlogTodos) {
      console.warn("[DataManager reorderBacklogTodos] yearlyData or backlogTodos not found.");
      return;
  }
  console.log("[DataManager reorderBacklogTodos] State BEFORE reorder:", JSON.stringify(state.yearlyData.backlogTodos.map(t => t.id)));

  state.yearlyData.backlogTodos = orderedTodoIds
      .map(id => {
          const todo = state.yearlyData.backlogTodos.find(t => t.id === id);
          // if (!todo) console.warn(`[DataManager reorderBacklogTodos] Todo with ID ${id} not found during map.`);
          return todo;
      })
      .filter(Boolean); 

  console.log("[DataManager reorderBacklogTodos] State AFTER reorder:", JSON.stringify(state.yearlyData.backlogTodos.map(t => t.id)));

  eventBus.dispatch('dataChanged', { source: 'reorderBacklogTodos' });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function addEvent(event) {
  state.yearlyData.events.push(event);
  eventBus.dispatch("dataChanged", { source: "addEvent" });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

// --- Event (Project Bar) Manipulators ---
export function deleteEvent(eventId) {
  state.yearlyData.events = state.yearlyData.events.filter(event => event.id !== eventId);
  eventBus.dispatch('dataChanged', { source: 'deleteEvent' });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateEventDates(eventId, newStartDate, newEndDate) {
  const event = state.yearlyData.events.find((event) => event.id === eventId);
  if (event) {
    eventBus.dispatch('dataChanged', { source: 'updateEventDates' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
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
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteBacklogTodo(todoId) {
  state.yearlyData.backlogTodos = state.yearlyData.backlogTodos.filter(todo => todo.id !== todoId);
  eventBus.dispatch('dataChanged', { source: 'deleteBacklogTodo' });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateBacklogTodoText(todoId, newText) {
  const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
  if (todo && newText && todo.text !== newText.trim()) { // newText.trim()으로 공백 제거 후 비교
      todo.text = newText.trim(); // <<--- 실제 데이터 변경 코드
      eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoText' });
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function updateBacklogTodoPriority(todoId, newPriority) {
  const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
  const priority = parseInt(newPriority, 10);
  if (todo && !isNaN(priority) && todo.priority !== priority) { // 값 변경 시에만
      todo.priority = priority; // <<--- 실제 데이터 변경 코드
      todo.color = PRIORITY_COLORS[priority] || "#ccc"; // 색상도 함께 업데이트
      eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoPriority' });
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}


/**
 * Moves a todo from the backlog to a specific date on the calendar.
 * @param {string} todoId - The ID of the todo to move.
 * @param {string} targetDate - The date string (YYYY-MM-DD) to move the todo to.
 */
export function moveBacklogTodoToCalendar(todoId, targetDate) {
  if (!state.yearlyData || !state.yearlyData.backlogTodos) return;

  const todoToMoveIndex = state.yearlyData.backlogTodos.findIndex(t => t.id === todoId);
  if (todoToMoveIndex === -1) return;

  const [todoItemFromBacklog] = state.yearlyData.backlogTodos.splice(todoToMoveIndex, 1);
  // Backlog 원본 데이터 변경 알림 (Backlog UI 업데이트용)
  eventBus.dispatch('dataChanged', { source: 'moveBacklogTodoToCalendar_removedFromBacklog', payload: { updatedBacklog: state.yearlyData.backlogTodos } });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);

  const yearMonth = targetDate.substring(0, 7);
  // 월 데이터 복사 (직접 수정을 피하기 위함)
  const monthData = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
  
  const dayData = getOrInitializeDayDataStructure(monthData, targetDate);

  const newCalendarTodo = {
      id: generateId('daytodo_'), // 일간 To-do를 위한 새 ID
      originalBacklogId: todoItemFromBacklog.id, // 필요시 추적용
      text: todoItemFromBacklog.text,
      completed: false,
      color: todoItemFromBacklog.color, // Backlog 아이템 색상 유지
      importance: todoItemFromBacklog.priority !== undefined ? todoItemFromBacklog.priority : 0, // 우선순위를 중요도로 매핑
      time: 0, // 기본 소요 시간
      // Daily View의 To-do가 가질 수 있는 다른 기본 속성들 추가 가능
  };
  dayData.todos.push(newCalendarTodo);
  updateDailyData(yearMonth, monthData); // 변경된 월 데이터로 업데이트
}



export function moveCalendarTodoToDate(todoId, newDate) {
  const todo = state.yearlyData.calendarCellTodos.find(t => t.id === todoId);
  if (todo) {
      todo.date = newDate;
      eventBus.dispatch('dataChanged', { source: 'moveCalendarTodo' });
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
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
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteCalendarTodo(todoId) {
  state.yearlyData.calendarCellTodos = state.yearlyData.calendarCellTodos.filter(todo => todo.id !== todoId);
  eventBus.dispatch('dataChanged', { source: 'deleteCalendarTodo' });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateCalendarTodoText(todoId, newText) {
  const todo = state.yearlyData.calendarCellTodos.find(todo => todo.id === todoId);
  if (todo && newText && todo.text !== newText.trim()) {
      todo.text = newText.trim();
      eventBus.dispatch('dataChanged', { source: 'updateCalendarTodoText' });
      // --- [Phase 6] 추가: yearlyData가 변경되었으므로 dirty 표시 ---
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

export function updateLabelName(labelId, newName) {
  const label = state.yearlyData.labels.find(l => l.id === labelId);
  if (label && newName && newName.trim() !== '' && label.name !== newName.trim()) { // 변경이 있을 때만
      label.name = newName.trim();
      eventBus.dispatch('dataChanged', { source: 'updateLabelName' });
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
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
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
}

/**
 * [수정된 함수] 특정 날짜의 calendarCellTodos 순서를 변경합니다.
 * @param {string} date - 대상 날짜 (YYYY-MM-DD)
 * @param {string[]} orderedTodoIds - 새로운 순서의 할 일 ID 배열
 */
export function reorderCalendarCellTodos(date, orderedTodoIds) {
  // getState()를 호출하는 대신, 모듈 스코프의 원본 state를 직접 사용합니다.
  if (!state.yearlyData) return;

  // 해당 날짜를 제외한 다른 모든 날짜의 할 일 목록
  const todosForOtherDates = state.yearlyData.calendarCellTodos.filter(
      (todo) => todo.date !== date
  );

  // 전달받은 ID 순서대로 대상 날짜의 할 일 목록을 재정렬
  const todosForTargetDate = orderedTodoIds
      .map((id) =>
          state.yearlyData.calendarCellTodos.find(
              (todo) => todo.id === id && todo.date === date
          )
      )
      .filter(Boolean); // 혹시 모를 undefined/null 값을 제거

  // 유효성 검사 (기존 코드 유지)
  if (
      todosForTargetDate.length !== orderedTodoIds.length &&
      state.yearlyData.calendarCellTodos.filter((todo) => todo.date === date).length !==
      orderedTodoIds.length
  ) {
      console.warn(
          "DataManager: Mismatch in reordering calendar cell todos for date",
          date
      );
  }

  // 다른 날짜의 할 일과 재정렬된 할 일을 합쳐서 원본 상태를 업데이트합니다.
  state.yearlyData.calendarCellTodos = [...todosForOtherDates, ...todosForTargetDate];

  // 변경사항 전파 및 dirty 마킹
  eventBus.dispatch('dataChanged', { source: 'reorderCalendarCellTodos', date });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}


////////////////////////////////////////////////
//   sync todo within weekly calendar with dailyData
////////////////////////////////////////////////



export function addTodoForDate(dateStr, todoText, todoDetails = {}) {
  const yearMonth = dateStr.substring(0, 7);
  const monthData = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
  const dayData = getOrInitializeDayDataStructure(monthData, dateStr);

  const newTodo = {
      id: generateId('daytodo_'),
      text: todoText,
      completed: false,
      color: todoDetails.color || "#6c757d", // 기본 색상
      importance: todoDetails.importance || 0,
      time: todoDetails.time || 0,
      ...todoDetails // id, text, completed는 덮어쓰지 않도록 주의
  };
  // id, text, completed는 위에서 설정했으므로, todoDetails에서 중복으로 덮어쓰지 않게 삭제
  delete newTodo.id; 
  delete newTodo.text;
  delete newTodo.completed;
  
  const finalTodo = {
      id: generateId('daytodo_'),
      text: todoText,
      completed: false,
      color: todoDetails.color || "#6c757d",
      importance: todoDetails.importance || 0,
      time: todoDetails.time || 0,
      ...todoDetails
  };


  dayData.todos.push(finalTodo);
  updateDailyData(yearMonth, monthData);
}

export function deleteTodoForDate(dateStr, todoId) {
  const yearMonth = dateStr.substring(0, 7);
  const monthData = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
  const dayData = getOrInitializeDayDataStructure(monthData, dateStr);
  
  const initialLength = dayData.todos.length;
  dayData.todos = dayData.todos.filter(todo => todo.id !== todoId);

  if (dayData.todos.length !== initialLength) { // 실제로 삭제가 일어났다면
      updateDailyData(yearMonth, monthData);
  }
}

export function updateTodoPropertyForDate(dateStr, todoId, propertyName, newValue) {
  const yearMonth = dateStr.substring(0, 7);
  const monthData = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
  const dayData = getOrInitializeDayDataStructure(monthData, dateStr);
  
  const todo = dayData.todos.find(t => t.id === todoId);
  if (todo && todo[propertyName] !== newValue) {
      todo[propertyName] = newValue;
      if (propertyName === 'text' && typeof newValue === 'string') {
          todo.text = newValue.trim(); // 텍스트인 경우 trim 처리
      }
      updateDailyData(yearMonth, monthData);
  }
}

export function reorderTodosForDate(dateStr, orderedTodoIds) {
  const yearMonth = dateStr.substring(0, 7);
  const monthData = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
  const dayData = getOrInitializeDayDataStructure(monthData, dateStr);

  // 순서가 실제로 변경되었는지 확인하는 로직 추가 (옵션)
  const originalOrder = dayData.todos.map(t => t.id).join(',');
  const newOrder = orderedTodoIds.join(',');

  if (originalOrder !== newOrder) {
      dayData.todos = orderedTodoIds
          .map(id => dayData.todos.find(todo => todo.id === id))
          .filter(Boolean);
      updateDailyData(yearMonth, monthData);
  }
}
