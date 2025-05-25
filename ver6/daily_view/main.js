// Import initializers
import { initYearProgress } from './yearProgress.js';
import { initDayProgress } from './dayProgress.js';
import { 
    initProjectTodoApp, 
    getProjectTodoData, 
    setProjectTodoDataAndRender as setAndRenderProjectTodos 
} from './projectTodos.js';
import { initTodoApp, getTodoData, setTodoDataAndRender as setAndRenderTodos } from './todo.js'; // Assuming todo.js is in the same directory
import { initRoutinesApp, getRoutinesData, setRoutinesDataAndRender as setAndRenderRoutines } from './routines.js'; 
import {
    initTimelines,
    getTimelineBlockData,
    getTimelineGoalData,
    setTimelineBlockDataAndRender,
    setTimelineGoalDataAndRender,
    applySelectedColorToCurrentlyEditingCell,
    // clearCurrentlyEditingCellFlag, // Timelines.js handles this internally now
    clearAllPreviousColorMarkers,
    getScheduledTasksData,  
    setScheduledTasksDataAndRender
} from './timelines.js'; // Assuming timelines.js is in the same directory
import { initDiaryApp, getDiaryData, setDiaryDataAndRender as setAndRenderDiary } from './diary.js'; // <-- NEW IMPORT


let currentLoadedDate = null;
let allDaysData = {}; 


// --- Global Variables for Main Script ---
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = [
    { color: '#ffffff', label: 'Rest' }, { color: '#000000', label: 'Sleep' },
    { color: '#44f275', label: 'Learn' }, { color: '#fcff5e', label: 'Fun' },
    { color: '#38adf5', label: 'Prep' }, { color: '#ed2a02', label: '운동' },
];

// --- Date Display ---
function displayCurrentDate(dateStr) { // 이제 dateStr을 인자로 받음
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay && dateStr) {
        // YYYY-MM-DD 형식을 "YYYY / MM / DD"로 변경 (필요시)
        const [year, month, day] = dateStr.split('-');
        dateDisplay.textContent = `${year} / ${month} / ${day}`;
    } else if (dateDisplay) {
        // 날짜 정보가 없을 경우 기본 텍스트 또는 오늘 날짜 표시
        const now = new Date();
        dateDisplay.textContent = `${now.getFullYear()} / ${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`;
    }
}

// --- Color Picker Logic ---
function initializeColorPicker() {
    const colorPicker = document.getElementById('colorPicker');
    const addColorBtn = document.getElementById('addColorBtn');
    const existingOptions = colorPicker.querySelectorAll('.color-option');
    existingOptions.forEach(opt => opt.remove());

    savedColors.forEach(({color, label}) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.dataset.label = label;
        colorOption.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedColor = color;
            applySelectedColorToCurrentlyEditingCell();
        });
        colorPicker.insertBefore(colorOption, addColorBtn);
    });
    addColorBtn.removeEventListener('click', toggleColorPopup);
    addColorBtn.addEventListener('click', toggleColorPopup);
    const saveColorBtn = document.getElementById('saveColorBtn');
    saveColorBtn.removeEventListener('click', handleSaveNewColorOption);
    saveColorBtn.addEventListener('click', handleSaveNewColorOption);
}
function toggleColorPopup(e) { e.stopPropagation(); document.getElementById('colorPickerPopup').classList.toggle('show'); document.getElementById('colorLabel').value = '';}
function handleSaveNewColorOption() {
    const colorInput = document.getElementById('colorInput'), colorLabel = document.getElementById('colorLabel');
    const newColor = colorInput.value, newLabel = colorLabel.value.trim() || newColor;
    if (!savedColors.some(c => normalizeColor(c.color) === normalizeColor(newColor))) {
        savedColors.push({ color: newColor, label: newLabel });
        initializeColorPicker();
    }
    document.getElementById('colorPickerPopup').classList.remove('show');
}
document.addEventListener('click', (e) => {
    const popup = document.getElementById('colorPickerPopup'), addColorBtn = document.getElementById('addColorBtn');
    if (popup && popup.classList.contains('show') && !popup.contains(e.target) && e.target !== addColorBtn && !addColorBtn.contains(e.target)) {
        popup.classList.remove('show');
    }
});

