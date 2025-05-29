// js/dailyViewHandler.js

// dataManager와 eventBus는 initDailyDetailView 함수의 인자로 전달받습니다.
// Daily View 페이지에서 사용되는 각 기능 모듈들을 import 합니다.
// 경로 주의: dailyViewHandler.js가 js/ 폴더에 있고, 나머지 daily_view 관련 파일들이 daily_view/ 폴더에 있다면 경로 수정이 필요합니다.
// 여기서는 dailyViewHandler.js도 daily_view/ 폴더에 함께 위치하거나,
// 또는 daily_view 하위 모듈들이 js/daily_view/ 와 같은 경로로 이동했다고 가정하고 상대 경로를 사용합니다.
// 실제 프로젝트 구조에 맞게 경로를 조정해주세요.

// 예시: dailyViewHandler.js가 js/ 폴더에 있고, daily_view 모듈들이 daily_view/ 폴더에 있는 경우
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
    // clearAllPreviousColorMarkers, // 이 함수는 updateTimeSummary 내부에서 호출되므로 직접 export/import 불필요할 수 있음
    getScheduledTasksData,
    setScheduledTasksDataAndRender
} from '../daily_view/timelines.js';
import { initDiaryApp, getDiaryData, setDiaryDataAndRender as setAndRenderDiary } from '../daily_view/diary.js';
// import * as dirtyFileService from './dirtyFileService.js'; // dataManager를 통해 처리되므로 직접 필요 없을 수 있음

// 모듈 스코프 변수 (기존 daily_view/main.js의 전역 변수 역할)
let localDataManager; // dataManager 인스턴스 저장용
let localEventBus;    // eventBus 인스턴스 저장용
let currentLoadedDate; // 현재 Daily View에 로드된 날짜 (YYYY-MM-DD)
let selectedColor = 'rgb(255, 255, 255)'; // 타임라인 기본 선택 색상
let savedColors = []; // 색상 팔레트
let elapsedTimeIntervalId = null; // updateElapsedTimeBlocks 인터벌 ID 저장용

// 추가된 이벤트 리스너들을 추적하기 위한 배열
const activeEventListeners = [];

// --- Helper Functions (기존 daily_view/main.js에서 가져오거나 수정) ---

function displayCurrentDate(dateStr) {
    // Daily View 템플릿이 로드된 후 해당 ID를 가진 요소를 찾습니다.
    // CSS 접두사가 적용된 ID일 수 있으므로 확인 필요 (예: #dv-current-date-display)
    const dateDisplay = document.getElementById('current-date-display'); 
    if (dateDisplay && dateStr) {
        const [year, month, day] = dateStr.split('-');
        dateDisplay.textContent = `${year} / ${month} / ${day}`;
    } else if (dateDisplay) { // fallback (실제로는 dateStr이 항상 있어야 함)
        const now = new Date();
        dateDisplay.textContent = `${now.getFullYear()} / ${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`;
    }
}

