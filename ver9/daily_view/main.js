import * as dirtyFileService from '../js/dirtyFileService.js'; // 경로 주의!

// Import initializers
import { initYearProgress } from './yearProgress.js';
import { initDayProgress } from './dayProgress.js';
import {
    initProjectTodoApp,
    getProjectTodoData,
    setProjectTodoDataAndRender as setAndRenderProjectTodos
} from './projectTodos.js';
import { initTodoApp, getTodoData, setTodoDataAndRender as setAndRenderTodos } from './todo.js';
import { initRoutinesApp, getRoutinesData, setRoutinesDataAndRender as setAndRenderRoutines } from './routines.js';
import {
    initTimelines,
    getTimelineBlockData,
    getTimelineGoalData,
    setTimelineBlockDataAndRender,
    setTimelineGoalDataAndRender,
    applySelectedColorToCurrentlyEditingCell,
    clearAllPreviousColorMarkers,
    getScheduledTasksData,
    setScheduledTasksDataAndRender
} from './timelines.js';
import { initDiaryApp, getDiaryData, setDiaryDataAndRender as setAndRenderDiary } from './diary.js';

let module_parentDataManager = null; // 이름 변경으로 스코프 혼동 방지 시도
let module_currentLoadedDate = null;

let parentDataManager = null;
let currentLoadedDate = null;
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = [];


/////////////////////////////////////////////////////////////////
// UI
/////////////////////////////////////////////////////////////////

// --- Date Display ---
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

// --- Color Picker Logic ---
function initializeColorPicker() {
    const colorPicker = document.getElementById('colorPicker');
    const addColorBtn = document.getElementById('addColorBtn');
    if (!colorPicker || !addColorBtn) return;
    const existingOptions = colorPicker.querySelectorAll('.color-option');
    existingOptions.forEach(opt => opt.remove());
    savedColors.forEach(({ color, label }) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.dataset.label = label;
        colorOption.addEventListener('click', (e) => {
            e.stopPropagation(); selectedColor = color; applySelectedColorToCurrentlyEditingCell();
        });
        colorPicker.insertBefore(colorOption, addColorBtn);
    });
    const newAddColorBtn = addColorBtn.cloneNode(true);
    addColorBtn.parentNode.replaceChild(newAddColorBtn, addColorBtn);
    newAddColorBtn.addEventListener('click', toggleColorPopup);
    const saveColorBtn = document.getElementById('saveColorBtn');
    if (saveColorBtn) {
        const newSaveColorBtn = saveColorBtn.cloneNode(true);
        saveColorBtn.parentNode.replaceChild(newSaveColorBtn, saveColorBtn);
        newSaveColorBtn.addEventListener('click', handleSaveNewColorOption);
    }
}
function toggleColorPopup(e) { e.stopPropagation(); document.getElementById('colorPickerPopup').classList.toggle('show'); const ci = document.getElementById('colorLabel'); if(ci) ci.value = ''; }

function handleSaveNewColorOption() {
    // [수정] 색상 팔레트 변경 시 처리
    const dataManager = getParentDataManager();
    if (!dataManager) return;

    // ... newColor, newLabel 가져오는 로직 ...
    const colorInput = document.getElementById('colorInput'), colorLabel = document.getElementById('colorLabel');
    const newColor = colorInput.value, newLabel = colorLabel.value.trim() || newColor;

    if (!savedColors.some(c => c.color.toLowerCase() === newColor.toLowerCase())) {
        savedColors.push({ color: newColor, label: newLabel });
        initializeColorPicker();
        
        // 현재 월 데이터에 colorPalette override 적용하고 저장
        const yearMonth = currentLoadedDate.substring(0, 7);
        const monthData = dataManager.getRawDailyDataForMonth(yearMonth) || { yearMonth, dailyData: {} };
        const updatedMonthData = JSON.parse(JSON.stringify(monthData));
        updatedMonthData.colorPalette = savedColors; // override 팔레트 설정

        dataManager.updateDailyData(yearMonth, updatedMonthData);
    }
    document.getElementById('colorPickerPopup').classList.remove('show');
    handleDataChange();
}

document.addEventListener('click', (e) => {
    const popup = document.getElementById('colorPickerPopup'), addColorBtn = document.getElementById('addColorBtn');
    if (popup && popup.classList.contains('show') && !popup.contains(e.target) && e.target !== addColorBtn && !addColorBtn.contains(e.target)) {
        popup.classList.remove('show');
    }
});

