import { INITIAL_YEAR, PRIORITY_COLORS } from './constants.js';
import { eventBus } from './eventBus.js'; // Import the event bus
import { generateId, getMondayOfWeek, formatDate } from './uiUtils.js'; // Ensure generateId is imported


// Core Data Stores
// export let labels = [];
// export let events = []; // Project highlights
// export let backlogTodos = [];
// export let calendarCellTodos = []; // Todos placed directly on calendar cells
// export let todaysQuickNotes = {}; // Keyed by "YYYY-MM-DD"

// // Application State
// export let currentDisplayYear = INITIAL_YEAR;
// export let currentWeeklyViewStartDate = getMondayOfWeek(new Date()); // Monday of current week
// export let selectedLabel = null; // Holds the currently selected label object for drawing

// --- Central State Object ---
const state = {
    labels: [],
    events: [], // Project highlights
    backlogTodos: [],
    calendarCellTodos: [], // Todos placed directly on calendar cells
    // todaysQuickNotes: {}, // Keyed by "YYYY-MM-DD"
    
    // Application View State
    currentDisplayYear: INITIAL_YEAR,
    currentWeeklyViewStartDate: getMondayOfWeek(new Date()),
    selectedLabel: null, // Holds the currently selected label object for drawing
};

// --- Getters ---
export function getState() {
    return state;
}

// --- Setters / Updaters ---
export function updateCurrentDisplayYear(year) {
    const numericYear = parseInt(year, 10); // 숫자로 변환
    if (state.currentDisplayYear !== numericYear) { // 실제 연도 변경이 있을 때만
        state.currentDisplayYear = numericYear;
        console.log("DataManager: currentDisplayYear updated to", state.currentDisplayYear);
        // --- 중요: 연도 변경을 알리는 이벤트 발행 ---
        eventBus.dispatch('dataChanged', { source: 'updateCurrentDisplayYear' });
        // -----------------------------------------
    }
}

export function updateCurrentWeeklyViewStartDate(date) {
    const newMonday = getMondayOfWeek(new Date(date));
    newMonday.setHours(0, 0, 0, 0); // <<< 시간 정규화 추가!

    // 이미 같은 주의 월요일이면 변경하지 않음 (불필요한 이벤트 방지)
    if (state.currentWeeklyViewStartDate && 
        newMonday.getTime() === state.currentWeeklyViewStartDate.getTime()) {
        return;
    }
    state.currentWeeklyViewStartDate = newMonday;
    console.log("DataManager: currentWeeklyViewStartDate updated to", formatDate(state.currentWeeklyViewStartDate));
    eventBus.dispatch('dataChanged', { source: 'updateCurrentWeeklyViewStartDate' });
}

export function setSelectedLabel(label) {
    state.selectedLabel = label;
    // Potentially trigger UI updates for label selection
    // eventBus.dispatch('dataChanged', { source: 'setSelectedLabel' });
}

// --- Data Manipulators (Examples - to be expanded) ---
export function addLabel(label) {
    state.labels.push(label);
    eventBus.dispatch('dataChanged', { source: 'addLabel' }); // 라벨 목록 UI 업데이트를 위해 필요

    // Trigger re-render of labels UI
}

/**
 * 라벨 배열의 순서를 변경합니다. (드래그 앤 드롭용)
 * @param {string[]} orderedLabelIds - 새로운 순서의 라벨 ID 배열
 */
export function reorderLabels(orderedLabelIds) {
    const newLabelsOrder = orderedLabelIds
        .map(id => state.labels.find(l => l.id === id))
        .filter(Boolean); // 혹시 모를 undefined 제거
    state.labels = newLabelsOrder;
    // renderLabels()가 app.js에서 바로 호출되므로 여기서 dataChanged는 불필요할 수 있으나,
    // 일관성을 위해 추가하거나 app.js에서 호출하는 것으로 유지합니다.
    // eventBus.dispatch('dataChanged', { source: 'reorderLabels' });
}

export function addEvent(event) {
    getState().events.push(event);
    console.log("DataManager: Event Added:", JSON.stringify(event));
    eventBus.dispatch('dataChanged', { source: 'addEvent' });
}

// --- Event (Project Bar) Manipulators ---
export function deleteEvent(eventId) {
    const state = getState();
    state.events = state.events.filter(event => event.id !== eventId);
    console.log("Event Deleted:", eventId);
    eventBus.dispatch('dataChanged', { source: 'deleteEvent' });
}


export function updateEventDates(eventId, newStartDate, newEndDate) {
    const event = getState().events.find(event => event.id === eventId);
    if (event) {
        event.startDate = newStartDate;
        event.endDate = newEndDate;
        console.log("Event Dates Updated:", event);
        eventBus.dispatch('dataChanged', { source: 'updateEventDates' });
    }
}