function initializeColorPicker() {
    const colorPicker = document.getElementById('colorPicker');
    const addColorBtn = document.getElementById('addColorBtn');
    if (!colorPicker || !addColorBtn) return;

    // 기존 옵션 제거 (이벤트 리스너도 함께 제거되도록 주의)
    const existingOptions = colorPicker.querySelectorAll('.dv-color-option'); // CSS 접두사 사용 가정
    existingOptions.forEach(opt => opt.remove());

    // 새로운 옵션 추가 (savedColors 기반)
    savedColors.forEach(({ color, label }) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'dv-color-option'; // CSS 접두사 사용 가정
        colorOption.style.backgroundColor = color;
        colorOption.dataset.label = label;
        
        const colorOptionClickHandler = (e) => {
            e.stopPropagation();
            selectedColor = color;
            if (typeof applySelectedColorToCurrentlyEditingCell === 'function') {
                applySelectedColorToCurrentlyEditingCell(); // timelines.js의 함수
            }
        };
        colorOption.addEventListener('click', colorOptionClickHandler);
        activeEventListeners.push({ element: colorOption, type: 'click', handler: colorOptionClickHandler });
        colorPicker.insertBefore(colorOption, addColorBtn);
    });

    // Add 버튼 이벤트 리스너 (중복 방지 위해 기존 것 제거 후 새로 추가)
    const newAddColorBtn = addColorBtn.cloneNode(true);
    addColorBtn.parentNode.replaceChild(newAddColorBtn, addColorBtn);
    const toggleColorPopupHandler = (e) => { // 익명 함수 대신 이름 있는 함수로
        e.stopPropagation();
        document.getElementById('colorPickerPopup')?.classList.toggle('dv-show'); // CSS 접두사 사용 가정
        const colorLabelInput = document.getElementById('colorLabel');
        if (colorLabelInput) colorLabelInput.value = '';
    };
    newAddColorBtn.addEventListener('click', toggleColorPopupHandler);
    activeEventListeners.push({ element: newAddColorBtn, type: 'click', handler: toggleColorPopupHandler });


    const saveColorBtn = document.getElementById('saveColorBtn');
    if (saveColorBtn) {
        const newSaveColorBtn = saveColorBtn.cloneNode(true);
        saveColorBtn.parentNode.replaceChild(newSaveColorBtn, saveColorBtn);
        const handleSaveNewColorOptionHandler = () => { // 익명 함수 대신 이름 있는 함수로
            if (!localDataManager) return;
            const colorInput = document.getElementById('colorInput');
            const colorLabelInput = document.getElementById('colorLabel'); // 변수명 변경
            const newColor = colorInput.value;
            const newLabel = colorLabelInput.value.trim() || newColor;

            if (!savedColors.some(c => c.color.toLowerCase() === newColor.toLowerCase())) {
                savedColors.push({ color: newColor, label: newLabel });
                initializeColorPicker(); // 재귀 호출이 아닌, 팔레트 UI만 업데이트
                
                // 월별 데이터에 팔레트 저장
                const yearMonth = currentLoadedDate.substring(0, 7);
                // 직접 dataManager의 state를 수정하지 않고, get/update 메서드 사용
                const monthData = JSON.parse(JSON.stringify(localDataManager.getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} }));
                monthData.colorPalette = [...savedColors]; // 복사본 저장
                localDataManager.updateDailyData(yearMonth, monthData);
            }
            document.getElementById('colorPickerPopup')?.classList.remove('dv-show');
            // handleDataChange(); // updateDailyData가 dataChanged 이벤트를 발생시키므로 중복 호출 방지
        };
        newSaveColorBtn.addEventListener('click', handleSaveNewColorOptionHandler);
        activeEventListeners.push({ element: newSaveColorBtn, type: 'click', handler: handleSaveNewColorOptionHandler });
    }
}

// Color Picker Popup 외부 클릭 시 닫기 핸들러
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


// 데이터 변경 시 호출될 콜백 함수 (각 모듈에서 데이터 변경 시 이 함수 호출)
function handleDataChange() {
    if (!localDataManager || !currentLoadedDate) {
        console.warn("[DailyViewHandler] handleDataChange aborted: dataManager or currentLoadedDate missing.");
        return;
    }
    const yearMonth = currentLoadedDate.substring(0, 7);
    // 기존 월 데이터 가져오기 (없으면 기본 구조 생성)
    const monthData = JSON.parse(JSON.stringify(localDataManager.getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {}, colorPalette: savedColors }));

    // 현재 Daily View의 모든 모듈에서 최신 데이터 수집
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
    
    // 현재 Daily View에서 사용 중인 색상 팔레트(savedColors)를 월별 데이터에 반영
    monthData.colorPalette = [...savedColors]; // 복사본 저장

    localDataManager.updateDailyData(yearMonth, monthData);
    console.log(`[DailyViewHandler] Notified dataManager of changes for ${yearMonth}`);
}

function setAllModuleData(dataBundle = {}) {
    // 각 모듈의 set...AndRender 함수 호출
    if (typeof setAndRenderProjectTodos === 'function') setAndRenderProjectTodos(dataBundle.projectTodos || []);
    if (typeof setAndRenderTodos === 'function') setAndRenderTodos(dataBundle.todos || []);
    if (typeof setAndRenderRoutines === 'function') setAndRenderRoutines(dataBundle.routines || []);
    if (typeof setTimelineBlockDataAndRender === 'function') setTimelineBlockDataAndRender(dataBundle.timeBlocks || {}, 'timeGridDOM');
    if (typeof setTimelineGoalDataAndRender === 'function') setTimelineGoalDataAndRender(dataBundle.goalBlocks || {}, 'goalTimeGridDOM');
    if (typeof setScheduledTasksDataAndRender === 'function') setScheduledTasksDataAndRender(dataBundle.scheduledTimelineTasks || []);
    if (typeof setAndRenderDiary === 'function') setAndRenderDiary(dataBundle.diary || {});
}

function updateElapsedTimeBlocksInternal() {
    // 기존 daily_view/main.js의 updateElapsedTimeBlocks 로직
    // currentLoadedDate, isDarkColor, normalizeColor 등의 함수 접근 방식 확인 필요
    // isDarkColor, normalizeColor 등 유틸리티 함수는 이 파일 내에 있거나 import 필요
}

