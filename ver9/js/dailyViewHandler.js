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
    setScheduledTasksDataAndRender
} from '../daily_view/timelines.js';
import { initDiaryApp, getDiaryData, setDiaryDataAndRender as setAndRenderDiary } from '../daily_view/diary.js';

// 모듈 스코프 변수
let localDataManager;
let localEventBus;
let currentLoadedDate; // YYYY-MM-DD
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = []; // 현재 월의 색상 팔레트
let elapsedTimeIntervalId = null;

const activeEventListeners = [];
let activeColorOptionContextMenu = null; // 색상 옵션 삭제 컨텍스트 메뉴 DOM 요소

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
        projectTodos: typeof getProjectTodoData === 'function' ? getProjectTodoData() : [],
        todos: typeof getTodoData === 'function' ? getTodoData() : [],
        // routines는 아래에서 월별 데이터로 처리
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
function setAllModuleData(daySpecificData = {}, monthSharedData = {}) {
    if (typeof setAndRenderProjectTodos === 'function') setAndRenderProjectTodos(daySpecificData.projectTodos || []);
    if (typeof setAndRenderTodos === 'function') setAndRenderTodos(daySpecificData.todos || []);
    if (typeof setAndRenderRoutines === 'function') setAndRenderRoutines(monthSharedData.routines || []); // 월별 루틴 사용
    if (typeof setTimelineBlockDataAndRender === 'function') setTimelineBlockDataAndRender(daySpecificData.timeBlocks || {}, 'timeGridDOM');
    if (typeof setTimelineGoalDataAndRender === 'function') setTimelineGoalDataAndRender(daySpecificData.goalBlocks || {}, 'goalTimeGridDOM');
    if (typeof setScheduledTasksDataAndRender === 'function') setScheduledTasksDataAndRender(daySpecificData.scheduledTimelineTasks || []);
    if (typeof setAndRenderDiary === 'function') setAndRenderDiary(daySpecificData.diary || {});
}

// function updateElapsedTimeBlocksInternal() { /* ... */ }

// --- Daily View 초기화 함수 ---
export async function initDailyDetailView(data, bus, params, query) {
    console.log(`[DailyViewHandler] Daily View 초기화 시작 for date: ${params.date}`);
    localDataManager = data;
    localEventBus = bus;
    currentLoadedDate = params.date;
    activeEventListeners.length = 0; 
    removeColorOptionContextMenu(); 

    displayCurrentDate(currentLoadedDate);

    const yearMonth = currentLoadedDate.substring(0, 7);
    const settings = localDataManager.getSettings();
    // dataManager로부터 해당 월의 전체 데이터 객체를 가져옴
    const monthDataObject = localDataManager.getRawDailyDataForMonth(yearMonth) || 
                          { 
                              yearMonth, 
                              routines: [], // 기본 빈 루틴 배열
                              colorPalette: settings?.colorPalette || [], // 설정 우선, 없으면 빈 배열
                              dailyData: {} 
                          };

    // 색상 팔레트 설정 (현재 월 데이터 우선, 없으면 전역 설정, 그것도 없으면 빈 배열)
    savedColors = monthDataObject.colorPalette && monthDataObject.colorPalette.length > 0 
                  ? [...monthDataObject.colorPalette] 
                  : (settings?.colorPalette && settings.colorPalette.length > 0 ? [...settings.colorPalette] : []);
    initializeColorPicker();

    const dataForThisDate = monthDataObject.dailyData?.[currentLoadedDate] || {};
    setAllModuleData(dataForThisDate, monthDataObject); // 날짜별 데이터와 월별 공유 데이터(루틴, 팔레트 포함) 전달

    // 각 하위 모듈 초기화
    if (typeof initProjectTodoApp === 'function') initProjectTodoApp('#project-todo-app-container', dataForThisDate.projectTodos || [], handleDataChange);
    if (typeof initTodoApp === 'function') initTodoApp('#todo-app-container', dataForThisDate.todos || [], handleDataChange);
    if (typeof initRoutinesApp === 'function') initRoutinesApp('#routines-app-container', monthDataObject.routines || [], handleDataChange); // 월별 루틴 전달
    if (typeof initDiaryApp === 'function') initDiaryApp('#diary-app-container', dataForThisDate.diary || {}, handleDataChange);
    
    const timelineCallbacks = {
        getSelectedColor: () => selectedColor,
        onTimeGridDataChange: () => {
            handleDataChange();
        }
    };
    if (typeof initTimelines === 'function') initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    
    if (typeof initYearProgress === 'function') initYearProgress('#year-progress-header-container');
    if (typeof initDayProgress === 'function') initDayProgress('#day-progress-bar-host');

    // 이벤트 리스너 (색상 선택기 팝업 외부 클릭)
    // 이 리스너는 한번만 등록되어야 하며, cleanup 시 제거되어야 함.
    const existingDocClickListener = activeEventListeners.find(l => l.target === document && l.type === 'click' && l.handler === outsideColorPopupClickHandler);
    if (!existingDocClickListener) {
        document.addEventListener('click', outsideColorPopupClickHandler);
        activeEventListeners.push({ target: document, type: 'click', handler: outsideColorPopupClickHandler });
    }
    
    // elapsedTimeIntervalId = setInterval(updateElapsedTimeBlocksInternal, 60000);

    console.log('[DailyViewHandler] Daily View 초기화 완료');
}

// --- Daily View 정리 함수 ---
export function cleanupDailyDetailView() {
    console.log('[DailyViewHandler] Daily View 정리 시작');

    if (elapsedTimeIntervalId) {
        clearInterval(elapsedTimeIntervalId);
        elapsedTimeIntervalId = null;
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