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
export async function initDailyDetailView(dataModule, busModule, params, query) {
    console.log(`[DailyViewHandler] Daily View 초기화 시작 for date: ${params.date}`);
    localDataManager = dataModule;
    localEventBus = busModule;
    currentLoadedDate = params.date;
    activeEventListeners.length = 0;
    removeColorOptionContextMenu();

    if (liveTimelineUpdateIntervalId) {
        clearInterval(liveTimelineUpdateIntervalId);
        liveTimelineUpdateIntervalId = null;
    }

    displayCurrentDate(currentLoadedDate);

    const yearMonth = currentLoadedDate.substring(0, 7);
    const settings = localDataManager.getSettings();
    const monthDataObject = localDataManager.getRawDailyDataForMonth(yearMonth) ||
                          {
                              yearMonth,
                              routines: [],
                              colorPalette: settings?.colorPalette || [],
                              dailyData: {}
                          };

    savedColors = monthDataObject.colorPalette && monthDataObject.colorPalette.length > 0
                ? [...monthDataObject.colorPalette]
                : (settings?.colorPalette && settings.colorPalette.length > 0 ? [...settings.colorPalette] : []);
    initializeColorPicker();

    const dataForThisDate = monthDataObject.dailyData?.[currentLoadedDate] || {};
    setAllModuleData(dataForThisDate, monthDataObject);

    if (typeof initProjectTodoApp === 'function') initProjectTodoApp('#project-todo-app-container', dataForThisDate.projectTodos || [], handleDataChange);
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
                    }
                    return false;
                }
                const [r, g, b] = [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
                return (r * 299 + g * 587 + b * 114) / 1000 < 128;
            },
            normalizeColor: (color) => {
                return color;
            },
            onTimeGridDataChange: () => {
                handleDataChange();
            }
        };
        const timeGridDomId = 'timeGridDOM';
        const goalGridDomId = 'goalTimeGridDOM';

        initTimelines(timeGridDomId, goalGridDomId, timelineCallbacks);

        if (typeof updatePassedTimeVisuals === 'function') {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const isCurrentViewToday = (currentLoadedDate === todayStr);

            const runLiveUpdates = () => {
                updatePassedTimeVisuals(timeGridDomId, isCurrentViewToday);
                updatePassedTimeVisuals(goalGridDomId, isCurrentViewToday);
            };
            runLiveUpdates();
            if (isCurrentViewToday) {
                if (liveTimelineUpdateIntervalId) clearInterval(liveTimelineUpdateIntervalId);
                liveTimelineUpdateIntervalId = setInterval(runLiveUpdates, 60000);
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

    // ▼▼▼ Cmd+S 핸들러 및 관련 함수 정의 (수정된 부분) ▼▼▼
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
        // dataManager.js에 getSpecificYearDataForSave(year) 함수가 있다고 가정하고 호출
        // 이 함수가 없다면, localDataManager.getCurrentYearDataForSave()를 호출하되,
        // 이 함수가 yearOfDailyView 기준으로 데이터를 반환하도록 dataManager 내부 로직이 보장해야 함.
        if (typeof localDataManager.getSpecificYearDataForSave === 'function') {
            filesToSave = localDataManager.getSpecificYearDataForSave(yearOfDailyView);
        } else if (typeof localDataManager.getCurrentYearDataForSave === 'function') {
            // getSpecificYearDataForSave가 없다면, getCurrentYearDataForSave를 사용.
            // 이 경우, getCurrentYearDataForSave가 Daily View의 현재 연도를 올바르게 인지하고
            // 데이터를 반환한다고 가정해야 함. (예: dataManager 내부의 currentDisplayYear 상태가
            // Daily View의 연도로 이미 설정되어 있는 경우)
            // 이상적으로는 이전에 설명드린 것처럼 dataManager의 currentDisplayYear를 임시 변경/복원하거나,
            // getCurrentYearDataForSave가 yearOfDailyView를 인지하도록 수정하는 것이 좋음.
            console.warn("[DailyViewHandler] getSpecificYearDataForSave not found. Falling back to getCurrentYearDataForSave. Ensure it uses the correct year context for Daily View.");
            filesToSave = localDataManager.getCurrentYearDataForSave();
        } else {
            console.error("Data saving function (getSpecificYearDataForSave or getCurrentYearDataForSave) is not available on localDataManager.");
            alert("연도별 전체 저장 기능을 사용할 수 없습니다.");
            return;
        }

        if (!filesToSave || filesToSave.length === 0) {
             alert(`${yearOfDailyView}년에 저장할 데이터가 없습니다.`); return;
        }

        const zip = new JSZip();
        // ZIP 파일 내에 최상위 폴더로 연도를 사용합니다. (mainViewHandler.js의 handleSaveCurrentYear와 동일한 구조)
        const yearFolder = zip.folder(String(yearOfDailyView)); 

        filesToSave.forEach(fileInfo => {
            // fileInfo.filenameInZip은 "YYYY/YYYY.json" 또는 "YYYY/YYYY-MM.json" 형태일 것으로 예상.
            // 여기서 연도 폴더는 이미 만들었으므로, 실제 파일명(YYYY.json 또는 YYYY-MM.json)만 필요.
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
            
            if (typeof localDataManager.clearAllDirtyFilesForYear === 'function') {
                localDataManager.clearAllDirtyFilesForYear(yearOfDailyView);
                console.log(`[DailyViewHandler] Data for year ${yearOfDailyView} saved and dirty flags for this year cleared.`);
            } else {
                console.warn(`[DailyViewHandler] clearAllDirtyFilesForYear method not found. Dirty flags for year ${yearOfDailyView} may not be cleared.`);
            }
        } catch (e) {
            console.error(`Error generating ZIP for year ${yearOfDailyView}:`, e);
            alert(`${yearOfDailyView}년 데이터 백업 파일 생성 중 오류가 발생했습니다.`);
        }
    }

    const dailyViewKeydownHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            console.log('[DailyViewHandler] Ctrl+S pressed, initiating save for current daily view year.');
            handleSaveDataForCurrentDailyViewYear(); // 수정된 저장 함수 호출
        }
    };
    document.addEventListener('keydown', dailyViewKeydownHandler);
    activeEventListeners.push({ target: document, type: 'keydown', handler: dailyViewKeydownHandler });
    // ▲▲▲ Cmd+S 핸들러 및 관련 함수 정의 끝 ▲▲▲

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