// --- Elapsed Time & Current Time Styling (Stripes and Red Line) ---
function addStripedStyle(){const sid='elapsedTimeStyle';if(document.getElementById(sid))return;const s=document.createElement('style');s.id=sid;s.textContent=`.elapsed-time{position:relative;}.elapsed-time::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2;}.elapsed-time.light-bg::after{background-image:linear-gradient(45deg,rgba(0,0,0,0.07) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.07) 50%,rgba(0,0,0,0.07) 75%,transparent 75%);background-size:8px 8px;}.elapsed-time.dark-bg::after{background-image:linear-gradient(45deg,rgba(255,255,255,0.1) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.1) 75%,transparent 75%);background-size:8px 8px;}`;document.head.appendChild(s);}
function addCurrentTimeRedLineStyle(){const sid='currentTimeLineStyle';if(document.getElementById(sid))return;const cs=document.createElement("style");cs.id=sid;cs.textContent=`.current-time-block{position:relative;}.current-time-block::before{content:'';position:absolute;top:-1px;bottom:-1px;left:0;width:3px;background-color:red;z-index:1;}`;document.head.appendChild(cs);}

function updateElapsedTimeBlocks() {
    const now = new Date();
    const currentHour24 = now.getHours();
    const currentMinutes = now.getMinutes();

    // 그리드 시간은 6AM을 0시로 간주하여 계산
    const gridCurrentHour = (currentHour24 - 6 + 24) % 24;
    const gridCurrentBlockIndex = Math.floor(currentMinutes / 10); // 0-5 (10분 단위)
    const totalElapsedBlocksSince6AM = (gridCurrentHour * 6) + gridCurrentBlockIndex;

    // 적용할 그리드의 DOM ID 배열
    const gridDomIdsToProcess = ['timeGridDOM', 'goalTimeGridDOM']; // <<<< Goal Timeline ID 포함

    gridDomIdsToProcess.forEach(gridDomId => {
        const cells = document.querySelectorAll(`#${gridDomId} .grid-cell`);
        cells.forEach(cell => {
            const cellHour = parseInt(cell.dataset.hour); // 그리드 내부 0-23시
            const cellBlock = parseInt(cell.dataset.block); // 0-5 (10분 단위)
            const blockOverallIndex = (cellHour * 6) + cellBlock; // 6AM부터 시작하는 전체 블록 인덱스

            // 이전 상태 초기화
            cell.classList.remove('elapsed-time', 'light-bg', 'dark-bg', 'current-time-block');
            const dynamicStyleId = `dynamicRedLineStyleFor-${gridDomId}-${cellHour}-${cellBlock}`;
            let dynamicStyleElement = document.getElementById(dynamicStyleId);
            if (dynamicStyleElement) dynamicStyleElement.innerHTML = ''; // 해당 셀의 이전 스타일 초기화

            // 1. 빗금 처리 (양쪽 그리드 모두에 적용)
            if (blockOverallIndex < totalElapsedBlocksSince6AM) {
                cell.classList.add('elapsed-time');
                if (isDarkColor(cell.style.backgroundColor)) { // isDarkColor 콜백은 main.js에 정의되어 있음
                    cell.classList.add('dark-bg');
                    cell.classList.remove('light-bg');
                } else {
                    cell.classList.add('light-bg');
                    cell.classList.remove('dark-bg');
                }
            }

            // 2. 현재 시간 빨간색 세로줄 (양쪽 그리드 모두에 적용)
            if (cellHour === gridCurrentHour && cellBlock === gridCurrentBlockIndex) {
                cell.classList.add('current-time-block');
                const percentageThroughBlock = ((currentMinutes % 10) / 10) * 100;
                
                if (!dynamicStyleElement) {
                    dynamicStyleElement = document.createElement('style');
                    dynamicStyleElement.id = dynamicStyleId;
                    document.head.appendChild(dynamicStyleElement);
                }
                // 각 그리드의 해당 셀에만 스타일 적용
                dynamicStyleElement.innerHTML = 
                    `#${gridDomId} .grid-cell[data-hour="${cellHour}"][data-block="${cellBlock}"].current-time-block::before { 
                        left: ${percentageThroughBlock}%; 
                    }`;
            }
        });
    });
}

