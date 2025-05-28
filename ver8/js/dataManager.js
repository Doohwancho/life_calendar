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
  const activeColorPalette = monthlyPalette || state.settings.colorPalette;

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
  
  // 1. 기존 연도 데이터 초기화
  state.yearlyData = null;
  state.dailyData.clear();

  // 2. settings.json 로드 (앱 실행 시 한 번만 로드해도 되지만, 안전하게 매번 확인)
  const settingsIdentifier = 'settings.json';
  let settingsData = dirtyFileService.getDirtyFileData(settingsIdentifier);
  if (settingsData) {
      state.settings = settingsData;
  } else {
      try {
          const response = await fetch(`./data/settings.json`);
          if (response.ok) state.settings = await response.json();
      } catch (e) { console.warn('Could not load settings.json.'); }
  }

  // 3. 새 연도의 yearly.json 로드
  const yearlyIdentifier = `${year}/${year}.json`;
  let yearlyPageData = dirtyFileService.getDirtyFileData(yearlyIdentifier);
  if (yearlyPageData) {
      state.yearlyData = yearlyPageData;
  } else {
      try {
          const response = await fetch(`./data/${yearlyIdentifier}`);
          state.yearlyData = response.ok ? await response.json() : { year, labels: [], events: [], backlogTodos: [], calendarCellTodos: [] };
      } catch (e) {
           state.yearlyData = { year, labels: [], events: [], backlogTodos: [], calendarCellTodos: [] };
           console.warn(`Could not load ${yearlyIdentifier}. Initializing empty data.`);
      }
  }

  // 4. 새 연도의 모든 daily-MM.json 파일 로드 시도
  for (let i = 1; i <= 12; i++) {
    const month = String(i).padStart(2, '0');
    const dailyIdentifier = `${year}/${year}-${month}.json`; // 예: "2025/2025-01.json"
    let dailyPageData = dirtyFileService.getDirtyFileData(dailyIdentifier);
    if (dailyPageData) {
        state.dailyData.set(`${year}-${month}`, dailyPageData);
    } else {
        try {
            // 경로가 ./data/YYYY/YYYY-MM.json 형태여야 합니다.
            const response = await fetch(`./data/${dailyIdentifier}`); 
            if (response.ok) {
                state.dailyData.set(`${year}-${month}`, await response.json());
            } else {
                // 404 오류 등이 발생하면 response.ok가 false가 됩니다.
                // 이 경우, 해당 월의 데이터는 없는 것으로 간주하고 넘어갑니다.
                // 콘솔에 경고를 남길 수 있지만, 앱을 중단시키지는 않습니다.
                if (response.status === 404) {
                    // console.log(`Data file not found for ${dailyIdentifier}, normal for new month/year.`);
                } else {
                    // console.warn(`Failed to load ${dailyIdentifier}: ${response.statusText}`);
                }
            }
        } catch (e) { 
            // 네트워크 오류 등으로 fetch 자체가 실패한 경우
            // console.error(`Error fetching ${dailyIdentifier}:`, e);
            // 파일이 없는 것은 정상적인 상황일 수 있으므로, 특별한 오류 처리를 하지 않고 넘어갑니다.
        }
    }
  }
  
  // 5. 뷰 상태 업데이트 및 UI 리프레시
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.view.currentDisplayYear = year;
  if (year === today.getFullYear()) {
    state.view.currentWeeklyViewStartDate = getMondayOfWeek(today);
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

  // 1. Yearly 데이터 추가
  if (state.yearlyData) {
      files.push({
          filenameInZip: `${year}/${year}.json`,
          data: state.yearlyData
      });
  }

  // 2. Daily 데이터 추가
  state.dailyData.forEach((monthData, key) => { // key는 "YYYY-MM" 형식
      // 얕은 복사를 통해 state 직접 수정을 방지하고, 저장용 데이터 객체 생성
      const dataForSave = { ...monthData };

      // [수정된 로직]
      // 만약 월별 데이터 객체에 'colorPalette' 속성이 없다면,
      // 전역 설정(settings)의 colorPalette를 기본값으로 추가합니다.
      if (!dataForSave.hasOwnProperty('colorPalette')) {
          console.log(`[DataManager] No custom palette for ${key}. Adding default palette for saving.`);
          dataForSave.colorPalette = state.settings.colorPalette || []; // settings에서 가져온 기본 팔레트
      }

      files.push({
          filenameInZip: `${year}/${key}.json`,
          data: dataForSave // colorPalette가 보장된 데이터로 저장
      });
  });

  return files;
}


/**
 * 불러온 연간 백업 데이터로 특정 연도 데이터를 덮어쓰기
 */
export function loadYearFromBackup(year, filesData) {
  // 1. 불러온 데이터가 현재 연도와 일치하는지 확인, 아니면 연도 변경
  if (state.view.currentDisplayYear !== year) {
      state.yearlyData = null;
      state.dailyData.clear();
      state.view.currentDisplayYear = year;
  }

  // 2. 파일 데이터를 순회하며 state 재구성
  filesData.forEach(fileInfo => {
      const { filenameInZip, data } = fileInfo;
      
      if (filenameInZip === `${year}/${year}.json`) {
          state.yearlyData = data;
      } else if (filenameInZip.startsWith(`${year}/${year}-`)) {
          const key = filenameInZip.replace(`${year}/`, '').replace('.json', '');
          state.dailyData.set(key, data);
      }
  });

  // 3. UI 전체 리프레시
  eventBus.dispatch('dataChanged', { source: 'fileLoad' });
  // 불러온 데이터는 깨끗한 상태이므로 dirty state 클리어
  clearAllDirtyFilesForYear(year);
}

function clearAllDirtyFilesForYear(year) {
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

  // 현재 로드된 연도와 일치하는 경우에만 업데이트
  if (state.view.currentDisplayYear != year) {
      console.warn(`Attempted to update daily data for ${yearMonth}, but current view is ${state.view.currentDisplayYear}.`);
      return;
  }

  // 1. 메모리(state)의 dailyData 맵을 업데이트
  state.dailyData.set(yearMonth, newData);

  // 2. 해당 월별 파일을 dirty로 표시 (이것이 핵심!)
  const fileIdentifier = `${year}/${yearMonth}.json`;
  dirtyFileService.markFileAsDirty(fileIdentifier, newData);

  // 3. (선택사항) 실시간 동기화가 필요하다면 이벤트 발행
  eventBus.dispatch('dataChanged', { source: 'updateDailyData', payload: { yearMonth } });
}




////////////////////////////////////////////////
//   Data Manipulators
////////////////////////////////////////////////

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
  if (!state.yearlyData) return;
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
      dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
  }
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
