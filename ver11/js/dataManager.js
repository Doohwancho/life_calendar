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
    mandalArt: null,
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

export function loadInitialData() {
    console.log('[DataManager] Loading initial data from localStorage...');
    // 1. Settings 로드
    state.settings = dirtyFileService.getDirtyFileData('settings.json') || { colorPalette: [], lastOpenedYear: INITIAL_YEAR };
    if (!state.settings.colorPalette) state.settings.colorPalette = [];

    // 2. Mandal-Art 데이터 로드
    const mandalData = dirtyFileService.getDirtyFileData('mandal-art.json');
    state.mandalArt = mandalData ? _hydrateMandalArt(mandalData) : null;
    
    // 3. 마지막으로 열었던 연도 또는 현재 연도의 데이터 로드
    const yearToLoad = state.settings.lastOpenedYear || new Date().getFullYear();
    loadDataForYear(yearToLoad); // await 제거
}

export function loadDataForYear(year) {
    const numericYear = parseInt(year, 10);
    console.log(`DataManager: loadDataForYear called for ${numericYear}.`);
    
    if (state.yearlyData && state.yearlyData.year === numericYear) {
        console.log(`DataManager: Year ${numericYear} is already loaded. Notifying UI to render.`);
        eventBus.dispatch('dataChanged', { source: 'yearAlreadyLoaded', yearLoaded: numericYear });
        return;
    }
    
    state.yearlyData = null;
    state.dailyData.clear();
    
    // Yearly data 로드
    const yearlyIdentifier = `${numericYear}/${numericYear}.json`;
    state.yearlyData = dirtyFileService.getDirtyFileData(yearlyIdentifier) || { year: numericYear, labels: [], events: [], backlogTodos: [] };

    // 데이터 무결성 보장
    state.yearlyData.year = numericYear;
    if (!state.yearlyData.labels) state.yearlyData.labels = [];
    if (!state.yearlyData.events) state.yearlyData.events = [];
    if (!state.yearlyData.backlogTodos) state.yearlyData.backlogTodos = [];

    // 월별 데이터 로드
    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        const yearMonthKey = `${numericYear}-${month}`;
        const dailyFileIdentifier = `${numericYear}/${yearMonthKey}.json`;
        const monthDataObject = dirtyFileService.getDirtyFileData(dailyFileIdentifier) || { yearMonth: yearMonthKey, routines: [], colorPalette: [], dailyData: {} };
        state.dailyData.set(yearMonthKey, monthDataObject);
    }

    state.view.currentDisplayYear = numericYear;
    const today = new Date(); today.setHours(0,0,0,0);
    if (numericYear === today.getFullYear()) {
        state.view.currentWeeklyViewStartDate = getMondayOfWeek(today);
    } else {
        state.view.currentWeeklyViewStartDate = getMondayOfWeek(new Date(numericYear, 0, 1));
    }
    eventBus.dispatch('dataChanged', { source: 'yearChange', yearLoaded: numericYear });
}


export function getCurrentYearDataForSave() {
    const year = state.view.currentDisplayYear;
    const files = [];

    if (state.yearlyData) {
        files.push({
            filenameInZip: `${year}/${year}.json`,
            data: { year: state.yearlyData.year, labels: state.yearlyData.labels, events: state.yearlyData.events, backlogTodos: state.yearlyData.backlogTodos }
        });
    }

    state.dailyData.forEach((monthDataObject, yearMonthKey) => {
        if (yearMonthKey.startsWith(String(year))) {
            files.push({
                filenameInZip: `${year}/${yearMonthKey}.json`,
                data: monthDataObject
            });
        }
    });

    if (state.mandalArt) {
        const mandalArtToSave = JSON.parse(JSON.stringify(state.mandalArt));
        mandalArtToSave.mandalArts.forEach(mandal => {
            const optimizedCells = {};
            mandal.cells.forEach((cell, index) => {
                const isModified = cell.content || cell.isCompleted || cell.isHighlighted || cell.color;
                if (isModified) {
                    const modifiedProps = {};
                    if (cell.content) modifiedProps.content = cell.content;
                    if (cell.isCompleted) modifiedProps.isCompleted = true;
                    if (cell.isHighlighted) modifiedProps.isHighlighted = true;
                    if (cell.color) modifiedProps.color = cell.color;
                    optimizedCells[index] = modifiedProps;
                }
            });
            mandal.cells = optimizedCells;
        });
        files.push({
            filenameInZip: `mandal-art.json`,
            data: mandalArtToSave
        });
    }
    return files;
}


