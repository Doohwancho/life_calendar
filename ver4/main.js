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

// --- Global Variables for Main Script ---
let selectedColor = 'rgb(255, 255, 255)';
let savedColors = [
    { color: '#ffffff', label: 'Rest' }, { color: '#000000', label: 'Sleep' },
    { color: '#44f275', label: 'Learn' }, { color: '#fcff5e', label: 'Fun' },
    { color: '#38adf5', label: 'Prep' }, { color: '#ed2a02', label: '운동' },
];

// --- Date Display ---
function displayCurrentDate() {
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateDisplay.textContent = `${year} / ${month} / ${day}`;
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
function getTimelineDataForSave() {
    return {
        colorPalette: savedColors,
        timeBlocks: getTimelineBlockData(),
        goalBlocks: getTimelineGoalData(),
        scheduledTimelineTasks: getScheduledTasksData(),
        todos: getTodoData(), // Get TODOs from todo.js
        projectTodos: getProjectTodoData(),
        routines: getRoutinesData(),
        diary: getDiaryData(),
        inverseGamification: {}, // Placeholder for future inverse/gamification
        version: "1.9"        // Increment version
    };
}
function saveTimelineToFile() { const d=getTimelineDataForSave(),b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.download='timeline_data.json';a.href=u;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u); }
function loadTimelineFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.colorPalette) {
                savedColors = data.colorPalette;
                initializeColorPicker();
            }
            if (data.timeBlocks) setTimelineBlockDataAndRender(data.timeBlocks, 'timeGridDOM');
            if (data.goalBlocks) setTimelineGoalDataAndRender(data.goalBlocks, 'goalTimeGridDOM');
            if (data.scheduledTimelineTasks) {
                    setScheduledTasksDataAndRender(data.scheduledTimelineTasks);
                } else {
                    // 이전 버전 파일에는 이 키가 없을 수 있으므로, 없는 경우 빈 배열로 초기화
                    setScheduledTasksDataAndRender([]);
                }
            
            if (data.projectTodos) { 
                setAndRenderProjectTodos(data.projectTodos);
            } else {
                setAndRenderProjectTodos(null); // Initialize with defaults/backup if not in file
            }
            if (data.todos) { // Load TODOs if present
                setAndRenderTodos(data.todos); // Use the imported function
            } else {
                setAndRenderTodos([]); // Or initialize with empty if not in file
            }
            if (data.routines) { 
                setAndRenderRoutines(data.routines);
            } else {
                setAndRenderRoutines(null); // Initialize with defaults/backup if not in file
            }
            if (data.diary) { // <-- NEW: Load diary data
                setAndRenderDiary(data.diary);
            } else {
                setAndRenderDiary(null); // Initialize with defaults/backup if not in file
            }

            updateElapsedTimeBlocks();
        } catch (err) { console.error('Error loading timeline:', err); alert('Error loading timeline file.'); }
    };
    reader.readAsText(file);
}