// --- Time Summary Logic ---
function calculatePreviousRankings(colorTotals, timeChanges) {
    const ptm={};Object.keys(colorTotals).forEach(col=>{const cb=colorTotals[col]||0,cib=timeChanges[col]||0;ptm[col]=(cb-cib)*10;});
    const pra=savedColors.map(({color,label})=>({color,label,totalMinutes:Math.max(0,ptm[normalizeColor(color)]||0) })); // use normalizeColor for map key
    pra.sort((a,b)=>b.totalMinutes-a.totalMinutes);const rm=new Map();pra.forEach((item,idx)=>rm.set(item.color,idx+1));return rm;
}
function updateTimeSummary() {
    const summaryContainer = document.getElementById('timeSummary');
    if (!summaryContainer || summaryContainer.style.display === 'none') return;
    const currentBlockData = getTimelineBlockData();
    const currentColorTotalsInBlocks = {}; const changeInBlocksSinceLastSummary = {};
    savedColors.forEach(({color}) => { const normColor = normalizeColor(color); currentColorTotalsInBlocks[normColor] = 0; changeInBlocksSinceLastSummary[normColor] = 0; });
    Object.values(currentBlockData).forEach(b => {
        const cch = normalizeColor(b.color); const pchfcd = normalizeColor(b.previousColor);
        if (cch && currentColorTotalsInBlocks.hasOwnProperty(cch)) { // Check if color is tracked
            currentColorTotalsInBlocks[cch]++;
            if (pchfcd && pchfcd !== cch && currentColorTotalsInBlocks.hasOwnProperty(pchfcd)) {
                changeInBlocksSinceLastSummary[cch]++;
                changeInBlocksSinceLastSummary[pchfcd]--;
            }
        }
    });
    const previousRankingsMap = calculatePreviousRankings(currentColorTotalsInBlocks, changeInBlocksSinceLastSummary);
    const colorDataArray = savedColors.map(({color, label}) => {
        const ncc = normalizeColor(color); const blks = currentColorTotalsInBlocks[ncc] || 0;
        const tm = blks * 10; const cim = (changeInBlocksSinceLastSummary[ncc] || 0) * 10;
        return { color, label, totalMinutes: tm, hours: Math.floor(tm/60), minutes: tm%60, change: cim };
    });
    colorDataArray.sort((a,b) => b.totalMinutes - a.totalMinutes); summaryContainer.innerHTML = '';
    colorDataArray.forEach((d,i) => {
        const cr=i+1,pr=previousRankingsMap.get(d.color),ts=`${String(d.hours).padStart(2,'0')}:${String(d.minutes).padStart(2,'0')}`,cih=formatTimeChange(d.change);
        let rih='<span class="rank-indicator"></span>';if(pr&&cr!==pr)rih=cr<pr?'<span class="rank-indicator rank-up">▲</span>':'<span class="rank-indicator rank-down">▼</span>';
        const si=document.createElement('div');si.className='color-summary-item';
        si.innerHTML=`<span class="ranking">${cr}.</span><div class="color-indicator" style="background-color:${d.color}"></div><span class="label">${d.label}</span>${rih}<div class="time-wrapper"><span class="time-value">${ts}</span><span class="time-change">${cih}</span></div>`;
        summaryContainer.appendChild(si);
    });
    clearAllPreviousColorMarkers('timeGrid'); // Clear for timeGrid (current timeline)
}

// --- Save & Load Logic ---
/**
 * 현재 날짜(currentLoadedDate)의 모든 모듈 데이터를 모아 객체로 반환합니다.
 */
function getCurrentDateSpecificData() {
    return {
        timeBlocks: getTimelineBlockData(), // timelines.js가 현재 날짜 컨텍스트를 알아야 함
        goalBlocks: getTimelineGoalData(),   // timelines.js가 현재 날짜 컨텍스트를 알아야 함
        scheduledTimelineTasks: getScheduledTasksData(), // timelines.js
        todos: getTodoData(),             // todo.js
        projectTodos: getProjectTodoData(), // projectTodos.js
        routines: getRoutinesData(),       // routines.js (해당 날짜에 수행된 루틴 또는 그날의 루틴 목록)
        diary: getDiaryData()              // diary.js
    };
}