export function loadYearFromBackup(year, filesData) {
    const numericYear = parseInt(year, 10);
    state.yearlyData = null;
    state.dailyData.clear();
    state.mandalArt = null;
    state.view.currentDisplayYear = numericYear;
    
    filesData.forEach(fileInfo => {
        const { filenameInZip, data: loadedFileData } = fileInfo;

        // 1. 만다라트 데이터 처리
        if (filenameInZip === 'mandal-art.json') {
            state.mandalArt = _hydrateMandalArt(loadedFileData);
            dirtyFileService.markFileAsDirty('mandal-art.json', state.mandalArt);
            console.log('[DataManager] Mandal-Art data loaded from backup.');
        }

        // 2. 연간 데이터 처리
        if (filenameInZip === `${numericYear}/${numericYear}.json`) {
            state.yearlyData = {
                year: loadedFileData.year || numericYear,
                labels: loadedFileData.labels || [],
                events: loadedFileData.events || [],
                backlogTodos: loadedFileData.backlogTodos || []
            };
            dirtyFileService.markFileAsDirty(filenameInZip, state.yearlyData);
            console.log('[DataManager] Yearly data loaded from backup.');
        }

        // 3. 월간 데이터 처리
        if (filenameInZip.startsWith(`${numericYear}/${numericYear}-`)) {
            const yearMonthKey = filenameInZip.replace(`${numericYear}/`, '').replace('.json', '');
            const monthDataObject = loadedFileData || { yearMonth: yearMonthKey, routines: [], colorPalette: [], dailyData: {} };
            state.dailyData.set(yearMonthKey, monthDataObject);
            dirtyFileService.markFileAsDirty(filenameInZip, monthDataObject);
        }
    });

    eventBus.dispatch('dataChanged', { source: 'fileLoad', yearLoaded: numericYear });
}

export function clearAllDirtyFilesForYear(year) {
    const numericYear = parseInt(year, 10);
    dirtyFileService.clearDirtyFile(`${numericYear}/${numericYear}.json`);
    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        dirtyFileService.clearDirtyFile(`${numericYear}/${numericYear}-${month}.json`);
    }
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
    if (!monthDataObject.dailyData) {
        monthDataObject.dailyData = {};
    }
    if (!monthDataObject.dailyData[dateStr]) {
        monthDataObject.dailyData[dateStr] = {
            timeBlocks: {}, // 이전 답변에서 수정한 부분 (Todos, ProjectTodos 등과 일관성)
            goalBlocks: {}, // 이전 답변에서 수정한 부분
            scheduledTimelineTasks: [],
            todos: [],
            projectTodos: [],
            diary: { keep: "", problem: "", try: "" },
            cellMark: null // ▼▼▼ 셀 마크 기본값 추가 ▼▼▼
        };
    } else {
        // 기존 dailyData[dateStr] 객체가 존재할 때, 하위 필수 속성들 및 cellMark 기본값 보장
        if (monthDataObject.dailyData[dateStr].todos === undefined) monthDataObject.dailyData[dateStr].todos = [];
        if (monthDataObject.dailyData[dateStr].projectTodos === undefined) monthDataObject.dailyData[dateStr].projectTodos = [];
        if (monthDataObject.dailyData[dateStr].timeBlocks === undefined) monthDataObject.dailyData[dateStr].timeBlocks = {}; // 오타 수정
        if (monthDataObject.dailyData[dateStr].goalBlocks === undefined) monthDataObject.dailyData[dateStr].goalBlocks = {}; // 오타 수정
        if (monthDataObject.dailyData[dateStr].scheduledTimelineTasks === undefined) monthDataObject.dailyData[dateStr].scheduledTimelineTasks = [];
        if (monthDataObject.dailyData[dateStr].diary === undefined) monthDataObject.dailyData[dateStr].diary = { keep: "", problem: "", try: "" };
        
        if (monthDataObject.dailyData[dateStr].cellMark === undefined) {
            monthDataObject.dailyData[dateStr].cellMark = null;
        }
    }
    return monthDataObject.dailyData[dateStr];
}