// --- Elapsed Time & Current Time Styling ---
function addStripedStyle(){const sid='elapsedTimeStyle';if(document.getElementById(sid))return;const s=document.createElement('style');s.id=sid;s.textContent=`.elapsed-time{position:relative;}.elapsed-time::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2;}.elapsed-time.light-bg::after{background-image:linear-gradient(45deg,rgba(0,0,0,0.07) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.07) 50%,rgba(0,0,0,0.07) 75%,transparent 75%);background-size:8px 8px;}.elapsed-time.dark-bg::after{background-image:linear-gradient(45deg,rgba(255,255,255,0.1) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.1) 75%,transparent 75%);background-size:8px 8px;}`;document.head.appendChild(s);}
function addCurrentTimeRedLineStyle(){const sid='currentTimeLineStyle';if(document.getElementById(sid))return;const cs=document.createElement("style");cs.id=sid;cs.textContent=`.current-time-block{position:relative;}.current-time-block::before{content:'';position:absolute;top:-1px;bottom:-1px;left:0;width:3px;background-color:red;z-index:1;}`;document.head.appendChild(cs);}
function updateElapsedTimeBlocks() {
    const now = new Date();
    if (!currentLoadedDate) return;
    const currentLoadedDateObj = new Date(currentLoadedDate + "T00:00:00");
    if (now.getFullYear()!==currentLoadedDateObj.getFullYear()||now.getMonth()!==currentLoadedDateObj.getMonth()||now.getDate()!==currentLoadedDateObj.getDate()){
    ['timeGridDOM','goalTimeGridDOM'].forEach(gridDomId=>{document.querySelectorAll(`#${gridDomId} .grid-cell`).forEach(cell=>{cell.classList.remove('elapsed-time','light-bg','dark-bg','current-time-block');const [ch,cb]=[parseInt(cell.dataset.hour),parseInt(cell.dataset.block)];document.getElementById(`dynamicRedLineStyleFor-${gridDomId}-${ch}-${cb}`)?.remove();});});return;}
    const cH24=now.getHours(),cM=now.getMinutes(),gCH=(cH24-6+24)%24,gCBI=Math.floor(cM/10),tEBS6=(gCH*6)+gCBI;
    ['timeGridDOM','goalTimeGridDOM'].forEach(gridDomId=>{document.querySelectorAll(`#${gridDomId} .grid-cell`).forEach(cell=>{const ch=parseInt(cell.dataset.hour),cb=parseInt(cell.dataset.block),bOI=(ch*6)+cb;cell.classList.remove('elapsed-time','light-bg','dark-bg','current-time-block');const dSI=`dynamicRedLineStyleFor-${gridDomId}-${ch}-${cb}`;let dSE=document.getElementById(dSI);if(dSE)dSE.innerHTML='';if(bOI<tEBS6){cell.classList.add('elapsed-time');cell.classList.toggle('dark-bg',isDarkColor(cell.style.backgroundColor));cell.classList.toggle('light-bg',!isDarkColor(cell.style.backgroundColor));}
    if(ch===gCH&&cb===gCBI){cell.classList.add('current-time-block');const pTB=((cM%10)/10)*100;if(!dSE){dSE=document.createElement('style');dSE.id=dSI;document.head.appendChild(dSE);}dSE.innerHTML=`#${gridDomId} .grid-cell[data-hour="${ch}"][data-block="${cb}"].current-time-block::before { left: ${pTB}%; }`;}});});
}

