// js/dataManager.js
import * as dirtyFileService from './dirtyFileService.js';
import { INITIAL_YEAR, PRIORITY_COLORS } from "./constants.js";
import { eventBus } from "./eventBus.js";
import {
    generateId,
    getMondayOfWeek,
    formatDate,
} from "./uiUtils.js";

/////////////////////////////////////////
//  State 
/////////////////////////////////////////

let state = {
    settings: {
        colorPalette: [], // 마스터 색상 팔레트 (애플리케이션 전역 기본값)
        lastOpenedYear: INITIAL_YEAR,
    },
    yearlyData: null, // 현재 로드된 '연도'의 데이터: { year, labels, events, backlogTodos }
    dailyData: new Map(), // <'YYYY-MM', monthDataObject>
                          // monthDataObject: { yearMonth, routines, colorPalette, dailyData: {'YYYY-MM-DD': daySpecificData} }
    view: {
        currentDisplayYear: INITIAL_YEAR,
        currentWeeklyViewStartDate: getMondayOfWeek(new Date()),
        selectedLabel: null,
    },
};

// --- Getters ---
export function getState() {
    const currentYearData = state.yearlyData || { labels: [], events: [], backlogTodos: [] };
    const labels = currentYearData.labels || [];
    
    // 현재 월 키 결정 (주간 보기 시작 날짜 기준 또는 현재 날짜 기준 등 상황에 따라 다를 수 있음, 여기서는 주간 보기 기준)
    const refDateForMonth = state.view.currentWeeklyViewStartDate || new Date(); // fallback
    const currentMonthKey = `${state.view.currentDisplayYear}-${String(refDateForMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const monthData = state.dailyData.get(currentMonthKey) || {};

    // 컬러 팔레트: 1. 현재 월의 팔레트, 2. 전역 설정 팔레트, 3. 빈 배열
    const activeColorPalette = monthData.colorPalette && monthData.colorPalette.length > 0 
        ? monthData.colorPalette 
        : state.settings.colorPalette || [];

    // 루틴: 현재 월의 루틴, 없으면 빈 배열
    const activeRoutines = monthData.routines || [];

    return {
        ...state.settings, // 전역 설정을 기본으로 깔고
        ...currentYearData, // 연간 데이터를 덮어쓰고 (labels, events, backlogTodos)
        ...state.view,      // 현재 뷰 상태를 덮어쓰고
        labels: labels,     // yearlyData의 labels를 명시적으로 사용
        colorPalette: activeColorPalette, // 최종적으로 결정된 활성 컬러 팔레트
        routines: activeRoutines,         // 최종적으로 결정된 활성 루틴
    };
}

export function getRawDailyDataForMonth(yearMonth) {
    // monthDataObject 전체 반환: { yearMonth, routines, colorPalette, dailyData }
    return state.dailyData.get(yearMonth);
}

export function getRoutinesForMonth(yearMonth) {
    const monthData = state.dailyData.get(yearMonth);
    return monthData?.routines || [];
}

export function getSettings() {
    return state.settings;
}

///////////////////////////////////////////
//  Data Save & Load
///////////////////////////////////////////

export async function loadDataForYear(year) {
    console.log(`DataManager: Unloading old year data and loading data for ${year}...`);
    state.yearlyData = null;
    state.dailyData.clear(); // 이전 연도의 모든 월별 데이터 제거

    // 1. Settings 로드
    const settingsIdentifier = 'settings.json';
    let settingsData = dirtyFileService.getDirtyFileData(settingsIdentifier);
    if (settingsData) {
        state.settings = settingsData;
    } else {
        try {
            const response = await fetch(`./data/${settingsIdentifier}`); // 기본 경로에서 로드
            if (response.ok) {
                state.settings = await response.json();
            } else {
                console.warn(`Could not load ${settingsIdentifier}, using fallback.`);
                state.settings = { colorPalette: [], lastOpenedYear: INITIAL_YEAR };
            }
        } catch (e) {
            console.warn(`Error fetching ${settingsIdentifier}, using fallback.`, e);
            state.settings = { colorPalette: [], lastOpenedYear: INITIAL_YEAR };
        }
    }
    // settings.colorPalette가 없거나 비어있으면 기본값 [] 보장
    if (!state.settings.colorPalette) state.settings.colorPalette = [];


    // 2. Yearly data 로드
    const yearlyIdentifier = `${year}/${year}.json`;
    let yearlyPageData = dirtyFileService.getDirtyFileData(yearlyIdentifier);
    if (yearlyPageData) {
        state.yearlyData = yearlyPageData;
    } else {
        try {
            const response = await fetch(`./data/${yearlyIdentifier}`);
            state.yearlyData = response.ok ? await response.json() : { year, labels: [], events: [], backlogTodos: [] };
        } catch (e) {
            state.yearlyData = { year, labels: [], events: [], backlogTodos: [] };
            console.warn(`Could not load ${yearlyIdentifier}. Initializing empty yearly data.`);
        }
    }
    if (state.yearlyData && !state.yearlyData.labels) state.yearlyData.labels = [];
    if (state.yearlyData && !state.yearlyData.events) state.yearlyData.events = [];
    if (state.yearlyData && !state.yearlyData.backlogTodos) state.yearlyData.backlogTodos = [];


    // 3. 각 월별 데이터 로드
    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        const yearMonthKey = `${year}-${month}`;
        const dailyFileIdentifier = `${year}/${yearMonthKey}.json`;
        let monthDataObject = dirtyFileService.getDirtyFileData(dailyFileIdentifier);

        if (monthDataObject) {
            // dirty 서비스에서 가져온 데이터 구조 보장
            monthDataObject.yearMonth = monthDataObject.yearMonth || yearMonthKey;
            monthDataObject.routines = monthDataObject.routines || [];
            monthDataObject.colorPalette = monthDataObject.colorPalette || []; // 로컬스토리지 데이터에도 기본값 적용
            monthDataObject.dailyData = monthDataObject.dailyData || {};
            state.dailyData.set(yearMonthKey, monthDataObject);
        } else {
            try {
                const response = await fetch(`./data/${dailyFileIdentifier}`);
                if (response.ok) {
                    const loadedMonthData = await response.json();
                    state.dailyData.set(yearMonthKey, {
                        yearMonth: loadedMonthData.yearMonth || yearMonthKey,
                        routines: loadedMonthData.routines || [],
                        colorPalette: loadedMonthData.colorPalette || [], // 파일 데이터에도 기본값 적용
                        dailyData: loadedMonthData.dailyData || {},
                    });
                } else {
                    // 파일이 없는 경우, 기본 빈 월별 데이터 구조 생성
                    state.dailyData.set(yearMonthKey, { yearMonth: yearMonthKey, routines: [], colorPalette: [], dailyData: {} });
                }
            } catch (e) {
                console.warn(`Could not load ${dailyFileIdentifier}. Initializing empty month data.`);
                state.dailyData.set(yearMonthKey, { yearMonth: yearMonthKey, routines: [], colorPalette: [], dailyData: {} });
            }
        }
    }

    state.view.currentDisplayYear = year;
    const today = new Date(); today.setHours(0,0,0,0);
    if (year === today.getFullYear()) {
        state.view.currentWeeklyViewStartDate = getMondayOfWeek(today);
    } else {
        state.view.currentWeeklyViewStartDate = getMondayOfWeek(new Date(year, 0, 1));
    }
    eventBus.dispatch('dataChanged', { source: 'yearChange', yearLoaded: year });
}


export function getCurrentYearDataForSave() {
    const year = state.view.currentDisplayYear;
    const files = [];

    // 1. Yearly Data 저장
    if (state.yearlyData) {
        files.push({
            filenameInZip: `${year}/${year}.json`,
            data: { // 필요한 필드만 명시적으로 포함
                year: state.yearlyData.year || year,
                labels: state.yearlyData.labels || [],
                events: state.yearlyData.events || [],
                backlogTodos: state.yearlyData.backlogTodos || []
            }
        });
    }

    // 2. Monthly Data 저장
    state.dailyData.forEach((monthDataObject, yearMonthKey) => {
        const dataToSave = {
            yearMonth: monthDataObject.yearMonth || yearMonthKey,
            routines: monthDataObject.routines || [],
            colorPalette: monthDataObject.colorPalette || [], // 저장 시에도 기본값 보장
            dailyData: monthDataObject.dailyData || {}
        };
        // 월별 팔레트가 비어있고, 전역 팔레트가 있다면 전역 팔레트를 사용 (선택적 로직)
        // if (dataToSave.colorPalette.length === 0 && state.settings.colorPalette.length > 0) {
        //     dataToSave.colorPalette = [...state.settings.colorPalette];
        // }
        files.push({
            filenameInZip: `${year}/${yearMonthKey}.json`,
            data: dataToSave
        });
    });
    return files;
}


export function loadYearFromBackup(year, filesData) {
    if (state.view.currentDisplayYear !== year) {
        state.yearlyData = null; // 이전 연도 데이터 초기화
        state.dailyData.clear();  // 이전 연도 월별 데이터 초기화
        state.view.currentDisplayYear = year;
    } else {
        // 같은 연도라도 백업으로 덮어쓰므로, 기존 월별 데이터는 비움
        state.dailyData.clear();
    }

    filesData.forEach(fileInfo => {
        const { filenameInZip, data: loadedFileData } = fileInfo;

        if (filenameInZip === `${year}/${year}.json`) {
            state.yearlyData = { // 필요한 필드만 받아들이고 기본값 설정
                year: loadedFileData.year || year,
                labels: loadedFileData.labels || [],
                events: loadedFileData.events || [],
                backlogTodos: loadedFileData.backlogTodos || []
            };
            dirtyFileService.markFileAsDirty(filenameInZip, state.yearlyData);
        } else if (filenameInZip.startsWith(`${year}/${year}-`)) {
            const yearMonthKey = filenameInZip.replace(`${year}/`, '').replace('.json', '');
            const monthDataObject = {
                yearMonth: loadedFileData.yearMonth || yearMonthKey,
                routines: loadedFileData.routines || [],
                colorPalette: loadedFileData.colorPalette || [], // 백업파일에 없으면 빈 배열
                dailyData: loadedFileData.dailyData || {}
            };
            state.dailyData.set(yearMonthKey, monthDataObject);
            dirtyFileService.markFileAsDirty(filenameInZip, monthDataObject);
        }
    });
    eventBus.dispatch('dataChanged', { source: 'fileLoad', yearLoaded: year });
}


export function clearAllDirtyFilesForYear(year) {
    dirtyFileService.clearDirtyFile(`${year}/${year}.json`);
    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        dirtyFileService.clearDirtyFile(`${year}/${year}-${month}.json`);
    }
    // settings.json은 연도별이 아니므로 여기서 지우지 않음.
    // dirtyFileService.clearDirtyFile('settings.json'); // 필요시 별도 호출
}


export function updateDailyData(yearMonth, newMonthDataObject) {
    const year = yearMonth.split('-')[0];
    if (String(state.view.currentDisplayYear) !== String(year)) { // 타입 일치시켜 비교
        console.warn(`Attempted to update daily data for ${yearMonth}, but current view is ${state.view.currentDisplayYear}. Update ignored.`);
        return;
    }
    // newMonthDataObject는 { yearMonth, routines, colorPalette, dailyData:{...} } 구조
    state.dailyData.set(yearMonth, newMonthDataObject); 
    const fileIdentifier = `${year}/${yearMonth}.json`;
    dirtyFileService.markFileAsDirty(fileIdentifier, newMonthDataObject);
    eventBus.dispatch('dataChanged', { source: 'updateDailyData', payload: { yearMonth } });
}


function getOrInitializeDayDataStructure(monthDataObject, dateStr) {
    // monthDataObject는 { yearMonth, routines, colorPalette, dailyData } 구조라고 가정
    if (!monthDataObject.dailyData) {
        monthDataObject.dailyData = {};
    }
    if (!monthDataObject.dailyData[dateStr]) {
        monthDataObject.dailyData[dateStr] = {
            timeBlock: {},
            goalBlock: {},
            scheduledTimelineTasks: [],
            todos: [],
            projectTodos: [],
            // routines: [], // 여기에 routines가 있으면 안됨! 월별로 이동했음.
            diary: { keep: "", problem: "", try: "" } // diary 기본 구조 추가
        };
    } else {
        // 기존 dailyData[dateStr] 객체가 존재할 때, 하위 필수 배열/객체들이 있는지 확인하고 없으면 초기화
        if (!monthDataObject.dailyData[dateStr].todos) monthDataObject.dailyData[dateStr].todos = [];
        if (!monthDataObject.dailyData[dateStr].projectTodos) monthDataObject.dailyData[dateStr].projectTodos = [];
        if (!monthDataObject.dailyData[dateStr].timeBlock) monthDataObject.dailyData[dateStr].timeBlock = {};
        if (!monthDataObject.dailyData[dateStr].goalBlock) monthDataObject.dailyData[dateStr].goalBlock = {};
        if (!monthDataObject.dailyData[dateStr].scheduledTimelineTasks) monthDataObject.dailyData[dateStr].scheduledTimelineTasks = [];
        if (!monthDataObject.dailyData[dateStr].diary) monthDataObject.dailyData[dateStr].diary = { keep: "", problem: "", try: "" };
    }
    return monthDataObject.dailyData[dateStr];
}


export function getTodosForDate(dateStr) { // Day-specific todos
    const yearMonth = dateStr.substring(0, 7);
    const monthData = state.dailyData.get(yearMonth);
    // dailyData 필드 내부의 dateStr 키를 찾음
    return monthData?.dailyData?.[dateStr]?.todos || [];
}


// --- Data Manipulators ---
export function updateCurrentDisplayYear(year) {
    const numericYear = parseInt(year, 10);
    if (state.view.currentDisplayYear !== numericYear) {
        loadDataForYear(numericYear); // 이 함수가 dataChanged 이벤트를 발생시킴
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

// yearlyData 관련 함수들 (labels, events, backlogTodos)은 기존 구조 유지
export function addLabel(label) {
    if (!state.yearlyData) state.yearlyData = { year: state.view.currentDisplayYear, labels: [], events: [], backlogTodos: [] };
    if (!state.yearlyData.labels) state.yearlyData.labels = [];
    state.yearlyData.labels.push(label);
    eventBus.dispatch('dataChanged', { source: 'addLabel' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function setSelectedLabel(label) {
    state.view.selectedLabel = label;
    eventBus.dispatch('dataChanged', { source: 'selectedLabelChanged' });
}

export function reorderLabels(orderedLabelIds) {
    if (!state.yearlyData || !state.yearlyData.labels) return;
    state.yearlyData.labels = orderedLabelIds
        .map(id => state.yearlyData.labels.find(l => l.id === id))
        .filter(Boolean);
    eventBus.dispatch('dataChanged', { source: 'reorderLabels' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function addEvent(event) {
    if (!state.yearlyData) state.yearlyData = { year: state.view.currentDisplayYear, labels: [], events: [], backlogTodos: [] };
    if (!state.yearlyData.events) state.yearlyData.events = [];
    state.yearlyData.events.push(event);
    eventBus.dispatch("dataChanged", { source: "addEvent" });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteEvent(eventId) {
    if (!state.yearlyData || !state.yearlyData.events) return;
    state.yearlyData.events = state.yearlyData.events.filter(event => event.id !== eventId);
    eventBus.dispatch('dataChanged', { source: 'deleteEvent' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateEventDates(eventId, newStartDate, newEndDate) {
    if (!state.yearlyData || !state.yearlyData.events) return;
    const event = state.yearlyData.events.find((event) => event.id === eventId);
    if (event) {
        event.startDate = newStartDate; // 날짜 직접 업데이트
        event.endDate = newEndDate;     // 날짜 직접 업데이트
        eventBus.dispatch('dataChanged', { source: 'updateEventDates' });
        dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
    }
}

export function isDuplicateEvent({ labelId, startDate, endDate }) {
    if (!state.yearlyData || !state.yearlyData.events) return false;
    return state.yearlyData.events.some(
        (event) =>
        event.labelId === labelId &&
        event.startDate === startDate &&
        event.endDate === endDate
    );
}

export function addBacklogTodo(text, priority = 0) {
    if (!text) return;
    if (!state.yearlyData) state.yearlyData = { year: state.view.currentDisplayYear, labels: [], events: [], backlogTodos: [] };
    if (!state.yearlyData.backlogTodos) state.yearlyData.backlogTodos = [];
    
    const newTodo = {
        id: generateId('bklg_'), // Prefix 추가
        text,
        priority: parseInt(priority, 10),
        color: PRIORITY_COLORS[priority] || "#ccc",
    };
    state.yearlyData.backlogTodos.push(newTodo);
    eventBus.dispatch('dataChanged', { source: 'addBacklogTodo' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function deleteBacklogTodo(todoId) {
    if (!state.yearlyData || !state.yearlyData.backlogTodos) return;
    state.yearlyData.backlogTodos = state.yearlyData.backlogTodos.filter(todo => todo.id !== todoId);
    eventBus.dispatch('dataChanged', { source: 'deleteBacklogTodo' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}

export function updateBacklogTodoText(todoId, newText) {
    if (!state.yearlyData || !state.yearlyData.backlogTodos) return;
    const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
    if (todo && newText && todo.text !== newText.trim()) {
        todo.text = newText.trim();
        eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoText' });
        dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
    }
}

export function updateBacklogTodoPriority(todoId, newPriority) {
    if (!state.yearlyData || !state.yearlyData.backlogTodos) return;
    const todo = state.yearlyData.backlogTodos.find((t) => t.id === todoId);
    const priority = parseInt(newPriority, 10);
    if (todo && !isNaN(priority) && todo.priority !== priority) {
        todo.priority = priority;
        todo.color = PRIORITY_COLORS[priority] || "#ccc";
        eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoPriority' });
        dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
    }
}

export function reorderBacklogTodos(orderedTodoIds) {
    if (!state.yearlyData || !state.yearlyData.backlogTodos) return;
    state.yearlyData.backlogTodos = orderedTodoIds
        .map(id => state.yearlyData.backlogTodos.find(t => t.id === id))
        .filter(Boolean);
    eventBus.dispatch('dataChanged', { source: 'reorderBacklogTodos' });
    dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
}


// Day-specific todos and other daily data interactions
export function addTodoForDate(dateStr, todoText, todoDetails = {}) {
    const yearMonth = dateStr.substring(0, 7);
    // getRawDailyDataForMonth는 monthDataObject를 반환. 없으면 기본 구조 생성.
    const monthDataObject = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || 
                            { yearMonth, routines: [], colorPalette: [], dailyData: {} }));
    const dayData = getOrInitializeDayDataStructure(monthDataObject, dateStr); // dayData는 monthDataObject.dailyData[dateStr]

    const finalTodo = {
        id: generateId('daytodo_'),
        text: todoText,
        completed: false,
        color: todoDetails.color || "#6c757d",
        importance: todoDetails.importance || 0,
        time: todoDetails.time || 0,
        ...todoDetails 
    };
    // 이미 위에서 id, text, completed를 설정했으므로, todoDetails에서 온 값으로 덮어쓰지 않도록 주의.
    // 실제로는 ...todoDetails가 먼저 오고, 주요 필드를 나중에 명시하는 것이 안전할 수 있음.
    // 또는, todoDetails에서 id, text, completed를 제거한 후 merge.
    // 여기서는 generateId 등으로 생성된 값을 우선시 한다고 가정.

    dayData.todos.push(finalTodo);
    updateDailyData(yearMonth, monthDataObject); // 전체 monthDataObject 전달
}

export function deleteTodoForDate(dateStr, todoId) {
    const yearMonth = dateStr.substring(0, 7);
    const monthDataObject = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || 
                            { yearMonth, routines: [], colorPalette: [], dailyData: {} }));
    const dayData = getOrInitializeDayDataStructure(monthDataObject, dateStr);
    
    const initialLength = dayData.todos.length;
    dayData.todos = dayData.todos.filter(todo => todo.id !== todoId);

    if (dayData.todos.length !== initialLength) {
        updateDailyData(yearMonth, monthDataObject);
    }
}

export function updateTodoPropertyForDate(dateStr, todoId, propertyName, newValue) {
    const yearMonth = dateStr.substring(0, 7);
    const monthDataObject = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || 
                            { yearMonth, routines: [], colorPalette: [], dailyData: {} }));
    const dayData = getOrInitializeDayDataStructure(monthDataObject, dateStr);
    
    const todo = dayData.todos.find(t => t.id === todoId);
    if (todo && todo[propertyName] !== newValue) {
        todo[propertyName] = newValue;
        if (propertyName === 'text' && typeof newValue === 'string') {
            todo.text = newValue.trim();
        }
        updateDailyData(yearMonth, monthDataObject);
    }
}

export function reorderTodosForDate(dateStr, orderedTodoIds) {
    const yearMonth = dateStr.substring(0, 7);
    const monthDataObject = JSON.parse(JSON.stringify(getRawDailyDataForMonth(yearMonth) || 
                            { yearMonth, routines: [], colorPalette: [], dailyData: {} }));
    const dayData = getOrInitializeDayDataStructure(monthDataObject, dateStr);

    const originalOrder = dayData.todos.map(t => t.id).join(',');
    const newOrder = orderedTodoIds.join(',');

    if (originalOrder !== newOrder) {
        dayData.todos = orderedTodoIds
            .map(id => dayData.todos.find(todo => todo.id === id))
            .filter(Boolean);
        updateDailyData(yearMonth, monthDataObject);
    }
}

export function moveBacklogTodoToCalendar(todoId, targetDate) {
  if (!state.yearlyData || !state.yearlyData.backlogTodos) return;

  const todoToMoveIndex = state.yearlyData.backlogTodos.findIndex(t => t.id === todoId);
  if (todoToMoveIndex === -1) return;

  const [todoItemFromBacklog] = state.yearlyData.backlogTodos.splice(todoToMoveIndex, 1);
  eventBus.dispatch('dataChanged', { source: 'moveBacklogTodoToCalendar_removedFromBacklog', payload: { /* updatedBacklog: state.yearlyData.backlogTodos - 직접 전달보다 이벤트를 통해 UI가 getState() 하도록 유도 */ } });
  dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);

  const yearMonth = targetDate.substring(0, 7);
  
  // getRawDailyDataForMonth는 {yearMonth, routines, colorPalette, dailyData} 객체를 반환해야 함
  let monthData = getRawDailyDataForMonth(yearMonth);
  if (!monthData) { // 해당 월의 데이터가 아직 없으면 초기화
      monthData = { 
          yearMonth, 
          routines: [], 
          colorPalette: state.settings.colorPalette || [], // 설정 또는 기본 팔레트
          dailyData: {} 
      };
      state.dailyData.set(yearMonth, monthData); // state에 새로 생성된 monthData 추가
  } else {
      // 기존 monthData를 변경할 것이므로 복사본 사용 (선택적이지만 안전함)
      monthData = JSON.parse(JSON.stringify(monthData));
  }
  
  const dayData = getOrInitializeDayDataStructure(monthData, targetDate); // monthData를 직접 수정하거나 복사본을 수정

  const newCalendarTodo = {
      id: generateId('daytodo_'), 
      originalBacklogId: todoItemFromBacklog.id, 
      text: todoItemFromBacklog.text,
      completed: false,
      color: todoItemFromBacklog.color,
      importance: todoItemFromBacklog.priority !== undefined ? todoItemFromBacklog.priority : 0,
      time: 0, 
      // 여기에 Daily View의 todo가 사용하는 다른 기본 속성(예: creationTimestamp 등)이 있다면 추가
  };
  dayData.todos.push(newCalendarTodo);
  updateDailyData(yearMonth, monthData); // 수정된 monthData 객체 전체를 저장
}

// dataManager.js 에 추가할 함수 (예시)
export function getSpecificYearDataForSave(yearToSave) {
    const year = parseInt(yearToSave, 10);
    const files = [];

    // 1. 해당 연도의 Yearly Data 저장
    // state.yearlyData가 현재 로드된 연도와 다를 수 있으므로,
    // 이 연도 데이터를 직접 로드하거나 접근하는 방식이 필요.
    // 여기서는 일단 state.yearlyData가 target year의 데이터라고 가정하지 않고,
    // dirtyFileService나 fetch를 통해 해당 연도의 데이터를 가져오는 로직이 필요할 수 있음.
    // 하지만 현재 getCurrentYearDataForSave는 state.yearlyData를 직접 사용하므로,
    // state.yearlyData가 yearToSave의 데이터여야 함.

    // 더 간단하게는, getCurrentYearDataForSave의 로직을 복제하되,
    // state.view.currentDisplayYear 대신 yearToSave를 사용하는 것.

    const yearlyIdentifier = `${year}/${year}.json`;
    const currentYearlyData = state.yearlyData && state.yearlyData.year === year ? state.yearlyData : dirtyFileService.getDirtyFileData(yearlyIdentifier);
    // 만약 dirty에도 없고 state.yearlyData도 해당 연도가 아니면, fetch로 가져와야 할 수도 있음.
    // 여기서는 dirty에 있거나, 현재 로드된 state.yearlyData가 마침 해당 연도인 경우를 가정.
    // 가장 확실한 방법은 loadDataForYear(year)를 호출하여 state를 해당 연도로 맞추고 시작하는 것이지만,
    // Cmd+S가 UI 변경 없이 백그라운드 저장하는 느낌이라면 부적절.

    if (currentYearlyData) { // 또는 fetch로 가져온 데이터
        files.push({
            filenameInZip: `${year}/${year}.json`,
            data: {
                year: currentYearlyData.year || year,
                labels: currentYearlyData.labels || [],
                events: currentYearlyData.events || [],
                backlogTodos: currentYearlyData.backlogTodos || []
            }
        });
    } else {
        // 해당 연도 파일이 아예 존재하지 않을 수도 있음 (새로운 연도 작업 시작 전)
        // 이 경우 빈 구조라도 저장할지, 아니면 yearly는 건너뛸지 정책 필요.
        // 여기서는 getCurrentYearDataForSave()와 유사하게, 데이터가 있으면 저장.
    }


    // 2. 해당 연도의 모든 Monthly Data 저장
    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        const yearMonthKey = `${year}-${month}`;
        const dailyFileIdentifier = `${year}/${yearMonthKey}.json`;
        
        // dirtyFileService에서 먼저 확인, 없으면 state.dailyData에서 확인
        let monthDataObject = dirtyFileService.getDirtyFileData(dailyFileIdentifier);
        if (!monthDataObject && state.dailyData.has(yearMonthKey)) {
            // state.dailyData.get(yearMonthKey)는 이미 로드된 데이터.
            // dirty가 아니라도 전체 저장 시에는 포함해야 함.
            monthDataObject = state.dailyData.get(yearMonthKey);
        }

        if (monthDataObject) {
            const dataToSave = {
                yearMonth: monthDataObject.yearMonth || yearMonthKey,
                routines: monthDataObject.routines || [],
                colorPalette: monthDataObject.colorPalette || [],
                dailyData: monthDataObject.dailyData || {}
            };
            files.push({
                filenameInZip: `${year}/${yearMonthKey}.json`,
                data: dataToSave
            });
        }
    }
    return files;
}
