// js/dailyViewHandler.js

import { initYearProgress } from '../daily_view/yearProgress.js';
import { initDayProgress } from '../daily_view/dayProgress.js';
import {
    initProjectTodoApp,
    getProjectTodoData,
    setProjectTodoDataAndRender as setAndRenderProjectTodos
} from '../daily_view/projectTodos.js';
import { initTodoApp, getTodoData, setTodoDataAndRender as setAndRenderTodos } from '../daily_view/todo.js';
import { initRoutinesApp, getRoutinesData, setRoutinesDataAndRender as setAndRenderRoutines } from '../daily_view/routines.js';
import {
    initTimelines,
    getTimelineBlockData,
    getTimelineGoalData,
    setTimelineBlockDataAndRender,
    setTimelineGoalDataAndRender,
    applySelectedColorToCurrentlyEditingCell,
    getScheduledTasksData,
    setScheduledTasksDataAndRender,
    updatePassedTimeVisuals
} from '../daily_view/timelines.js';
import { initDiaryApp, getDiaryData, setDiaryDataAndRender as setAndRenderDiary } from '../daily_view/diary.js';
import { isSameDate, getDateRange, formatDate } from '../js/uiUtils.js';

// 모듈 스코프 변수
let localDataManager;
let localEventBus;
let currentLoadedDate; // YYYY-MM-DD
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = []; // 현재 월의 색상 팔레트

const activeEventListeners = [];
let activeColorOptionContextMenu = null; // 색상 옵션 삭제 컨텍스트 메뉴 DOM 요소

let liveTimelineUpdateIntervalId = null;

// --- Helper Functions ---

function displayCurrentDate(dateStr) {
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay && dateStr) {
        const [year, month, day] = dateStr.split('-');
        dateDisplay.textContent = `${year} / ${month} / ${day}`;
    } else if (dateDisplay) {
        const now = new Date();
        dateDisplay.textContent = `${now.getFullYear()} / ${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`;
    }
}

// ▼▼▼ 색상 옵션 컨텍스트 메뉴 관련 함수 ▼▼▼
function removeColorOptionContextMenu() {
    if (activeColorOptionContextMenu) {
        activeColorOptionContextMenu.remove();
        activeColorOptionContextMenu = null;
    }
    // window에 등록된 리스너는 show 시점에 once:true로 등록하므로, 여기서 명시적 제거는 불필요할 수 있음
    // 하지만 안전하게 하려면 cleanupDailyDetailView에서 확실히 제거
    window.removeEventListener('click', handleOutsideColorOptionContextMenuClick, true);
}

function handleOutsideColorOptionContextMenuClick(event) {
    if (activeColorOptionContextMenu &&
        activeColorOptionContextMenu !== event.target &&
        !activeColorOptionContextMenu.contains(event.target)) {
        removeColorOptionContextMenu();
    }
}

function showColorOptionContextMenu(event, colorData, colorOptionElement) {
    event.preventDefault();
    event.stopPropagation();
    removeColorOptionContextMenu();

    activeColorOptionContextMenu = document.createElement('div');
    activeColorOptionContextMenu.className = 'dv-color-option-context-menu';

    const menuWidth = 100;
    const menuHeight = 40;
    let x = event.pageX;
    let y = event.pageY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 5;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 5;

    activeColorOptionContextMenu.style.left = `${x}px`;
    activeColorOptionContextMenu.style.top = `${y}px`;

    const deleteItem = document.createElement('div');
    deleteItem.className = 'dv-color-option-delete-item';
    deleteItem.textContent = '삭제';
    deleteItem.title = `"${colorData.label || colorData.color}" 색상 삭제`;

    deleteItem.addEventListener('click', (e) => {
        e.stopPropagation();
        savedColors = savedColors.filter(c => c.color.toLowerCase() !== colorData.color.toLowerCase());
        renderColorOptionsUI(); // 팔레트 UI만 업데이트
        handleDataChange();     // 변경된 savedColors를 포함하여 전체 월 데이터 저장
        removeColorOptionContextMenu();
    });

    activeColorOptionContextMenu.appendChild(deleteItem);
    document.body.appendChild(activeColorOptionContextMenu);

    setTimeout(() => {
        window.addEventListener('click', handleOutsideColorOptionContextMenuClick, { capture: true, once: true });
    }, 0);
}
// ▲▲▲ 색상 옵션 컨텍스트 메뉴 관련 함수 ▲▲▲