// --- Time Summary Logic ---
function calculatePreviousRankings(colorTotals,timeChanges){const ptm={};Object.keys(colorTotals).forEach(col=>{const cb=colorTotals[col]||0,cib=timeChanges[col]||0;ptm[col]=(cb-cib)*10;});const pra=savedColors.map(({color,label})=>({color,label,totalMinutes:Math.max(0,ptm[normalizeColor(color)]||0)}));pra.sort((a,b)=>b.totalMinutes-a.totalMinutes);const rm=new Map();pra.forEach((item,idx)=>rm.set(item.color,idx+1));return rm;}
function updateTimeSummary(){const sc=document.getElementById('timeSummary');if(!sc||sc.style.display==='none')return;const bd=getTimelineBlockData();const cTIB={};const cIBSLS={};savedColors.forEach(({color})=>{const nc=normalizeColor(color);cTIB[nc]=0;cIBSLS[nc]=0;});Object.values(bd).forEach(b=>{const c=normalizeColor(b.color);const p=normalizeColor(b.previousColor);if(c&&cTIB.hasOwnProperty(c)){cTIB[c]++;if(p&&p!==c&&cTIB.hasOwnProperty(p)){cIBSLS[c]++;cIBSLS[p]--;}}});const pRM=calculatePreviousRankings(cTIB,cIBSLS);const cDA=savedColors.map(({color,label})=>{const n=normalizeColor(color);const blks=cTIB[n]||0;const t=blks*10;const cim=(cIBSLS[n]||0)*10;return{color,label,totalMinutes:t,hours:Math.floor(t/60),minutes:t%60,change:cim};});cDA.sort((a,b)=>b.totalMinutes-a.totalMinutes);sc.innerHTML='';cDA.forEach((d,i)=>{const r=i+1,pr=pRM.get(d.color),ts=`${String(d.hours).padStart(2,'0')}:${String(d.minutes).padStart(2,'0')}`,cih=formatTimeChange(d.change);let rih='<span class="rank-indicator"></span>';if(pr&&r!==pr)rih=r<pr?'<span class="rank-indicator rank-up">▲</span>':'<span class="rank-indicator rank-down">▼</span>';const si=document.createElement('div');si.className='color-summary-item';si.innerHTML=`<span class="ranking">${r}.</span><div class="color-indicator" style="background-color:${d.color}"></div><span class="label">${d.label}</span>${rih}<div class="time-wrapper"><span class="time-value">${ts}</span><span class="time-change">${cih}</span></div>`;sc.appendChild(si);});clearAllPreviousColorMarkers('timeGrid');}


// --- Save & Load Logic (Phase 4) ---
function getCurrentDateSpecificData() {
    return {
        timeBlocks: getTimelineBlockData(), goalBlocks: getTimelineGoalData(),
        scheduledTimelineTasks: getScheduledTasksData(), todos: getTodoData(),
        projectTodos: getProjectTodoData(), routines: getRoutinesData(), diary: getDiaryData()
    };
}

////////////////////////////////////////
//      Save & Load Logic
////////////////////////////////////////    

/**
 * 부모 창에서 전달받은 dataManager 인스턴스를 반환합니다.
 */
function getParentDataManager() {
    console.log('[DailyView] getParentDataManager CALLED.');
    // 현재 모듈 스코프의 parentDataManager 값 확인
    console.log('[DailyView] Current value of module-scoped parentDataManager in getParentDataManager:', 
                (parentDataManager ? 'Exists' : 'NULL or UNDEFINED'));

    if (parentDataManager) {
        return parentDataManager;
    }
    // 이 시점에 parentDataManager가 null이면 심각한 오류
    console.error("[DailyView] CRITICAL: parentDataManager is null or undefined here! This means initializeDailyViewWithDataManager was not called or failed before this point.");
    document.body.innerHTML = `<h1>Error: Data manager link broken. Cannot load daily view.</h1>`;
    return null; // 또는 오류 throw
}

/**
 * Daily View의 모든 데이터를 수집하여 부모의 dataManager에 업데이트 요청
 */
function handleDataChange() {
    const dm = getParentDataManager();
    if (!dm || !currentLoadedDate) {
        console.warn("[DailyView] handleDataChange aborted: dm or currentLoadedDate missing.");
        return;
    }
    const yearMonth = currentLoadedDate.substring(0, 7);
    const originalMonthData = dm.getRawDailyDataForMonth(yearMonth) || {
        yearMonth: yearMonth,
        dailyData: {}
    };
    const updatedMonthData = JSON.parse(JSON.stringify(originalMonthData));
    const currentDayData = { /* ... 모든 모듈에서 get...Data() 호출하여 수집 ... */
        projectTodos: getProjectTodoData(),
        todos: getTodoData(),
        routines: getRoutinesData(),
        timeBlocks: getTimelineBlockData(),
        goalBlocks: getTimelineGoalData(),
        scheduledTimelineTasks: getScheduledTasksData(),
        diary: getDiaryData()
    };
    updatedMonthData.dailyData[currentLoadedDate] = currentDayData;
    
    updatedMonthData.colorPalette = savedColors;

    dm.updateDailyData(yearMonth, updatedMonthData);
    console.log(`[DailyView] Notified dataManager of changes for ${yearMonth}`);
}