/**
 * 저장할 전체 데이터 객체를 구성합니다. (모든 날짜 데이터 포함)
 */
function getTimelineDataForSave() {
    // 현재 보고 있는 날짜의 데이터를 먼저 업데이트
    if (currentLoadedDate) {
        allDaysData[currentLoadedDate] = getCurrentDateSpecificData();
    }

    return {
        colorPalette: savedColors, // 전역 설정
        dailyData: allDaysData,    // 날짜별 데이터
        version: "2.0"             // 버전 업데이트
    };
}

function saveTimelineToFile() { const d=getTimelineDataForSave(),b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.download='timeline_data.json';a.href=u;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u); }

/**
 * 파일에서 데이터를 로드하여 특정 날짜의 UI를 설정합니다.
 * @param {File} file - 불러올 JSON 파일
 */
function loadTimelineFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            
            // 전역 설정 로드
            if (jsonData.colorPalette) {
                savedColors = jsonData.colorPalette;
                initializeColorPicker(); // UI 업데이트
            }
            
            // 모든 날짜 데이터 저장
            allDaysData = jsonData.dailyData || {};

            // 현재 URL의 날짜에 해당하는 데이터로 UI 설정
            // (currentLoadedDate는 페이지 로드 시 URL 파라미터로 이미 설정되어 있어야 함)
            const dataForCurrentDate = allDaysData[currentLoadedDate] || {}; // 해당 날짜 데이터 없으면 빈 객체

            setTimelineBlockDataAndRender(dataForCurrentDate.timeBlocks || {}, 'timeGridDOM');
            setTimelineGoalDataAndRender(dataForCurrentDate.goalBlocks || {}, 'goalTimeGridDOM');
            setScheduledTasksDataAndRender(dataForCurrentDate.scheduledTimelineTasks || []);
            setAndRenderProjectTodos(dataForCurrentDate.projectTodos || null); // null 또는 []
            setAndRenderTodos(dataForCurrentDate.todos || []); // null 또는 []
            setAndRenderRoutines(dataForCurrentDate.routines || null); // null 또는 []
            setAndRenderDiary(dataForCurrentDate.diary || null); // null 또는 {}

            updateElapsedTimeBlocks(); // 현재 시간에 맞춰 업데이트 (currentLoadedDate가 오늘인지에 따라 다르게 동작해야 함)
            // updateTimeSummary(); // 데이터 변경 후 호출되도록 각 모듈의 setAndRender... 함수 내부 또는 콜백으로 이동 권장
        } catch (err) { 
            console.error('Error loading or parsing timeline file:', err); 
            alert('Error loading timeline file.'); 
        }
    };
    reader.readAsText(file);
}

/**
 * 페이지 시작 시 JSON 파일을 로드하고, URL의 날짜에 맞는 데이터를 UI에 적용합니다.
 */