export function getTodosForDate(dateStr) { // Day-specific todos
    const yearMonth = dateStr.substring(0, 7);
    const monthData = state.dailyData.get(yearMonth);
    // dailyData 필드 내부의 dateStr 키를 찾음
    return monthData?.dailyData?.[dateStr]?.todos || [];
}

/**
 * 특정 날짜의 셀 마크 정보를 가져옵니다.
 * @param {string} dateStr - "YYYY-MM-DD" 형식의 날짜 문자열
 * @returns {string | null} 마크 타입 또는 null
 */
export function getCellMark(dateStr) {
    const yearMonth = dateStr.substring(0, 7);
    const monthData = state.dailyData.get(yearMonth);
    // daySpecificData 객체 내의 cellMark 속성을 반환하도록 확실히 함
    return monthData?.dailyData?.[dateStr]?.cellMark || null;
}


/**
 * 특정 날짜에 셀 마크를 설정하거나 제거합니다.
 * @param {string} dateStr - "YYYY-MM-DD" 형식의 날짜 문자열
 * @param {string | null} markType - 설정할 마크 타입 (제거 시 null 또는 "none")
 */
export function setCellMark(dateStr, markType) {
    const yearMonth = dateStr.substring(0, 7);
    let monthDataObject = getRawDailyDataForMonth(yearMonth);

    if (!monthDataObject) {
        monthDataObject = { 
            yearMonth: yearMonth, 
            routines: [], 
            // settings에서 기본 팔레트를 가져오거나, 없으면 빈 배열
            colorPalette: (state.settings && state.settings.colorPalette) ? [...state.settings.colorPalette] : [], 
            dailyData: {} 
        };
        // 여기서 state.dailyData.set(yearMonth, monthDataObject); 를 직접 하지 않고,
        // 아래 updateDailyData를 통해 일관되게 처리합니다.
    } else {
        // updateDailyData에서 어차피 deep copy를 할 것이므로, 여기서는 직접 수정 준비
        // 또는, monthDataObject가 state.dailyData.get()의 직접 참조이므로,
        // getOrInitializeDayDataStructure 내부에서 수정하면 원본이 바뀜.
    }

    const dayData = getOrInitializeDayDataStructure(monthDataObject, dateStr);
    
    const currentMark = dayData.cellMark;
    const newMark = (markType === "none" || markType === "" || markType === undefined) ? null : markType;

    if (currentMark !== newMark) {
        dayData.cellMark = newMark;
        console.log(`[DataManager setCellMark] Mark for ${dateStr} set to: ${newMark}`);
        updateDailyData(yearMonth, monthDataObject); // 변경된 monthDataObject로 업데이트 요청
    } else {
        // console.log(`[DataManager setCellMark] Mark for ${dateStr} is already ${currentMark}. No change.`);
    }
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

export function updateLabelName(labelId, newName) {
    if (!state.yearlyData || !state.yearlyData.labels) return;
    const label = state.yearlyData.labels.find(l => l.id === labelId);
    if (label && label.name !== newName) {
        label.name = newName;
        // 라벨 이름이 변경되면 관련된 이벤트들의 이름도 업데이트해야 할 수 있지만,
        // 현재 yearlyCalendar.js 에서는 이벤트 바에 라벨 이름을 직접 표시하므로,
        // 라벨 이름만 변경해도 UI는 dataChanged 이벤트를 통해 자동으로 업데이트됩니다.
        eventBus.dispatch('dataChanged', { source: 'updateLabelName', payload: { labelId, newName } });
        dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
        console.log(`[DataManager] Label name updated: ${labelId} to ${newName}`);
    }
}

export function deleteLabelAndAssociatedEvents(labelId) {
    if (!state.yearlyData) return;

    let changed = false;

    // 1. 라벨 목록에서 해당 라벨 삭제
    if (state.yearlyData.labels) {
        const initialLabelsLength = state.yearlyData.labels.length;
        state.yearlyData.labels = state.yearlyData.labels.filter(label => label.id !== labelId);
        if (state.yearlyData.labels.length !== initialLabelsLength) {
            changed = true;
        }
    }

    // 2. 해당 라벨을 사용하는 모든 이벤트(projects) 삭제
    if (state.yearlyData.events) {
        const initialEventsLength = state.yearlyData.events.length;
        state.yearlyData.events = state.yearlyData.events.filter(event => event.labelId !== labelId);
        if (state.yearlyData.events.length !== initialEventsLength) {
            changed = true;
        }
    }
    
    // 3. 만약 현재 선택된 라벨이 삭제된 라벨이라면, 선택 해제
    if (state.view.selectedLabel && state.view.selectedLabel.id === labelId) {
        state.view.selectedLabel = null;
        changed = true; // 이 변경도 dataChanged를 유발해야 함
    }

    if (changed) {
        eventBus.dispatch('dataChanged', { source: 'deleteLabelAndEvents', payload: { labelId } });
        dirtyFileService.markFileAsDirty(`${state.view.currentDisplayYear}/${state.view.currentDisplayYear}.json`, state.yearlyData);
        console.log(`[DataManager] Label and associated events deleted for labelId: ${labelId}`);
    }
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
export function getSpecificYearDataForSave(yearToSave) { // (이전 답변에서 제안된 함수)
    const year = parseInt(yearToSave, 10);
    const files = [];
    
    const yearlyIdentifier = `${year}/${year}.json`;
    // getDirtyFileData는 현재 dirty 상태만 가져오므로, "연도 전체 저장" 시에는 메모리나 fetch를 고려해야 함.
    // 여기서는 state.yearlyData가 해당 연도의 데이터를 이미 가지고 있거나,
    // loadDataForYear(year)가 호출되어 채워졌다고 가정하고, state.yearlyData를 사용.
    // 또는 dirty 파일이 있으면 그것을 우선.
    let yearDataContent = (state.yearlyData && state.yearlyData.year === year) 
                          ? state.yearlyData 
                          : dirtyFileService.getDirtyFileData(yearlyIdentifier);
    
    // 만약 위에서 데이터를 못 찾고, 강제로라도 해당 연도 파일을 만들어야 한다면, 기본 구조라도 생성.
    if (!yearDataContent && state.view.currentDisplayYear === year) { // 현재 작업중인 연도라면 메모리 상태를 사용
        yearDataContent = state.yearlyData;
    }
    if (!yearDataContent) { // 그래도 없다면 최소 구조 (주로 fetch 실패 시)
        yearDataContent = { year: year, labels: [], events: [], backlogTodos: [] };
    }


    files.push({
        filenameInZip: `${year}/${year}.json`,
        data: {
            year: yearDataContent.year || year,
            labels: yearDataContent.labels || [],
            events: yearDataContent.events || [],
            backlogTodos: yearDataContent.backlogTodos || []
        }
    });

    for (let i = 1; i <= 12; i++) {
        const month = String(i).padStart(2, '0');
        const yearMonthKey = `${year}-${month}`;
        const dailyFileIdentifier = `${year}/${yearMonthKey}.json`;
        
        let monthDataObject = dirtyFileService.getDirtyFileData(dailyFileIdentifier);
        if (!monthDataObject && state.dailyData.has(yearMonthKey)) {
            // dirty가 아니더라도 메모리에 있는 데이터는 저장 대상임 (연도 전체 저장이므로)
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
        } else {
            // 해당 월에 데이터가 아예 없는 경우 (파일도, dirty도, 메모리에도 없음)
            // 빈 파일이라도 생성해서 저장할지 여부 결정. 여기서는 데이터 있는 것만 저장.
            // 만약 빈 파일도 포함해야 한다면:
            // files.push({
            //     filenameInZip: `${year}/${yearMonthKey}.json`,
            //     data: { yearMonth: yearMonthKey, routines: [], colorPalette: [], dailyData: {} }
            // });
        }
    }
    return files;
}

export function updateSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    dirtyFileService.markFileAsDirty('settings.json', state.settings);
    eventBus.dispatch('dataChanged', { source: 'settingsUpdated' }); // 필요하다면 이벤트 발생
}


/*****************************************
 * mandalArt 관련 함수
 */

/**
 * 만다라트 데이터가 없을 경우 초기 상태를 생성합니다.
 * mandalArtViewHandler.js에서 호출됩니다.
 */
export function initializeMandalArtState() {
    if (!state.mandalArt) {
        console.log('[DataManager] Initializing Mandal-Art state.');
        state.mandalArt = {
            activeMandalArtId: 'mandal-1',
            mandalArts: [{
                id: 'mandal-1', name: '🚀 나의 첫 만다라트', type: '9x9',
                cells: Array.from({ length: 81 }, (_, i) => ({ id: `cell-${i}`, content: '', isCompleted: false, isHighlighted: false, color: null }))
            }]
        };
        dirtyFileService.markFileAsDirty('mandal-art.json', state.mandalArt);
        eventBus.dispatch('dataChanged', { source: 'mandalArtInitialized' });
    }
}

/**
 * 현재 만다라트 상태 객체를 반환합니다.
 */
export function getMandalArtState() {
    return state.mandalArt;
}

/**
 * 만다라트 상태를 업데이트하고 dirty로 표시합니다.
 * @param {object} newMandalState - 새로운 만다라트 상태 객체
 * @param {object} options - 옵션 객체 { broadcast: boolean }
 */
export function updateMandalArtState(newMandalState, options = {}) {
    state.mandalArt = newMandalState;
    dirtyFileService.markFileAsDirty('mandal-art.json', state.mandalArt);
    if (options.broadcast !== false) {
        eventBus.dispatch('dataChanged', { source: 'mandalArtUpdated' });
    }
}

/**
 * 최적화되어 저장된 만다라트 데이터를 완전한 배열 형태로 복원합니다.
 */
function _hydrateMandalArt(loadedMandalArt) {
    if (!loadedMandalArt || !loadedMandalArt.mandalArts) return loadedMandalArt;
    loadedMandalArt.mandalArts.forEach(mandal => {
        const optimizedCells = mandal.cells || {};
        const fullCells = [];
        for (let i = 0; i < 81; i++) {
            const defaultCell = { id: `cell-${i}`, content: '', isCompleted: false, isHighlighted: false, color: null };
            const loadedCellData = optimizedCells[i] || {};
            fullCells.push({ ...defaultCell, ...loadedCellData });
        }
        mandal.cells = fullCells;
    });
    return loadedMandalArt;
}

/**
 * ID 배열 순서에 맞춰 만다라트 목록의 순서를 변경합니다.
 * @param {Array<string>} orderedIds - 정렬된 만다라트 ID 배열
 */
export function reorderMandalArts(orderedIds) {
    const mandalState = getMandalArtState();
    if (!mandalState || !mandalState.mandalArts) return;

    // ID 순서에 맞춰 새로운 배열을 생성
    mandalState.mandalArts = orderedIds
        .map(id => mandalState.mandalArts.find(m => m.id === id))
        .filter(Boolean); // 혹시 모를 undefined 제거
    
    // broadcast 옵션을 주지 않아 UI가 다시 렌더링되도록 함
    updateMandalArtState(mandalState); 
}