/**
 * [수정] 페이지 시작 시 부모 창의 dataManager로부터 데이터를 로드합니다.
 */
async function loadInitialData() {
    const dm = getParentDataManager();
    if (!dm) return; // getParentDataManager에서 이미 오류 처리

    // const urlParams = new URLSearchParams(window.location.search);
    // currentLoadedDate = urlParams.get('date');

    // if (!currentLoadedDate || !/^\d{4}-\d{2}-\d{2}$/.test(currentLoadedDate)) {
    //     console.error("No valid date provided in URL for daily view.");
    //     document.body.innerHTML = "<h1>Error: Valid date not specified. Please open from the main calendar.</h1>";
    //     return;
    // }

    displayCurrentDate(currentLoadedDate);

    const yearMonth = currentLoadedDate.substring(0, 7);
    const settings = dm.getSettings();
    const monthDataFromFile = dm.getRawDailyDataForMonth(yearMonth);

    // 색상 팔레트: 월별 override가 있으면 그것 사용, 없으면 마스터 팔레트 사용
    savedColors = monthDataFromFile?.colorPalette || settings.colorPalette || [];
    initializeColorPicker(); // savedColors 사용

    const dataForThisDate = monthDataFromFile?.dailyData?.[currentLoadedDate] || {};
    setAllModuleData(dataForThisDate); // 각 모듈 UI 업데이트

    updateElapsedTimeBlocks(); // 기타 UI 업데이트
    // updateTimeSummary(); // 필요 시 호출

    if (typeof updateElapsedTimeBlocks === "function") updateElapsedTimeBlocks();
    console.log(`[DailyView] loadInitialData END for date: ${currentLoadedDate}`);
}

function setupAndLoad() {
    console.log("[DailyView] setupAndLoad called. Initializing modules and loading data.");
    // 모듈 초기화
    initProjectTodoApp('#project-todo-app-container', [], handleDataChange);
    initTodoApp('#todo-app-container', [], handleDataChange);
    initRoutinesApp('#routines-app-container', [], handleDataChange);
    initDiaryApp('#diary-app-container', {}, handleDataChange);

    const timelineCallbacks = { /* ... */ };
    initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    
    initYearProgress('#year-progress-header-container');
    initDayProgress('#day-progress-bar-host');

    // 실제 데이터 로드
    loadInitialData(); // 이 시점에는 parentDataManager와 currentLoadedDate가 반드시 설정되어 있어야 함
    
    setInterval(updateElapsedTimeBlocks, 60000);
}

/**
 * Daily View의 UI 요소들을 설정하고 초기 데이터를 로드합니다.
 * 이 함수는 window.initializeDailyViewWithDataManager 내에서 호출됩니다.
 */
function performSetupAndLoadData() {
    // console.log("[DailyView] performSetupAndLoadData: Attempting to initialize modules...");

    // DOM 요소가 실제로 존재하는지 확인하는 로그 추가
    // console.log("[DailyView] Checking for #project-todo-app-container:", document.querySelector('#project-todo-app-container'));
    // console.log("[DailyView] Checking for #todo-app-container:", document.querySelector('#todo-app-container'));
    // console.log("[DailyView] Checking for #routines-app-container:", document.querySelector('#routines-app-container'));
    // console.log("[DailyView] Checking for #diary-app-container:", document.querySelector('#diary-app-container'));
    // console.log("[DailyView] Checking for timeGridDOM (expected in daily_view/index.html):", document.getElementById('timeGridDOM'));
    // console.log("[DailyView] Checking for goalTimeGridDOM (expected in daily_view/index.html):", document.getElementById('goalTimeGridDOM'));

    // 모듈 초기화
    initProjectTodoApp('#project-todo-app-container', [], handleDataChange);
    initTodoApp('#todo-app-container', [], handleDataChange);
    initRoutinesApp('#routines-app-container', [], handleDataChange);
    initDiaryApp('#diary-app-container', {}, handleDataChange);

    const timelineCallbacks = {
        getSelectedColor: () => selectedColor,
        // isDarkColor: isDarkColorCallback,
        // normalizeColor: normalizeColorCallback,
        onTimeGridDataChange: () => {
            if (typeof updateTimeSummary === "function") updateTimeSummary();
            handleDataChange();
        }
    };
    initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);

    if (typeof initYearProgress === "function") initYearProgress('#year-progress-header-container');
    if (typeof initDayProgress === "function") initDayProgress('#day-progress-bar-host');
    if (typeof addStripedStyle === "function") addStripedStyle(); // 함수 존재 여부 확인
    if (typeof addCurrentTimeRedLineStyle === "function") addCurrentTimeRedLineStyle();


    console.log("[DailyView] Modules initialized. Now calling loadInitialData().");
    // 실제 데이터 로드
    loadInitialData();
    
    if (typeof updateElapsedTimeBlocks === "function") setInterval(updateElapsedTimeBlocks, 60000);
}


