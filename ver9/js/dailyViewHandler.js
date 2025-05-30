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

let localDataManager;
let localEventBus;
let currentLoadedDate;
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = [];
let elapsedTimeIntervalId = null;

const activeEventListeners = [];
let activeColorOptionContextMenu = null;

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
    window.removeEventListener('click', handleOutsideColorOptionContextMenuClick, true);
}

function handleOutsideColorOptionContextMenuClick(event) {
    // activeColorOptionContextMenu가 존재하고, 클릭된 대상이 메뉴 자신이 아니고, 메뉴의 자식 요소도 아닐 때 메뉴를 닫음.
    if (activeColorOptionContextMenu && 
        activeColorOptionContextMenu !== event.target && 
        !activeColorOptionContextMenu.contains(event.target)) {
        removeColorOptionContextMenu();
    }
}

function showColorOptionContextMenu(event, colorData, colorOptionElement) {
    event.preventDefault();
    event.stopPropagation(); // 다른 클릭 이벤트 방지
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
        e.stopPropagation(); // 이벤트 버블링 중단
        savedColors = savedColors.filter(c => c.color.toLowerCase() !== colorData.color.toLowerCase());
        
        // initializeColorPicker() 전체를 다시 호출하기보다는, 옵션 부분만 갱신
        renderColorOptionsUI(); 
        handleDataChange();      
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
    const addColorBtn = document.getElementById('addColorBtn'); // 이 버튼은 항상 존재한다고 가정
    if (!colorPicker || !addColorBtn) return;

    const existingOptions = colorPicker.querySelectorAll('.dv-color-option');
    existingOptions.forEach(opt => opt.remove()); // 기존 옵션들만 제거

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
    renderColorOptionsUI(); // 색상 옵션 UI 렌더링 함수 호출

    // '+ Add Color' 버튼 이벤트 리스너 (중복 방지)
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
        addColorBtn.dataset.listenerAttached = 'true';
        activeEventListeners.push({ element: addColorBtn, type: 'click', handler: toggleColorPopupHandler });
    }

    // 'Save Color' 버튼 (팝업 내부) 이벤트 리스너 (중복 방지)
    const saveColorBtn = document.getElementById('saveColorBtn');
    const colorInput = document.getElementById('colorInput');
    const colorLabelInput = document.getElementById('colorLabel');

    if (saveColorBtn && colorInput && colorLabelInput && !saveColorBtn.dataset.listenerAttached) {
        const handleSaveNewColorAction = () => {
            if (!localDataManager) return;
            
            const newSelectedColor = colorInput.value;
            const newLabel = colorLabelInput.value.trim() || newSelectedColor;

            if (!savedColors.some(c => c.color.toLowerCase() === newSelectedColor.toLowerCase())) {
                savedColors.push({ color: newSelectedColor, label: newLabel });
                renderColorOptionsUI(); // 옵션 UI만 다시 그림
                
                const yearMonth = currentLoadedDate.substring(0, 7);
                const monthData = JSON.parse(JSON.stringify(localDataManager.getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {}, colorPalette: [] }));
                monthData.colorPalette = [...savedColors];
                localDataManager.updateDailyData(yearMonth, monthData);
            }
            document.getElementById('colorPickerPopup')?.classList.remove('dv-show');
        };

        saveColorBtn.addEventListener('click', handleSaveNewColorAction);
        saveColorBtn.dataset.listenerAttached = 'true';
        activeEventListeners.push({ element: saveColorBtn, type: 'click', handler: handleSaveNewColorAction });

        // 라벨 입력 필드 Enter 키 핸들러
        if (!colorLabelInput.dataset.keydownListenerAttached) {
            const colorLabelKeydownHandler = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveNewColorAction();
                }
            };
            colorLabelInput.addEventListener('keydown', colorLabelKeydownHandler);
            colorLabelInput.dataset.keydownListenerAttached = 'true';
            activeEventListeners.push({ element: colorLabelInput, type: 'keydown', handler: colorLabelKeydownHandler });
        }
        
        // 색상 입력 필드 Enter 키 핸들러 (선택 사항)
        if (!colorInput.dataset.keydownListenerAttached) {
            const colorInputKeydownHandler = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveNewColorAction();
                }
            };
            colorInput.addEventListener('keydown', colorInputKeydownHandler);
            colorInput.dataset.keydownListenerAttached = 'true';
            activeEventListeners.push({ element: colorInput, type: 'keydown', handler: colorInputKeydownHandler });
        }
    }
}

const outsideColorPopupClickHandler = (e) => {
    const popup = document.getElementById('colorPickerPopup');
    const addColorBtn = document.getElementById('addColorBtn');
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
    const monthData = JSON.parse(JSON.stringify(localDataManager.getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {}, colorPalette: savedColors }));

    const currentDayData = {
        projectTodos: typeof getProjectTodoData === 'function' ? getProjectTodoData() : [],
        todos: typeof getTodoData === 'function' ? getTodoData() : [],
        routines: typeof getRoutinesData === 'function' ? getRoutinesData() : [],
        timeBlocks: typeof getTimelineBlockData === 'function' ? getTimelineBlockData() : {},
        goalBlocks: typeof getTimelineGoalData === 'function' ? getTimelineGoalData() : {},
        scheduledTimelineTasks: typeof getScheduledTasksData === 'function' ? getScheduledTasksData() : [],
        diary: typeof getDiaryData === 'function' ? getDiaryData() : {}
    };
    
    if (!monthData.dailyData) monthData.dailyData = {};
    monthData.dailyData[currentLoadedDate] = currentDayData;
    
    monthData.colorPalette = [...savedColors];

    localDataManager.updateDailyData(yearMonth, monthData);
    console.log(`[DailyViewHandler] Notified dataManager of changes for ${yearMonth}`);
}