// Add more functions here to manage (add, update, delete)
// backlogTodos, calendarCellTodos, todaysQuickNotes as needed.
// For example:
// export function getTodaysQuickNote(dateKey) { // dateKey is YYYY-MM-DD
//     return state.todaysQuickNotes[dateKey] || ""; 
// }

// export function updateTodaysQuickNote(dateKey, text) {
//     state.todaysQuickNotes[dateKey] = text;
//     eventBus.dispatch('dataChanged', { source: 'updateTodaysQuickNote' });
//     // Potentially trigger re-render of the specific UI element
// }


/**
 * Replaces the entire application state with data from a loaded file.
 * @param {object} dataBundle - The `calendarData` object from a saved JSON file.
 */
export function loadAllData(dataBundle = {}) {
    state.labels = dataBundle.labels || [];
    state.events = dataBundle.events || [];
    state.backlogTodos = dataBundle.backlogTodos || [];
    state.calendarCellTodos = dataBundle.calendarCellTodos || [];
    // state.todaysQuickNotes = dataBundle.todaysQuickNotes || {};
    
    // Optionally, restore view state if it was saved
    // state.currentDisplayYear = dataBundle.viewState?.year || INITIAL_YEAR;
    // state.currentWeeklyViewStartDate = dataBundle.viewState?.weekStart ? new Date(dataBundle.viewState.weekStart) : getMondayOfWeek(new Date());

    console.log("Data loaded into state:", state);
}

export function getAllDataForSave() {
    return {
        labels: state.labels,
        events: state.events,
        backlogTodos: state.backlogTodos,
        calendarCellTodos: state.calendarCellTodos,
        // todaysQuickNotes: state.todaysQuickNotes,
    };
}
/**
 * Checks if an identical event already exists.
 * @param {{labelId: string, startDate: string, endDate: string}} newEvent - The new event to check.
 * @returns {boolean}
 */
export function isDuplicateEvent({ labelId, startDate, endDate }) {
    return state.events.some(event => 
        event.labelId === labelId && 
        event.startDate === startDate && 
        event.endDate === endDate
    );
}

// --- Backlog Todo Manipulators ---
export function addBacklogTodo(text, priority = 0) {
    if (!text) return;
    const newTodo = {
        id: generateId(),
        text,
        priority: parseInt(priority, 10),
        color: PRIORITY_COLORS[priority] || '#ccc'
    };
    state.backlogTodos.push(newTodo); // 직접 state 수정
    console.log("DataManager: Backlog Todo Added:", JSON.stringify(newTodo));
    eventBus.dispatch('dataChanged', { source: 'addBacklogTodo' }); // 추가
}

export function deleteBacklogTodo(todoId) {
    state.backlogTodos = state.backlogTodos.filter(todo => todo.id !== todoId);
    console.log("DataManager: Backlog Todo Deleted:", todoId);
    eventBus.dispatch('dataChanged', { source: 'deleteBacklogTodo' });
}

export function updateBacklogTodoText(todoId, newText) {
    const todo = state.backlogTodos.find(todo => todo.id === todoId);
    if (todo && newText && todo.text !== newText) { // 변경이 있을 때만
        todo.text = newText;
        console.log("DataManager: Backlog Todo Text Updated:", JSON.stringify(todo));
        eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoText' });
    }
}

export function updateBacklogTodoPriority(todoId, newPriority) {
    const todo = state.backlogTodos.find(todo => todo.id === todoId);
    const priority = parseInt(newPriority, 10);
    if (todo && !isNaN(priority) && priority >= 0 && priority <= 3 && todo.priority !== priority) { // 변경이 있을 때만
        todo.priority = priority;
        todo.color = PRIORITY_COLORS[priority];
        console.log("DataManager: Backlog Priority Updated:", JSON.stringify(todo));
        eventBus.dispatch('dataChanged', { source: 'updateBacklogTodoPriority' });
    }
}

/**
 * Moves a todo from the backlog to a specific date on the calendar.
 * @param {string} todoId - The ID of the todo to move.
 * @param {string} targetDate - The date string (YYYY-MM-DD) to move the todo to.
 */
export function moveBacklogTodoToCalendar(todoId, targetDate) {
    const todoToMoveIndex = state.backlogTodos.findIndex(todo => todo.id === todoId);

    if (todoToMoveIndex > -1) {
        const [todoToMove] = state.backlogTodos.splice(todoToMoveIndex, 1);
        
        const newCalendarTodo = {
            id: generateId(),
            originalBacklogId: todoToMove.id,
            date: targetDate,
            text: todoToMove.text,
            color: todoToMove.color,
            type: 'todo' // Add a type for easy identification
        };

        state.calendarCellTodos.push(newCalendarTodo);
        console.log(`Todo moved from backlog to calendar on ${targetDate}`, newCalendarTodo);

        // Dispatch a global event indicating data has changed
        eventBus.dispatch('dataChanged', { source: 'backlog-to-calendar' });
    }
}