/**
 * [유지] 모든 모듈에 데이터를 주입하고 UI를 렌더링하는 함수
 */
function setAllModuleData(dataBundle) {
    setAndRenderProjectTodos(dataBundle.projectTodos || []);
    setAndRenderTodos(dataBundle.todos || []);
    setAndRenderRoutines(dataBundle.routines || []);
    setTimelineBlockDataAndRender(dataBundle.timeBlocks || {}, 'timeGridDOM');
    setTimelineGoalDataAndRender(dataBundle.goalBlocks || {}, 'goalTimeGridDOM');
    setScheduledTasksDataAndRender(dataBundle.scheduledTimelineTasks || []);
    setAndRenderDiary(dataBundle.diary || {});
}


/**
 * 부모 창에서 전달받은 dataManager 인스턴스를 반환합니다.
 */
// function getParentDataManager_debug() { // 함수 이름에 _debug 추가하여 충돌 방지 및 추적 용이
//     console.log('[DailyView DEBUG] getParentDataManager_debug CALLED.');
//     console.log('[DailyView DEBUG] Current value of parentDataManager:', 
//                 (module_parentDataManager ? 'Instance Exists' : 'NULL or UNDEFINED'));
    
//     if (module_parentDataManager) {
//         return module_parentDataManager;
//     }
    
//     console.error("[DailyView DEBUG] CRITICAL in getParentDataManager_debug: module_parentDataManager is null/undefined.");
//     // 화면에 직접 오류 표시
//     const errorDiv = document.createElement('div');
//     errorDiv.innerHTML = `<h1 style="color:red;">[DEBUG] Error: module_parentDataManager not set in getParentDataManager_debug. Check console.</h1>`;
//     if (document.body) {
//       document.body.prepend(errorDiv);
//     } else {
//       // body가 아직 없을 수도 있으므로, DOMContentLoaded 이후에 추가하는 것을 고려
//       document.addEventListener('DOMContentLoaded', () => document.body.prepend(errorDiv));
//     }
//     return null;
// }


// handleDataChange, loadInitialData, setAllModuleData, performSetupAndLoadData 함수들은
// 이제 getParentDataManager_debug() 를 사용하고, module_currentLoadedDate 를 사용하도록 수정합니다.
// 예시:
// async function loadInitialData_debug() {
//     console.log(`[DailyView DEBUG] loadInitialData_debug for date: ${currentLoadedDate}`);
//     const dm = getParentDataManager_debug(); // 수정된 함수 호출
//     if (!dm) {
//         console.error("[DailyView DEBUG] loadInitialData_debug aborted: DataManager (dm) not available.");
//         return;
//     }
//     // ... (나머지 로직은 module_currentLoadedDate와 dm 사용)
// }

// function performSetupAndLoadData_debug() {
//     console.log("[DailyView DEBUG] performSetupAndLoadData_debug CALLED.");
//     // ... (모듈 초기화 로직)
//     // initProjectTodoApp 등은 handleDataChange_debug를 콜백으로 받도록 수정 필요
//     // handleDataChange_debug는 내부에서 getParentDataManager_debug와 module_currentLoadedDate 사용
//     loadInitialData_debug(); // 수정된 함수 호출
//     // ...
// }