async function loadJsonUponStart() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date');

    if (!dateFromUrl) {
        console.error("No date specified in URL. Cannot load daily data.");
        // 기본 날짜로 리디렉션하거나, 사용자에게 알림을 표시할 수 있습니다.
        // 여기서는 오늘 날짜로 설정하고 진행합니다. (메인 페이지에서 항상 날짜를 넘겨준다고 가정)
        const today = new Date();
        currentLoadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        // window.history.replaceState({}, '', `?date=${currentLoadedDate}`); // URL 업데이트 (선택 사항)
    } else {
        currentLoadedDate = dateFromUrl;
    }
    
    displayCurrentDate(currentLoadedDate); // 헤더의 날짜 표시 업데이트

    let initialFullData = null;
    try {
        // 여기서는 항상 timeline_data.json (또는 특정 파일)을 읽는다고 가정합니다.
        // 이 파일이 모든 날짜의 데이터를 가지고 있어야 합니다.
        const response = await fetch('./timeline_data.json'); // 실제 저장 파일 경로
        if (response.ok) {
            initialFullData = await response.json();
            console.log('Loaded data from default timeline_data.json.');
        } else {
            console.warn('Default timeline_data.json not found or failed to load, starting with empty data structure.');
        }
    } catch (fetchErr) {
        console.warn('Could not load timeline_data.json:', fetchErr);
    }

    if (initialFullData) {
        savedColors = initialFullData.colorPalette || savedColors; // 기본값 폴백
        allDaysData = initialFullData.dailyData || {};
    } else {
        // 파일 로드 실패 또는 파일 없을 시 초기 구조
        allDaysData = {};
        // savedColors는 이미 위에서 기본값으로 설정됨
    }
    initializeColorPicker(); // 팔레트 UI 초기화

    // 현재 날짜(currentLoadedDate)에 해당하는 데이터로 각 모듈 초기화
    const dataForCurrentDateOnLoad = allDaysData[currentLoadedDate] || {};

    // 각 모듈의 init 함수는 그대로 호출, setAndRender 함수로 데이터 주입
    // initTimelines, initTodoApp 등은 DOMContentLoaded에서 이미 호출되었을 수 있으므로,
    // 여기서는 데이터 설정 및 렌더링 함수만 호출합니다.
    setTimelineBlockDataAndRender(dataForCurrentDateOnLoad.timeBlocks || {}, 'timeGridDOM');
    setTimelineGoalDataAndRender(dataForCurrentDateOnLoad.goalBlocks || {}, 'goalTimeGridDOM');
    setScheduledTasksDataAndRender(dataForCurrentDateOnLoad.scheduledTimelineTasks || []);
    setAndRenderProjectTodos(dataForCurrentDateOnLoad.projectTodos || null);
    setAndRenderTodos(dataForCurrentDateOnLoad.todos || []);
    setAndRenderRoutines(dataForCurrentDateOnLoad.routines || null);
    setAndRenderDiary(dataForCurrentDateOnLoad.diary || null);

    updateElapsedTimeBlocks(); // 이 함수는 currentLoadedDate가 실제 오늘인지 확인하는 로직 필요
    // updateTimeSummary(); // 위 set... 함수들에서 onTimeGridDataChange 등을 통해 호출될 것임
}

function autoSaveToLocalStorage() {
    // This saves the *entire app state* including todos, timelines, etc.
    // to the main localStorage key.
    localStorage.setItem('timeLedgerData_main', JSON.stringify(getTimelineDataForSave()));
    // console.log('Main app state auto-saved to localStorage.');
}