function setAllModuleData(dataBundle = {}) {
    if (typeof setAndRenderProjectTodos === 'function') setAndRenderProjectTodos(dataBundle.projectTodos || []);
    if (typeof setAndRenderTodos === 'function') setAndRenderTodos(dataBundle.todos || []);
    if (typeof setAndRenderRoutines === 'function') setAndRenderRoutines(dataBundle.routines || []);
    if (typeof setTimelineBlockDataAndRender === 'function') setTimelineBlockDataAndRender(dataBundle.timeBlocks || {}, 'timeGridDOM');
    if (typeof setTimelineGoalDataAndRender === 'function') setTimelineGoalDataAndRender(dataBundle.goalBlocks || {}, 'goalTimeGridDOM');
    if (typeof setScheduledTasksDataAndRender === 'function') setScheduledTasksDataAndRender(dataBundle.scheduledTimelineTasks || []);
    if (typeof setAndRenderDiary === 'function') setAndRenderDiary(dataBundle.diary || {});
}

// function updateElapsedTimeBlocksInternal() { /* ... */ } // 필요시 구현

// --- Daily View 초기화 함수 ---
export async function initDailyDetailView(data, bus, params, query) {
    console.log(`[DailyViewHandler] Daily View 초기화 시작 for date: ${params.date}`);
    localDataManager = data;
    localEventBus = bus;
    currentLoadedDate = params.date;
    activeEventListeners.length = 0; // 핸들러 초기화 시 리스너 배열 초기화
    removeColorOptionContextMenu(); // 혹시 남아있을 컨텍스트 메뉴 제거

    displayCurrentDate(currentLoadedDate);

    const yearMonth = currentLoadedDate.substring(0, 7);
    const settings = localDataManager.getSettings();
    const monthDataFromFile = localDataManager.getRawDailyDataForMonth(yearMonth);

    savedColors = monthDataFromFile?.colorPalette || settings?.colorPalette || [];
    initializeColorPicker();

    const dataForThisDate = monthDataFromFile?.dailyData?.[currentLoadedDate] || {};
    setAllModuleData(dataForThisDate);

    if (typeof initProjectTodoApp === 'function') initProjectTodoApp('#project-todo-app-container', dataForThisDate.projectTodos || [], handleDataChange);
    if (typeof initTodoApp === 'function') initTodoApp('#todo-app-container', dataForThisDate.todos || [], handleDataChange);
    if (typeof initRoutinesApp === 'function') initRoutinesApp('#routines-app-container', dataForThisDate.routines || [], handleDataChange);
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

    // document 클릭 리스너는 색상 추가 팝업과 컨텍스트 메뉴 둘 다에 영향을 줄 수 있으므로 주의해서 관리
    // outsideColorPopupClickHandler는 그대로 두고, 
    // handleOutsideColorOptionContextMenuClick는 showColorOptionContextMenu 내부에서 window에 동적으로 등록/해제합니다.
    document.addEventListener('click', outsideColorPopupClickHandler);
    activeEventListeners.push({ target: document, type: 'click', handler: outsideColorPopupClickHandler });

    console.log('[DailyViewHandler] Daily View 초기화 완료');
}

// --- Daily View 정리 함수 ---
export function cleanupDailyDetailView() {
    console.log('[DailyViewHandler] Daily View 정리 시작');

    if (elapsedTimeIntervalId) {
        clearInterval(elapsedTimeIntervalId);
        elapsedTimeIntervalId = null;
    }

    removeColorOptionContextMenu(); // 명시적으로 컨텍스트 메뉴 및 관련 리스너 제거

    activeEventListeners.forEach(listener => {
        const target = listener.target || listener.element;
        if (target) {
            // dataset 플래그를 사용한 버튼들은 여기서 리스너 제거할 필요 없음 (cloneNode로 교체되었거나, 다음 init에서 재할당됨)
            // 단, document나 window에 직접 등록한 리스너 중 dataset 플래그로 관리 안되는 것은 여기서 제거해야 함.
            if (listener.target === document && listener.type === 'click' && listener.handler === outsideColorPopupClickHandler) {
                 target.removeEventListener(listener.type, listener.handler);
            }
            // addColorBtn, saveColorBtn, colorLabelInput, colorInput에 dataset 플래그로 추가된 리스너들은
            // 버튼/입력 필드가 DOM에서 사라지지 않는 한 유지되거나, initializeColorPicker에서 관리됨.
            // 여기서는 document에 직접 붙인 것만 명시적으로 제거 (예시)
        }
    });
    activeEventListeners.length = 0;

    currentLoadedDate = null;
    localDataManager = null;
    localEventBus = null;
    savedColors = [];
    selectedColor = 'rgb(255, 255, 255)';

    console.log('[DailyViewHandler] Daily View 정리 완료');
}