////////////////////////////////////////
//      Utility Functions
////////////////////////////////////////
function rgbToHex(rgb){if(!rgb||typeof rgb!=='string')return'#ffffff';const res=rgb.match(/\d+/g);if(!res||res.length<3)return'#ffffff';return`#${res.slice(0,3).map(v=>parseInt(v,10).toString(16).padStart(2,'0')).join('')}`;}
function normalizeColor(color){if(!color||typeof color!=='string')return null;const s=color.toLowerCase().trim();if(s.startsWith('#'))return s.length===4?`#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`:s;if(s.startsWith('rgb'))return rgbToHex(s);return s;}
function isDarkColor(cs){if(!cs)return false;let r,g,b;const h=normalizeColor(cs);if(h&&h.startsWith('#')){const hval=h.replace('#','');if(hval.length===3){r=parseInt(hval[0]+hval[0],16);g=parseInt(hval[1]+hval[1],16);b=parseInt(hval[2]+hval[2],16);}else if(hval.length===6){r=parseInt(hval.substring(0,2),16);g=parseInt(hval.substring(2,4),16);b=parseInt(hval.substring(4,6),16);}else return false;}else return false;return(0.299*r+0.587*g+0.114*b)/255<0.5;}
function formatTimeChange(mins){if(mins===0)return"";const s=mins>0?"+":"-",am=Math.abs(mins);if(am>=60){const h=Math.floor(am/60),rm=am%60;return rm===0?`${s}${h}h`:`${s}${h}h ${rm}m`;}return`${s}${am}m`;}

///////////////////////////////////////////////
//      DOMContentLoaded 이벤트 핸들러 추가
///////////////////////////////////////////////
// document.addEventListener('DOMContentLoaded', () => {
//     // 1. 각 모듈 초기화. 데이터 변경 시 handleDataChange를 호출하도록 콜백 전달
//     initProjectTodoApp('#project-todo-app-container', [], handleDataChange);
//     initTodoApp('#todo-app-container', [], handleDataChange);
//     initRoutinesApp('#routines-app-container', [], handleDataChange);
//     initDiaryApp('#diary-app-container', {}, handleDataChange);

//     const timelineCallbacks = {
//         getSelectedColor: () => selectedColor,
//         // isDarkColor: isDarkColorCallback, // isDarkColorCallback, normalizeColorCallback은 main.js에 정의되어 있어야 함
//         // normalizeColor: normalizeColorCallback,
//         onTimeGridDataChange: () => { // 이 콜백이 Timelines 내부에서 데이터 변경 시 호출됨
//             updateTimeSummary();      // 타임라인 관련 UI 업데이트
//             handleDataChange();       // 중앙 데이터 변경 핸들러 호출
//         }
//     };
//     initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    

//     // 2. 기타 UI 초기화 
//     initYearProgress('#year-progress-header-container');
//     initDayProgress('#day-progress-bar-host');
//     addStripedStyle();
//     addCurrentTimeRedLineStyle();

//     // 3. 데이터 로드 시작 
//     loadInitialData();

//     // 4. 주기적인 업데이트 설정
//     setInterval(updateElapsedTimeBlocks, 60000);
// });

// [핵심!] 부모 창(yearlyCalendar.js)에서 호출할 전역 초기화 함수
window.initializeDailyViewWithDataManager = function(dataManagerFromParent, dateStrFromParent) {
    console.log('[DailyView] === window.initializeDailyViewWithDataManager CALLED BY PARENT ===');
    console.log('[DailyView] Received dataManagerFromParent:', (dataManagerFromParent ? 'Object' : dataManagerFromParent));
    console.log('[DailyView] Received dateStrFromParent:', dateStrFromParent);

    // 모듈 스코프 변수에 명시적으로 할당
    parentDataManager = dataManagerFromParent;
    currentLoadedDate = dateStrFromParent;

    console.log('[DailyView] AFTER ASSIGNMENT - parentDataManager:', (parentDataManager ? 'Assigned Object' : 'Assignment FAILED or dataManagerFromParent was null/undefined'));
    console.log('[DailyView] AFTER ASSIGNMENT - currentLoadedDate:', currentLoadedDate);

    if (parentDataManager && currentLoadedDate) {
        performSetupAndLoadData(); 
        window.isDailyViewInitialized = true; // [추가!] 초기화 완료 플래그 설정
        console.log('[DailyView] isDailyViewInitialized flag SET to true.');
    } else {
        console.error('[DailyView] CRITICAL in initializeDailyViewWithDataManager: Failed to properly set module_parentDataManager or module_currentLoadedDate from parent arguments.');
        // 화면에 직접 오류 표시
        const errorDivInit = document.createElement('div');
        errorDivInit.innerHTML = `<h1 style="color:red;">[DEBUG] Error: Initialization data (DM or Date) from parent is missing. Check console.</h1>`;
        if (document.body) {
          document.body.prepend(errorDivInit);
        } else {
           document.addEventListener('DOMContentLoaded', () => document.body.prepend(errorDivInit));
        }
    }
};

console.log('[DailyView] SCRIPT END: main.js has finished parsing. Waiting for parent call.');