// --- Daily View 초기화 함수 ---
export async function initDailyDetailView(data, bus, params, query) {
    console.log(`[DailyViewHandler] Daily View 초기화 시작 for date: ${params.date}`);
    localDataManager = data; // dataManager 인스턴스 저장
    localEventBus = bus;     // eventBus 인스턴스 저장
    currentLoadedDate = params.date; // URL에서 전달받은 날짜

    // 1. Daily View 템플릿이 로드된 후 DOM 요소 참조 및 기본 UI 설정
    displayCurrentDate(currentLoadedDate);
    // addStripedStyle(); // 필요한 경우 스타일 동적 추가 (또는 CSS 파일에 미리 정의)
    // addCurrentTimeRedLineStyle();

    // 2. 데이터 로드 및 UI 초기화
    const yearMonth = currentLoadedDate.substring(0, 7);
    const settings = localDataManager.getSettings();
    const monthDataFromFile = localDataManager.getRawDailyDataForMonth(yearMonth);

    // 색상 팔레트 설정 (월별 > 전역 > 기본 빈 배열)
    savedColors = monthDataFromFile?.colorPalette || settings?.colorPalette || [];
    initializeColorPicker();

    const dataForThisDate = monthDataFromFile?.dailyData?.[currentLoadedDate] || {};
    setAllModuleData(dataForThisDate); // 각 모듈에 데이터 주입 및 렌더링

    // 3. 각 하위 모듈 초기화 (콜백으로 handleDataChange 전달)
    //    DOM 요소 ID는 Daily View 템플릿에 정의된 것을 사용 (필요시 CSS 접두사 반영)
    if (typeof initProjectTodoApp === 'function') initProjectTodoApp('#project-todo-app-container', dataForThisDate.projectTodos || [], handleDataChange);
    if (typeof initTodoApp === 'function') initTodoApp('#todo-app-container', dataForThisDate.todos || [], handleDataChange);
    if (typeof initRoutinesApp === 'function') initRoutinesApp('#routines-app-container', dataForThisDate.routines || [], handleDataChange);
    if (typeof initDiaryApp === 'function') initDiaryApp('#diary-app-container', dataForThisDate.diary || {}, handleDataChange);
    
    const timelineCallbacks = {
        getSelectedColor: () => selectedColor,
        // isDarkColor, normalizeColor 콜백은 이 파일 내에 정의하거나 timelines.js에서 자체적으로 처리
        onTimeGridDataChange: () => {
            // if (typeof updateTimeSummary === 'function') updateTimeSummary(); // 필요시 타임라인 요약 업데이트
            handleDataChange(); // 중앙 데이터 변경 핸들러 호출
        }
    };
    if (typeof initTimelines === 'function') initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    
    if (typeof initYearProgress === 'function') initYearProgress('#year-progress-header-container');
    if (typeof initDayProgress === 'function') initDayProgress('#day-progress-bar-host');


    // 4. 이벤트 리스너 (예: 색상 선택기 팝업 외부 클릭)
    document.addEventListener('click', outsideColorPopupClickHandler);
    activeEventListeners.push({ target: document, type: 'click', handler: outsideColorPopupClickHandler });

    // 5. 주기적 업데이트 (예: 경과 시간 표시)
    // updateElapsedTimeBlocksInternal(); // 초기 호출
    // elapsedTimeIntervalId = setInterval(updateElapsedTimeBlocksInternal, 60000);

    console.log('[DailyViewHandler] Daily View 초기화 완료');
}

// --- Daily View 정리 함수 ---
export function cleanupDailyDetailView() {
    console.log('[DailyViewHandler] Daily View 정리 시작');

    // 1. 인터벌 해제
    if (elapsedTimeIntervalId) {
        clearInterval(elapsedTimeIntervalId);
        elapsedTimeIntervalId = null;
    }

    // 2. 추가된 모든 이벤트 리스너 제거
    activeEventListeners.forEach(listener => {
        if (listener.target) { // document, window 등
            listener.target.removeEventListener(listener.type, listener.handler);
        } else if (listener.element) { // 특정 DOM 요소
            listener.element.removeEventListener(listener.type, listener.handler);
        }
    });
    activeEventListeners.length = 0; // 배열 비우기

    // 3. 각 하위 모듈에 cleanup 함수가 있다면 호출 (선택적)
    // 예: if (typeof cleanupTodoApp === 'function') cleanupTodoApp();
    //     if (typeof cleanupTimelines === 'function') cleanupTimelines();

    // 4. 모듈 스코프 변수 초기화 (필요시)
    currentLoadedDate = null;
    localDataManager = null;
    localEventBus = null;
    savedColors = [];
    selectedColor = 'rgb(255, 255, 255)';

    console.log('[DailyViewHandler] Daily View 정리 완료');
}