async function loadJsonUponStart() {
    let dataToLoad = null;
    console.log('Attempting to load data ONLY from JSON file.');

    try {
        // const storedData = localStorage.getItem('timeLedgerData_main'); // Use a distinct key for the main app data
        // if (storedData) {
        //     dataToLoad = JSON.parse(storedData);
        //     // console.log(dataToLoad);
        //     console.log('Loaded main data from localStorage.');
        // } else {
            const rsp = await fetch('./timeline_data.json'); // Ensure this file exists and is structured correctly
            if (!rsp.ok) throw new Error(`Workspace default timeline.json failed: ${rsp.statusText}`);
            dataToLoad = await rsp.json();

            console.log('Loaded main data from default timeline.json.');
        // }
    } catch (fetchErr) {
        console.warn('Could not load from localStorage or default timeline.json:', fetchErr);
        // Initialize with empty/default structure if all loading fails
        dataToLoad = {
            colorPalette: [ // Default palette if nothing loads
                { color: '#ffffff', label: 'Rest' }, { color: '#000000', label: 'Sleep' },
                { color: '#44f275', label: 'Learn' }, { color: '#fcff5e', label: 'Fun' },
                { color: '#38adf5', label: 'Prep' }, { color: '#ed2a02', label: '운동' },
            ],
            timeBlocks: {},
            goalBlocks: {},
            todos: null, // Will let todo.js use its local backup or default
            projectTodos: null,
            routines: [],
            inverseGamification: {}
        };
    }

    try {
        if (dataToLoad.colorPalette) savedColors = dataToLoad.colorPalette;
        initializeColorPicker(); 
        
        // Initialize timelines first (they might create DOM elements needed by other updates)
        // initTimelines is called in DOMContentLoaded, so data is set below

        // console.log("Data to load into timelines.js - timeBlocks:", JSON.stringify(dataToLoad.timeBlocks, null, 2));
        // console.log("Data to load into timelines.js - goalBlocks:", JSON.stringify(dataToLoad.goalBlocks, null, 2));


        setTimelineBlockDataAndRender(dataToLoad.timeBlocks || {}, 'timeGridDOM');
        setTimelineGoalDataAndRender(dataToLoad.goalBlocks || {}, 'goalTimeGridDOM');
        
        if (dataToLoad.scheduledTimelineTasks) {
            setScheduledTasksDataAndRender(dataToLoad.scheduledTimelineTasks);
        } else {
            setScheduledTasksDataAndRender([]); // 파일에 없으면 빈 배열로 초기화
        }

        if (dataToLoad.projectTodos !== undefined) { // <-- NEW: Apply project TODOs
            setAndRenderProjectTodos(dataToLoad.projectTodos);
        } else {
            setAndRenderProjectTodos(null); // Let projectTodos.js handle its own defaults/backup
        }

        // Initialize or set TODO data
        // initTodoApp is called in DOMContentLoaded. We pass initial data if available.
        // If dataToLoad.todos is null or undefined, initTodoApp in DOMContentLoaded will handle defaults.                
        if (dataToLoad.todos !== undefined && dataToLoad.todos !== null) {
            setAndRenderTodos(dataToLoad.todos);
        }
        // Load routines and inverse here:
        if (dataToLoad.routines !== undefined) { // <-- NEW: Apply routines
            setAndRenderRoutines(dataToLoad.routines);
        } else {
            setAndRenderRoutines(null); 
        }

        if (dataToLoad.diary !== undefined) { // <-- NEW: Apply diary data
            setAndRenderDiary(dataToLoad.diary);
        } else {
            setAndRenderDiary(null); 
        }

        updateElapsedTimeBlocks();
        // updateTimeSummary(); // Called by onTimeGridDataChange via setTimelineBlockDataAndRender
    } catch (err) {
        console.error('Error applying loaded data:', err);
        // Fallback to safe defaults if applying data fails
        initializeColorPicker();
        setTimelineBlockDataAndRender({}, 'timeGridDOM');
        setTimelineGoalDataAndRender({}, 'goalTimeGridDOM');
        setAndRenderTodos([]); // Empty todos
        updateElapsedTimeBlocks();
        setScheduledTasksDataAndRender([]);
    }
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
    initYearProgress('#year-progress-header-container'); 
    initDayProgress('#day-progress-bar-host'); 

    addStripedStyle();
    addCurrentTimeRedLineStyle();
    
    // Define the callback for todo.js (optional, if main needs to react to todo changes)
    const handleGenericDataChange = () => { // Shared callback for auto-save
        // autoSaveToLocalStorage(); // Call if/when re-enabled
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

    // ... rest of your event listeners (save/load buttons, keyboard shortcuts, interval) ...
    const saveBtnEl = document.getElementById('saveButton'),loadBtnEl = document.getElementById('loadButton'),loadInputEl = document.getElementById('loadInput');
    if (saveBtnEl) saveBtnEl.addEventListener('click', saveTimelineToFile);
    if (loadBtnEl) loadBtnEl.addEventListener('click', () => loadInputEl.click());
    if (loadInputEl) loadInputEl.addEventListener('change', (e) => { if (e.target.files[0]) loadTimelineFromFile(e.target.files[0]); });

    // ***** NEW: Sticky 버튼 이벤트 리스너 연결 *****
    const stickySaveBtn = document.getElementById('stickySaveButton');
    const stickyLoadBtn = document.getElementById('stickyLoadButton');
    const stickyLoadInputEl = document.getElementById('stickyLoadInput');

    if (stickySaveBtn) {
        stickySaveBtn.addEventListener('click', saveTimelineToFile);
    }
    if (stickyLoadBtn && stickyLoadInputEl) {
        stickyLoadBtn.addEventListener('click', () => {
            stickyLoadInputEl.click(); // 숨겨진 file input 클릭 트리거
        });
        stickyLoadInputEl.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadTimelineFromFile(e.target.files[0]);
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