// --- Calendar Cell Todo Manipulators ---
export function addCalendarTodo({ date, text }) {
    if (!date || !text) return;
    const newTodo = {
        id: generateId(),
        date,
        text,
        color: '#6c757d', // Default color for directly added todos
        type: 'todo'
    };

    // <<< 로그 추가: 데이터 추가 직전과 직후의 상태 확인 ---<<<
    console.log(`DATAMANAGER: About to add todo for ${date}:`, JSON.stringify(newTodo));
    const currentState = getState();
    console.log(`DATAMANAGER: calendarCellTodos BEFORE push (length ${currentState.calendarCellTodos.length}):`, JSON.stringify(currentState.calendarCellTodos.map(t => t.id + ":" + t.text)));
    
    currentState.calendarCellTodos.push(newTodo); // 여기서 한 번 추가되어야 합니다.
    
    console.log(`DATAMANAGER: calendarCellTodos AFTER push (length ${currentState.calendarCellTodos.length}):`, JSON.stringify(currentState.calendarCellTodos.map(t => t.id + ":" + t.text)));
    console.log("DATAMANAGER: Calendar Todo Added (newTodo object):", JSON.stringify(newTodo));
    // >>>----------------------------------------------------<<<
    
    eventBus.dispatch('dataChanged', { source: 'addCalendarTodo' });
}

export function deleteCalendarTodo(todoId) {
    const state = getState();
    state.calendarCellTodos = state.calendarCellTodos.filter(todo => todo.id !== todoId);
    console.log("Calendar Todo Deleted:", todoId);
    eventBus.dispatch('dataChanged', { source: 'deleteCalendarTodo' });
}


export function updateCalendarTodoText(todoId, newText) {
    const todo = getState().calendarCellTodos.find(todo => todo.id === todoId);
    if (todo && newText && todo.text !== newText.trim()) { // 변경이 있고, 공백만 있는 것이 아닐 때
        todo.text = newText.trim();
        console.log("DataManager: Calendar Todo Text Updated:", JSON.stringify(todo));
        eventBus.dispatch('dataChanged', { source: 'updateCalendarTodoText' }); // <<< 이벤트 발행 추가
    } else if (todo && newText.trim() === todo.text) {
        // 텍스트 변경이 없으면 아무것도 안하거나, UI를 원래대로 되돌리기 위한 별도 처리가 필요할 수 있음
        // 여기서는 데이터 변경이 없으므로 이벤트를 발생시키지 않음.
        console.log("DataManager: Calendar Todo Text not changed.");
    }
}


export function updateLabelName(labelId, newName) {
    const label = getState().labels.find(l => l.id === labelId);
    if (label && newName && newName.trim() !== '') {
        label.name = newName.trim();
        console.log("Label Name Updated:", label);
        eventBus.dispatch('dataChanged', { source: 'updateLabelName' });
    }
}

export function deleteLabelAndAssociatedEvents(labelIdToDelete) {
    const state = getState();
    const originalLabelCount = state.labels.length;
    const originalEventCount = state.events.length;

    // 1. 라벨 삭제
    state.labels = state.labels.filter(label => label.id !== labelIdToDelete);

    // 2. 해당 라벨을 사용하는 모든 이벤트 삭제
    state.events = state.events.filter(event => event.labelId !== labelIdToDelete);

    if (state.labels.length !== originalLabelCount || state.events.length !== originalEventCount) {
        console.log(`Label ${labelIdToDelete} and its events deleted.`);
        // 만약 현재 선택된 라벨이 삭제된 라벨이라면 선택 해제
        if (state.selectedLabel && state.selectedLabel.id === labelIdToDelete) {
            setSelectedLabel(null);
        }
        eventBus.dispatch('dataChanged', { source: 'deleteLabelAndEvents' });
    }
}

/**
 * 특정 날짜의 calendarCellTodos 순서를 변경합니다.
 * @param {string} date - 대상 날짜 (YYYY-MM-DD)
 * @param {string[]} orderedTodoIds - 새로운 순서의 할 일 ID 배열
 */
export function reorderCalendarCellTodos(date, orderedTodoIds) {
    const state = getState();
    const todosForOtherDates = state.calendarCellTodos.filter(todo => todo.date !== date);
    const todosForTargetDate = orderedTodoIds
        .map(id => state.calendarCellTodos.find(todo => todo.id === id && todo.date === date))
        .filter(Boolean); // 유효한 todo만 필터링

    if (todosForTargetDate.length !== orderedTodoIds.length && state.calendarCellTodos.filter(todo => todo.date === date).length !== orderedTodoIds.length) {
        // ID 배열과 실제 해당 날짜의 투두 개수가 다르면 오류 가능성이 있으므로 로깅
        console.warn("DataManager: Mismatch in reordering calendar cell todos for date", date);
    }
    
    state.calendarCellTodos = [...todosForOtherDates, ...todosForTargetDate];
    console.log(`DataManager: Reordered calendar cell todos for ${date}`);
    eventBus.dispatch('dataChanged', { source: 'reorderCalendarCellTodos', date });
}