// ▼▼▼ 색상 옵션 UI만 다시 그리는 함수 ▼▼▼
function renderColorOptionsUI() {
    const colorPicker = document.getElementById('colorPicker');
    const addColorBtn = document.getElementById('addColorBtn');
    if (!colorPicker || !addColorBtn) {
        console.warn("renderColorOptionsUI: colorPicker or addColorBtn not found.");
        return;
    }

    const existingOptions = colorPicker.querySelectorAll('.dv-color-option');
    existingOptions.forEach(opt => opt.remove());

    savedColors.forEach(({ color, label }) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'dv-color-option';
        colorOption.style.backgroundColor = color;
        const displayLabel = label || color;
        colorOption.dataset.label = displayLabel;
        colorOption.title = displayLabel;

        colorOption.addEventListener('click', (e) => {
            e.stopPropagation();
            removeColorOptionContextMenu();
            selectedColor = color;
            if (typeof applySelectedColorToCurrentlyEditingCell === 'function') {
                applySelectedColorToCurrentlyEditingCell();
            }
        });

        colorOption.addEventListener('contextmenu', (e) => {
            showColorOptionContextMenu(e, { color, label: displayLabel }, colorOption);
        });
        colorPicker.insertBefore(colorOption, addColorBtn);
    });
}
// ▲▲▲ 색상 옵션 UI만 다시 그리는 함수 ▲▲▲


function initializeColorPicker() {
    renderColorOptionsUI(); // 초기 색상 옵션 렌더링

    const addColorBtn = document.getElementById('addColorBtn');
    if (addColorBtn && !addColorBtn.dataset.listenerAttached) {
        const toggleColorPopupHandler = (e) => {
            e.stopPropagation();
            removeColorOptionContextMenu();
            const popup = document.getElementById('colorPickerPopup');
            if (popup) {
                popup.classList.toggle('dv-show');
                const colorLabelInput = document.getElementById('colorLabel');
                if (colorLabelInput) {
                    colorLabelInput.value = '';
                    if (popup.classList.contains('dv-show')) {
                        colorLabelInput.focus();
                    }
                }
            }
        };
        addColorBtn.addEventListener('click', toggleColorPopupHandler);
        addColorBtn.dataset.listenerAttached = 'true'; // 리스너 중복 방지
        activeEventListeners.push({ element: addColorBtn, type: 'click', handler: toggleColorPopupHandler });
    }

    const saveColorBtn = document.getElementById('saveColorBtn');
    const colorInput = document.getElementById('colorInput');
    const colorLabelInput = document.getElementById('colorLabel');

    if (saveColorBtn && colorInput && colorLabelInput && !saveColorBtn.dataset.listenerAttached) {
        const handleSaveNewColorAction = () => {
            if (!localDataManager || !currentLoadedDate) return;
            
            const newSelectedColor = colorInput.value;
            const newLabel = colorLabelInput.value.trim() || newSelectedColor;

            if (!savedColors.some(c => c.color.toLowerCase() === newSelectedColor.toLowerCase())) {
                savedColors.push({ color: newSelectedColor, label: newLabel });
                renderColorOptionsUI(); // 옵션 UI만 다시 그림
                handleDataChange(); // 변경된 savedColors를 포함하여 전체 월 데이터 저장
            }
            document.getElementById('colorPickerPopup')?.classList.remove('dv-show');
        };

        saveColorBtn.addEventListener('click', handleSaveNewColorAction);
        saveColorBtn.dataset.listenerAttached = 'true';
        activeEventListeners.push({ element: saveColorBtn, type: 'click', handler: handleSaveNewColorAction });

        if (!colorLabelInput.dataset.keydownListenerAttached) {
            const colorLabelKeydownHandler = (e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSaveNewColorAction(); }
            };
            colorLabelInput.addEventListener('keydown', colorLabelKeydownHandler);
            colorLabelInput.dataset.keydownListenerAttached = 'true';
            activeEventListeners.push({ element: colorLabelInput, type: 'keydown', handler: colorLabelKeydownHandler });
        }
        
        if (!colorInput.dataset.keydownListenerAttached) {
            const colorInputKeydownHandler = (e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSaveNewColorAction(); }
            };
            colorInput.addEventListener('keydown', colorInputKeydownHandler);
            colorInput.dataset.keydownListenerAttached = 'true';
            activeEventListeners.push({ element: colorInput, type: 'keydown', handler: colorInputKeydownHandler });
        }
    }
}