// --- Utility Functions ---
function rgbToHex(rgb){if(!rgb||typeof rgb!=='string')return'#ffffff';const res=rgb.match(/\d+/g);if(!res||res.length<3)return'#ffffff';return`#${res.slice(0,3).map(v=>parseInt(v,10).toString(16).padStart(2,'0')).join('')}`;}
function normalizeColor(color){if(!color||typeof color!=='string')return null;const s=color.toLowerCase().trim();if(s.startsWith('#'))return s.length===4?`#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`:s;if(s.startsWith('rgb'))return rgbToHex(s);return s;}
function isDarkColor(cs){if(!cs)return false;let r,g,b;const h=normalizeColor(cs);if(h&&h.startsWith('#')){const hval=h.replace('#','');if(hval.length===3){r=parseInt(hval[0]+hval[0],16);g=parseInt(hval[1]+hval[1],16);b=parseInt(hval[2]+hval[2],16);}else if(hval.length===6){r=parseInt(hval.substring(0,2),16);g=parseInt(hval.substring(2,4),16);b=parseInt(hval.substring(4,6),16);}else return false;}else return false;return(0.299*r+0.587*g+0.114*b)/255<0.5;}
function formatTimeChange(mins){if(mins===0)return"";const s=mins>0?"+":"-",am=Math.abs(mins);if(am>=60){const h=Math.floor(am/60),rm=am%60;return rm===0?`${s}${h}h`:`${s}${h}h ${rm}m`;}return`${s}${am}m`;}

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date'); // 'YYYY-MM-DD'

    if (dateFromUrl) {
        console.log("Displaying Daily Page for date:", dateFromUrl);
        // 예: 페이지 상단에 날짜 표시
        // const dateDisplayElement = document.getElementById('some-date-display-element-id');
        // if (dateDisplayElement) {
        //     dateDisplayElement.textContent = dateFromUrl;
        // }
        
        // 이 dateFromUrl을 사용하여 해당 날짜의 할 일, 타임라인 데이터 등을 로드하고 표시합니다.
        // loadAndDisplayDailyData(dateFromUrl); 
    } else {
        console.warn("No date parameter found in URL for Daily Page.");
        // 날짜 정보가 없으면 기본 날짜를 사용하거나, 사용자에게 알림을 표시할 수 있습니다.
    }

    initYearProgress('#year-progress-header-container'); 
    initDayProgress('#day-progress-bar-host'); 

    addStripedStyle();
    addCurrentTimeRedLineStyle();
    
    // Define the callback for todo.js (optional, if main needs to react to todo changes)
    const handleGenericDataChange = () => { // 데이터 변경 시 자동 저장 등
        // autoSaveToLocalStorage(); // 필요시 활성화
        // 현재는 파일 저장 버튼으로 수동 저장
        // 만약 이 콜백에서 현재 날짜의 데이터를 allDaysData에 업데이트하려면 추가 로직 필요
        if (currentLoadedDate) {
            // 주의: 이 콜백은 각 모듈 내부의 데이터 변경 시 호출되므로,
            // 여기서 getCurrentDateSpecificData()를 호출하면 무한 루프에 빠질 수 있음.
            // 각 모듈의 get...Data()는 이미 최신 데이터를 반영하고 있어야 함.
            // saveTimelineToFile()을 여기서 호출하는 것은 너무 빈번할 수 있음.
        }
    };

    // Initialize TODO app. Pass undefined for initialData so it uses its own backup/defaults first.
    // loadJsonUponStart will later call setAndRenderTodos if data is in the main JSON.
    initTodoApp('#todo-app-container', undefined, handleGenericDataChange); 
    initProjectTodoApp('#project-todo-app-container', undefined, handleGenericDataChange); 
    initRoutinesApp('#routines-app-container', undefined, handleGenericDataChange); 
    initDiaryApp('#diary-app-container', undefined, handleGenericDataChange); // <-- NEW: Initialize diary app


    const timelineCallbacks = {
        getSelectedColor: () => selectedColor,
        isDarkColor: isDarkColor,
        normalizeColor: normalizeColor,
        onTimeGridDataChange: () => {
            updateTimeSummary(); 
            updateElapsedTimeBlocks(); 
            handleGenericDataChange(); 
        }
    };
    initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    
    loadJsonUponStart(); // This will load all data including TODOs if available

    // 저장/불러오기 버튼 리스너
    const saveBtnEl = document.getElementById('stickySaveButton'); // 또는 'saveButton'
    const loadBtnEl = document.getElementById('stickyLoadButton'); // 또는 'loadButton'
    const loadInputEl = document.getElementById('stickyLoadInput'); // 또는 'loadInput'

    if (saveBtnEl) saveBtnEl.addEventListener('click', saveTimelineToFile);
    if (loadBtnEl && loadInputEl) {
        loadBtnEl.addEventListener('click', () => loadInputEl.click());
        loadInputEl.addEventListener('change', (e) => { 
            if (e.target.files && e.target.files[0]) {
                loadTimelineFromFile(e.target.files[0]);
                e.target.value = null; // 파일 다시 선택 가능하도록 초기화
            }
        });
    }
    
    document.addEventListener('keydown', (e) => { 
        if ((e.metaKey || e.ctrlKey) && e.key === 's') { 
            e.preventDefault(); 
            saveTimelineToFile(); // This now includes TODOs, routines, inverse placeholders
            // autoSaveToLocalStorage(); // saveTimelineToFile implies a deliberate save, autoSave is for background
        } 
    });
    
    setInterval(() => { 
        updateElapsedTimeBlocks(); 
        // autoSaveToLocalStorage(); // Re-evaluate if this interval save is needed given other save points
    }, 60000); 
});