const outsideColorPopupClickHandler = (e) => {
    const popup = document.getElementById('colorPickerPopup');
    const addColorBtn = document.getElementById('addColorBtn'); // ID가 addColorBtn인지 확인
    if (popup && popup.classList.contains('dv-show') &&
        !popup.contains(e.target) &&
        e.target !== addColorBtn &&
        !addColorBtn?.contains(e.target)) {
        popup.classList.remove('dv-show');
    }
};


function handleDataChange() {
    if (!localDataManager || !currentLoadedDate) {
        console.warn("[DailyViewHandler] handleDataChange aborted: dataManager or currentLoadedDate missing.");
        return;
    }
    const yearMonth = currentLoadedDate.substring(0, 7);
    
    // dataManager로부터 해당 월의 전체 데이터 객체를 가져옴 (없으면 기본 구조)
    // getRawDailyDataForMonth는 { yearMonth, routines, colorPalette, dailyData } 구조를 반환해야 함
    const monthDataObject = JSON.parse(JSON.stringify(localDataManager.getRawDailyDataForMonth(yearMonth) || 
                        { 
                            yearMonth, 
                            routines: [], 
                            colorPalette: [], // 초기 팔레트는 savedColors 대신 빈 배열 또는 설정값
                            dailyData: {} 
                        }));

    // 현재 Daily View의 날짜별 데이터 수집
    const currentDaySpecificData = {
        todos: typeof getTodoData === 'function' ? getTodoData() : [],
        timeBlocks: typeof getTimelineBlockData === 'function' ? getTimelineBlockData() : {},
        goalBlocks: typeof getTimelineGoalData === 'function' ? getTimelineGoalData() : {},
        scheduledTimelineTasks: typeof getScheduledTasksData === 'function' ? getScheduledTasksData() : [],
        diary: typeof getDiaryData === 'function' ? getDiaryData() : {}
    };
    
    if (!monthDataObject.dailyData) monthDataObject.dailyData = {};
    monthDataObject.dailyData[currentLoadedDate] = currentDaySpecificData; // 날짜별 데이터 업데이트
    
    // 월별 공유 데이터 업데이트
    monthDataObject.routines = typeof getRoutinesData === 'function' ? getRoutinesData() : (monthDataObject.routines || []);
    monthDataObject.colorPalette = [...savedColors]; // 현재 UI의 팔레트 상태(savedColors)로 덮어쓰기

    localDataManager.updateDailyData(yearMonth, monthDataObject); // 수정된 전체 monthDataObject를 dataManager에 전달
    console.log(`[DailyViewHandler] Notified dataManager of changes for ${yearMonth}`);
}

// [수정] setAllModuleData 함수는 이제 날짜별 데이터와 월별 공유 데이터를 별도로 받음
function setAllModuleData(daySpecificData = {}, monthSharedData = {}, activeProjects = []) {
    // if (typeof setAndRenderProjectTodos === 'function') setAndRenderProjectTodos(activeProjects);
    if (typeof setAndRenderTodos === 'function') setAndRenderTodos(daySpecificData.todos || []);
    if (typeof setAndRenderRoutines === 'function') setAndRenderRoutines(monthSharedData.routines || []); // 월별 루틴 사용
    if (typeof setTimelineBlockDataAndRender === 'function') setTimelineBlockDataAndRender(daySpecificData.timeBlocks || {}, 'timeGridDOM');
    if (typeof setTimelineGoalDataAndRender === 'function') setTimelineGoalDataAndRender(daySpecificData.goalBlocks || {}, 'goalTimeGridDOM');
    if (typeof setScheduledTasksDataAndRender === 'function') setScheduledTasksDataAndRender(daySpecificData.scheduledTimelineTasks || []);
    if (typeof setAndRenderDiary === 'function') setAndRenderDiary(daySpecificData.diary || {});
}

// function updateElapsedTimeBlocksInternal() { /* ... */ }

// --- Daily View 초기화 함수 ---
export async function initDailyDetailView(dataModule, busModule, params, query) {
    console.log(`[DailyViewHandler] Daily View 초기화 시작 for date: ${params.date}`);
    localDataManager = dataModule;
    localEventBus = busModule;
    currentLoadedDate = params.date; // 예: "2025-05-31"
    activeEventListeners.length = 0;
    removeColorOptionContextMenu();

    if (liveTimelineUpdateIntervalId) {
        clearInterval(liveTimelineUpdateIntervalId);
        liveTimelineUpdateIntervalId = null;
    }

    displayCurrentDate(currentLoadedDate);

    const yearOfDailyView = parseInt(currentLoadedDate.substring(0, 4), 10);
    const yearMonthKeyForDailyView = currentLoadedDate.substring(0, 7);

    if (localDataManager && typeof localDataManager.getState === 'function' && typeof localDataManager.loadDataForYear === 'function') {
        const dmState = localDataManager.getState();
        if (!dmState.yearlyData || dmState.currentDisplayYear !== yearOfDailyView || !localDataManager.getRawDailyDataForMonth(yearMonthKeyForDailyView)) {
            console.log(`[DailyViewHandler] Data for year ${yearOfDailyView} not fully loaded. Forcing loadDataForYear.`);
            await localDataManager.loadDataForYear(yearOfDailyView);
        } else {
            console.log(`[DailyViewHandler] Data for year ${yearOfDailyView} is already loaded.`);
        }
    }

    const settings = localDataManager.getSettings(); // 최신 설정을 가져옴 (loadDataForYear 이후에 호출될 수 있도록)
    const monthDataObject = localDataManager.getRawDailyDataForMonth(yearMonthKeyForDailyView) ||
                          {
                              yearMonth: yearMonthKeyForDailyView,
                              routines: [],
                              colorPalette: settings?.colorPalette || [],
                              dailyData: {}
                          };

    savedColors = monthDataObject.colorPalette && monthDataObject.colorPalette.length > 0
                ? [...monthDataObject.colorPalette]
                : (settings?.colorPalette && settings.colorPalette.length > 0 ? [...settings.colorPalette] : []);
    initializeColorPicker();

    const dataForThisDate = monthDataObject.dailyData?.[currentLoadedDate] || {};


    // 1. 그날의 Active 프로젝트 목록을 먼저 계산합니다.
    const allYearlyData = localDataManager.getState();
    const allProjects = allYearlyData.projects || [];
    const allEvents = allYearlyData.events || [];
    const activeProjectsForToday = [];

    const todayDateObj = new Date(currentLoadedDate);
    todayDateObj.setHours(0,0,0,0);

    allEvents.forEach(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        startDate.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);

        if (todayDateObj >= startDate && todayDateObj <= endDate) {
            const projectData = allProjects.find(p => p.id === event.labelId);
            if (projectData) {
                activeProjectsForToday.push(projectData);
            }
        }
    });

    // 2. 이제 계산된 변수들을 사용하여 다른 모듈에 데이터를 설정합니다.
    setAllModuleData(dataForThisDate, monthDataObject);


    // 3. 마지막으로 각 하위 모듈을 초기화합니다.
    // ProjectTodos 모듈은 이제 daily data가 아닌, 방금 계산한 연간 프로젝트 데이터를 받습니다.
    if (typeof initProjectTodoApp === 'function') {
        initProjectTodoApp(
            '#project-todo-app-container',
            activeProjectsForToday,
            (changeInfo) => { // 콜백 함수 시그니처 변경: {type, payload}
                if (changeInfo && changeInfo.type === 'TOGGLE_TODO') {
                    localDataManager.updateProjectTodo(changeInfo.payload.projectId, changeInfo.payload.todoId, changeInfo.payload.completed);
                } else if (changeInfo && changeInfo.type === 'UPDATE_PROJECT') {
                    // 프로젝트의 할 일 목록(추가/삭제/이름변경)이 변경되었으므로
                    // dataManager의 yearlyData를 dirty로 표시하여 저장 유도
                    localDataManager.markYearlyDataAsDirty();
                }
            }
        );
    }
    if (typeof initTodoApp === 'function') initTodoApp('#todo-app-container', dataForThisDate.todos || [], handleDataChange);
    if (typeof initRoutinesApp === 'function') initRoutinesApp('#routines-app-container', monthDataObject.routines || [], handleDataChange);
    if (typeof initDiaryApp === 'function') initDiaryApp('#diary-app-container', dataForThisDate.diary || {}, handleDataChange);

    if (typeof initTimelines === 'function') {
        const timelineCallbacks = {
            getSelectedColor: () => selectedColor,
            isDarkColor: (color) => {
                if (!color) return false;
                const rgbMatch = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (!rgbMatch) {
                    if (color.startsWith('#')) {
                        let hex = color.slice(1);
                        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                        if (hex.length === 6) {
                            const r = parseInt(hex.substring(0, 2), 16);
                            const g = parseInt(hex.substring(2, 4), 16);
                            const b = parseInt(hex.substring(4, 6), 16);
                            return (r * 299 + g * 587 + b * 114) / 1000 < 128;
                        }
                    } return false;
                }
                const [r, g, b] = [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
                return (r * 299 + g * 587 + b * 114) / 1000 < 128;
            },
            normalizeColor: (color) => color,
            onTimeGridDataChange: () => handleDataChange()
        };
        const timeGridDomId = 'timeGridDOM';
        const goalGridDomId = 'goalTimeGridDOM';
        initTimelines(timeGridDomId, goalGridDomId, timelineCallbacks);

        if (typeof updatePassedTimeVisuals === 'function') {
            const runLiveUpdates = () => {
                const timelineDateString = currentLoadedDate; // "YYYY-MM-DD" 문자열 (예: "2025-05-31")
                let isTimelineEffectivelyToday;
    
                const now = new Date();
                const currentActualHour = now.getHours(); // 현재 실제 시간 (0-23)
    
                // timelineDateString을 Date 객체로 변환 (시간 부분은 00:00으로)
                const [tlYear, tlMonth, tlDay] = timelineDateString.split('-').map(Number);
                const timelineDateForComparison = new Date(tlYear, tlMonth - 1, tlDay); // JS 월은 0부터 시작
    
                const todayDateForComparison = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
                const ACTUAL_DAY_STARTS_AT_HOUR_CONST = 6; // timeline.js 와 동일 값 사용
    
                if (timelineDateForComparison.getTime() === todayDateForComparison.getTime()) {
                    // 케이스 1: 현재 보고 있는 뷰가 오늘 달력 날짜 (예: 6월 1일 뷰, 현재도 6월 1일)
                    // 이 타임라인이 '오늘'의 유효한 타임라인인가? => 지금이 오전 6시 이후인가?
                    isTimelineEffectivelyToday = currentActualHour >= ACTUAL_DAY_STARTS_AT_HOUR_CONST;
                } else if (timelineDateForComparison.getTime() < todayDateForComparison.getTime()) {
                    // 케이스 2: 현재 보고 있는 뷰가 어제 또는 그 이전 날짜 (예: 5월 31일 뷰, 현재는 6월 1일)
                    const oneDayMilliseconds = 24 * 60 * 60 * 1000;
                    const isImmediatelyPreviousDay = (todayDateForComparison.getTime() - timelineDateForComparison.getTime()) === oneDayMilliseconds;
    
                    // 이 타임라인이 '오늘'의 유효한 타임라인인가? => (어제 날짜 뷰) 이고 (현재가 오전 6시 이전 새벽) 인가?
                    isTimelineEffectivelyToday = isImmediatelyPreviousDay && (currentActualHour < ACTUAL_DAY_STARTS_AT_HOUR_CONST);
                } else {
                    // 케이스 3: 미래 날짜 뷰
                    isTimelineEffectivelyToday = false;
                }
    
                // 수정된 파라미터로 timeline.js 함수 호출
                updatePassedTimeVisuals('timeGridDOM', isTimelineEffectivelyToday, timelineDateString);
                updatePassedTimeVisuals('goalTimeGridDOM', isTimelineEffectivelyToday, timelineDateString); // Goal 타임라인도 동일하게 처리
    
            };
    
            runLiveUpdates(); // 최초 실행
    
            // 인터벌 실행 조건 수정:
            // 1. 현재 보고 있는 뷰가 달력상 오늘 날짜이거나
            // 2. 현재 보고 있는 뷰가 달력상 어제 날짜이고, 지금이 다음날 새벽 (ACTUAL_DAY_STARTS_AT_HOUR 이전)인 경우
            const nowForIntervalCheck = new Date();
            const [loadedYear, loadedMonth, loadedDay] = currentLoadedDate.split('-').map(Number);
            const currentLoadedDateObj = new Date(loadedYear, loadedMonth -1, loadedDay);
            const todayObjForIntervalCheck = new Date(nowForIntervalCheck.getFullYear(), nowForIntervalCheck.getMonth(), nowForIntervalCheck.getDate());
            const ACTUAL_DAY_STARTS_AT_HOUR_FOR_INTERVAL = 6;
    
            let shouldRunIntervalUpdates = false;
            if (currentLoadedDateObj.getTime() === todayObjForIntervalCheck.getTime()) { // 오늘 뷰
                 shouldRunIntervalUpdates = true; // 오늘 뷰는 항상 인터벌 대상 (내부에서 6시 이전/이후 체크)
            } else { // 어제 또는 다른 날 뷰
                const oneDayMs = 24 * 60 * 60 * 1000;
                if ((todayObjForIntervalCheck.getTime() - currentLoadedDateObj.getTime()) === oneDayMs && nowForIntervalCheck.getHours() < ACTUAL_DAY_STARTS_AT_HOUR_FOR_INTERVAL) {
                    // 어제 뷰 + 지금 새벽
                    shouldRunIntervalUpdates = true;
                }
            }
    
            if (shouldRunIntervalUpdates) {
                if (liveTimelineUpdateIntervalId) clearInterval(liveTimelineUpdateIntervalId);
                liveTimelineUpdateIntervalId = setInterval(runLiveUpdates, 60000); // 1분마다 업데이트
            } else {
                if (liveTimelineUpdateIntervalId) {
                    clearInterval(liveTimelineUpdateIntervalId);
                    liveTimelineUpdateIntervalId = null;
                }
            }
        }
    }

    if (typeof initYearProgress === 'function') initYearProgress('#year-progress-header-container');
    if (typeof initDayProgress === 'function') initDayProgress('#day-progress-bar-host');

    const existingDocClickListener = activeEventListeners.find(l => l.target === document && l.type === 'click' && l.handler === outsideColorPopupClickHandler);
    if (!existingDocClickListener) {
        document.addEventListener('click', outsideColorPopupClickHandler);
        activeEventListeners.push({ target: document, type: 'click', handler: outsideColorPopupClickHandler });
    }


    // Cmd+S 핸들러 (현재 Daily View의 연도 전체 데이터 저장)
    async function handleSaveDataForCurrentDailyViewYear() {
        if (typeof JSZip === 'undefined') {
            alert("JSZip library is not loaded."); return;
        }
        if (!localDataManager || !currentLoadedDate) {
            console.warn("[DailyViewHandler] Cannot save, localDataManager or currentLoadedDate missing.");
            return;
        }
        const yearOfDailyView = parseInt(currentLoadedDate.substring(0, 4), 10);
        console.log(`[DailyViewHandler] Attempting to save all data for year: ${yearOfDailyView} (like main view's Cmd+S)`);

        let filesToSave;
        // dataManager.js의 getCurrentYearDataForSave()를 사용합니다.
        // 이 함수는 내부적으로 dataManager.state.view.currentDisplayYear를 사용합니다.
        // initDailyDetailView 상단에서 yearOfDailyView로 loadDataForYear를 호출했으므로,
        // dataManager.state.view.currentDisplayYear는 yearOfDailyView로 설정되어 있을 것입니다.
        if (typeof localDataManager.getCurrentYearDataForSave === 'function') {
             // 먼저 dataManager의 currentDisplayYear가 daily view의 연도와 일치하는지 확인/설정하는 것이 안전합니다.
             // loadDataForYear를 호출하면 currentDisplayYear가 업데이트됩니다.
             // 위에서 이미 yearOfDailyView로 loadDataForYear를 호출했을 것이므로, 여기서는 그냥 호출합니다.
            filesToSave = localDataManager.getCurrentYearDataForSave();
        } else {
            console.error("localDataManager.getCurrentYearDataForSave is not available.");
            alert("연도별 전체 저장 기능을 사용할 수 없습니다.");
            return;
        }

        if (!filesToSave || filesToSave.length === 0) {
             alert(`${yearOfDailyView}년에 저장할 데이터가 없습니다.`); return;
        }

        const zip = new JSZip();
        const yearFolder = zip.folder(String(yearOfDailyView));
        filesToSave.forEach(fileInfo => {
            const filenameParts = fileInfo.filenameInZip.split('/');
            const filename = filenameParts.length > 1 ? filenameParts[1] : filenameParts[0];
            yearFolder.file(filename, JSON.stringify(fileInfo.data, null, 2));
        });

        try {
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipFilename = `backup_${yearOfDailyView}.zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = zipFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            // if (typeof localDataManager.clearAllDirtyFilesForYear === 'function') {
            //     localDataManager.clearAllDirtyFilesForYear(yearOfDailyView);
            //     console.log(`[DailyViewHandler] Data for year ${yearOfDailyView} saved and dirty flags for this year cleared.`);
            // }
        } catch (e) {
            console.error(`Error generating ZIP for year ${yearOfDailyView}:`, e);
            alert(`${yearOfDailyView}년 데이터 백업 파일 생성 중 오류가 발생했습니다.`);
        }
    }

    const dailyViewKeydownHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            console.log('[DailyViewHandler] Ctrl+S pressed, initiating save for current daily view year.');
            handleSaveDataForCurrentDailyViewYear();
        }
    };
    document.addEventListener('keydown', dailyViewKeydownHandler);
    activeEventListeners.push({ target: document, type: 'keydown', handler: dailyViewKeydownHandler });

    console.log('[DailyViewHandler] Daily View 초기화 완료');
}

// --- Daily View 정리 함수 ---
export function cleanupDailyDetailView() {
    console.log('[DailyViewHandler] Daily View 정리 시작');

    if (liveTimelineUpdateIntervalId) {
        clearInterval(liveTimelineUpdateIntervalId);
        liveTimelineUpdateIntervalId = null;
    }

    removeColorOptionContextMenu(); // 컨텍스트 메뉴 및 관련 window 리스너 제거

    activeEventListeners.forEach(listener => {
        const target = listener.target || listener.element;
        if (target && typeof target.removeEventListener === 'function') {
             // dataset 플래그로 관리되는 리스너들은 해당 요소가 DOM에서 사라지거나
             // initializeColorPicker 등에서 cloneNode 등으로 교체될 때 자동으로 해제되거나
             // 해당 함수 내에서 명시적으로 removeEventListener를 해줘야 함.
             // 여기서는 document에 직접 붙인 리스너나, cleanup 시 반드시 제거해야 하는 것들 위주로.
            target.removeEventListener(listener.type, listener.handler);
        }
    });
    activeEventListeners.length = 0;

    // 리스너 플래그 초기화 (initializeColorPicker 등에서 사용한 플래그들)
    const addColorBtn = document.getElementById('addColorBtn');
    if (addColorBtn) delete addColorBtn.dataset.listenerAttached;
    const saveColorBtn = document.getElementById('saveColorBtn');
    if (saveColorBtn) delete saveColorBtn.dataset.listenerAttached;
    const colorLabelInput = document.getElementById('colorLabel');
    if (colorLabelInput) delete colorLabelInput.dataset.keydownListenerAttached;
    const colorInput = document.getElementById('colorInput');
    if (colorInput) delete colorInput.dataset.keydownListenerAttached;


    currentLoadedDate = null;
    localDataManager = null;
    localEventBus = null;
    savedColors = [];
    selectedColor = 'rgb(255, 255, 255)';

    console.log('[DailyViewHandler] Daily View 정리 완료');
}