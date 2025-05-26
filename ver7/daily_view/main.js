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

let currentLoadedDate = null;
let currentMonthData = {};    // 수정됨: 변수명 일관성 유지 (currentMonthDailyData -> currentMonthData)

let selectedColor = 'rgb(255, 255, 255)';
let savedColors = [
    { color: '#ffffff', label: 'Rest' }, { color: '#000000', label: 'Sleep' },
    { color: '#44f275', label: 'Learn' }, { color: '#fcff5e', label: 'Fun' },
    { color: '#38adf5', label: 'Prep' }, { color: '#ed2a02', label: '운동' },
];

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
    const colorInput = document.getElementById('colorInput'), colorLabel = document.getElementById('colorLabel');
    if (!colorInput || !colorLabel) return;
    const newColor = colorInput.value, newLabel = colorLabel.value.trim() || newColor;

    if (!savedColors.some(c => normalizeColor(c.color) === normalizeColor(newColor))) {
        savedColors.push({ color: newColor, label: newLabel });
        initializeColorPicker();
        console.log("Color palette updated.");
        // --- [Phase 6] 추가 --- settings.json을 dirty로 표시
        // settings.json의 전체 구조를 알아야 하지만, 우선 colorPalette만 포함하여 저장
        // 실제로는 main.js에서 settings 전체를 가져와서 업데이트 후 dirty 표시해야 함
        dirtyFileService.markFileAsDirty('settings.json', { version: "3.0", colorPalette: savedColors /*, ... other settings */ });
    }
    document.getElementById('colorPickerPopup').classList.remove('show');
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

// saveTimelineToFile 함수 수정
async function saveTimelineToFile() { // async로 변경
    if (!currentLoadedDate) {
        alert("데이터를 저장할 날짜가 로드되지 않았습니다.");
        return;
    }
    // const yearMonth = currentLoadedDate.substring(0, 7);

    // 1. 현재 월의 dailyData를 localStorage에 dirty로 명시적 업데이트
    // currentMonthData[currentLoadedDate] = getCurrentDateSpecificData(); // 최신 데이터 반영

    // --- [수정] monthFileObject를 만들었으면 얘를 써주자 ---
    // const monthFileObjectToSave = { // 변수 이름 살짝 바꿔서 의도 명확히
    //     yearMonth: yearMonth,
    //     dailyData: { ...currentMonthData } // currentMonthData의 현재 상태를 복사해서 사용
    // };

    // dirtyFileService.markFileAsDirty(
    //     `daily/${yearMonth}.json`, 
    //     monthFileObjectToSave // 생성한 변수 사용!
    // );

    // 2. (선택사항) settings 데이터 (colorPalette)도 dirty로 명시적 업데이트
    // const currentSettingsData = { 
    //     version: "3.0", 
    //     colorPalette: savedColors 
    //     // ... settings.json에 있는 다른 설정값들도 포함해야 할 수 있음
    // };
    // dirtyFileService.markFileAsDirty('settings.json', currentSettingsData);
        
    // 3. Global Save (ZIP 다운로드) 호출
    await dirtyFileService.triggerGlobalSave(); // 네임스페이스 사용 확인!
}


function loadTimelineFromFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            let dataToLoadForCurrentDate = {};

            if (jsonData.yearMonth && jsonData.dailyData) {
                // 업로드된 파일이 YYYY-MM.json 형식일 경우
                console.log(`Loading uploaded month file: ${file.name}`);
                currentMonthData = jsonData.dailyData;
                dirtyFileService.markFileAsDirty(`daily/${jsonData.yearMonth}.json`, jsonData); // 로드한 것도 dirty로 표시 (다음 global save에 포함)
                
                if (currentMonthData[currentLoadedDate]) {
                    dataToLoadForCurrentDate = currentMonthData[currentLoadedDate];
                } else if (currentLoadedDate.substring(0, 7) === jsonData.yearMonth) {
                    // 로드한 달과 현재 보고 있는 달은 같지만, 특정 날짜 데이터가 없는 경우
                    dataToLoadForCurrentDate = {};
                } else {
                    // 로드한 달이 현재 보고 있는 달과 아예 다른 경우, 페이지를 해당 달의 첫날로 리디렉션하거나 사용자에게 알림
                    alert(`로드한 파일은 ${jsonData.yearMonth}월의 데이터입니다. 해당 월의 데이터로 업데이트되었으나, 현재 보고 있는 날짜(${currentLoadedDate})와 다를 수 있습니다.`);
                    // 또는 currentLoadedDate를 업로드된 달의 첫날로 변경하는 로직 추가 가능
                    dataToLoadForCurrentDate = {}; // 일단 빈 데이터로 현재 날짜를 그림
                }

            } else if (jsonData.colorPalette && jsonData.dailyData) { 
                currentMonthData = jsonData.dailyData; 
                // settings.json 형식으로 간주 (또는 이전 호환용)
                console.log("Loading uploaded settings file (assumed)");
                savedColors = jsonData.colorPalette;
                dirtyFileService.markFileAsDirty('settings.json', jsonData);
                initializeColorPicker();
                alert("색상 팔레트 설정을 로드했습니다. 다른 데이터는 변경되지 않았습니다.");
                return; // settings만 로드했으므로 다른 모듈 업데이트 불필요
            
            } else {
                alert("지원하지 않거나 올바르지 않은 파일 형식입니다. (예: YYYY-MM.json 또는 settings.json)");
                return;
            }

            setAllModuleData(dataToLoadForCurrentDate); // 추출된 데이터로 UI 업데이트
            updateElapsedTimeBlocks();
            updateTimeSummary();

        } catch (err) { console.error('Error loading/parsing uploaded file:', err); alert('Error loading file.');}
    };
    reader.readAsText(file);
}

async function loadJsonUponStart() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date');

    if (dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl)) {
        currentLoadedDate = dateFromUrl;
    } else {
        const today = new Date();
        currentLoadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        console.warn("[DailyView Load] No valid date in URL, defaulting to today:", currentLoadedDate);
    }
    
    displayCurrentDate(currentLoadedDate); // 상단 날짜 표시 업데이트
    console.log(`[DailyView Load] Page loading for date: ${currentLoadedDate}`);

    const year = currentLoadedDate.substring(0, 4);
    const month = currentLoadedDate.substring(5, 7);
    const yearMonth = `${year}-${month}`;

    // --- [수정 확인] settingsFileIdentifier 및 dailyFileIdentifier 선언 위치 ---
    const settingsFileIdentifier = `settings.json`;
    const dailyFileIdentifier = `daily/${yearMonth}.json`;
    // --------------------------------------------------------------------

    try {
        // 1. 설정 데이터 로드 (localStorage 우선)
        console.log(`[DailyView Load] Attempting to load settings from dirty store for: ${settingsFileIdentifier}`); // 여기서 settingsFileIdentifier 사용
        let settingsDataFromStore = dirtyFileService.getDirtyFileData(settingsFileIdentifier);
        if (settingsDataFromStore) {
            if (settingsDataFromStore.colorPalette) savedColors = settingsDataFromStore.colorPalette;
            console.log(`[DailyView Load] Loaded settings from localStorage dirty store.`);
        } else {
            const settingsFilePath = '../data/settings.json';
            console.log(`[DailyView Load] No dirty settings found. Fetching from: ${settingsFilePath}`);
            const settingsFileResponse = await fetch(settingsFilePath);
            if (settingsFileResponse.ok) {
                const freshSettings = await settingsFileResponse.json();
                if (freshSettings.colorPalette) savedColors = freshSettings.colorPalette;
                console.log(`[DailyView Load] Successfully fetched settings from ${settingsFilePath}`);
                // dirtyFileService.clearDirtyFile(settingsFileIdentifier); // Global Save 전까지 주석 처리 유지
            } else {
                console.warn(`[DailyView Load] Could not load ${settingsFilePath}. Using default color palette.`);
            }
        }
        initializeColorPicker();

        // 2. 월별 일일 데이터 로드 (localStorage 우선)
        console.log(`[DailyView Load] Attempting to load daily data from dirty store for: ${dailyFileIdentifier}`); // 여기서 dailyFileIdentifier 사용
        let monthlyDataStoreObject = dirtyFileService.getDirtyFileData(dailyFileIdentifier);
        if (monthlyDataStoreObject) {
            currentMonthData = monthlyDataStoreObject.dailyData || {};
            console.log(`[DailyView Load] Loaded daily data for ${yearMonth} from localStorage dirty store:`, JSON.parse(JSON.stringify(currentMonthData)));
        } else {
            const dailyDataFilePath = `../data/daily/${yearMonth}.json`;
            console.log(`[DailyView Load] No dirty daily data found for ${yearMonth}. Fetching from: ${dailyDataFilePath}`);
            const dailyFileResponse = await fetch(dailyDataFilePath);
            if (dailyFileResponse.ok) {
                const freshMonthlyJson = await dailyFileResponse.json();
                currentMonthData = freshMonthlyJson.dailyData || {};
                console.log(`[DailyView Load] Successfully fetched daily data from ${dailyDataFilePath}:`, JSON.parse(JSON.stringify(currentMonthData)));
                // dirtyFileService.clearDirtyFile(dailyFileIdentifier); // Global Save 전까지 주석 처리 유지
            } else {
                console.warn(`[DailyView Load] ${dailyDataFilePath} not found or failed to load. Starting with empty data for this month.`);
                currentMonthData = {};
            }
        }
        
        const dataForCurrentDateOnLoad = currentMonthData[currentLoadedDate] || {};
        console.log(`[DailyView Load] Data to set for UI for ${currentLoadedDate}:`, JSON.parse(JSON.stringify(dataForCurrentDateOnLoad)));
        setAllModuleData(dataForCurrentDateOnLoad);

    } catch (error) {
        console.error("[DailyView Load] Error during initial data load:", error);
        setAllModuleData({});
    } finally {
        updateElapsedTimeBlocks();
    }
}

function setAllModuleData(dataBundle) {
    setTimelineBlockDataAndRender(dataBundle.timeBlocks||{}, 'timeGridDOM');
    setTimelineGoalDataAndRender(dataBundle.goalBlocks||{}, 'goalTimeGridDOM');
    setScheduledTasksDataAndRender(dataBundle.scheduledTimelineTasks||[]);
    setAndRenderProjectTodos(dataBundle.projectTodos||[]);
    setAndRenderTodos(dataBundle.todos||[]);
    setAndRenderRoutines(dataBundle.routines||[]);
    setAndRenderDiary(dataBundle.diary||{});
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
    addStripedStyle(); addCurrentTimeRedLineStyle();
    
    const handleGenericDataChange = () => {
        if (currentLoadedDate) {
            const dayDataToSave = getCurrentDateSpecificData();
            console.log(`[DailyView SaveToMemory] For ${currentLoadedDate}, data from modules:`, JSON.parse(JSON.stringify(dayDataToSave)));
    
            currentMonthData[currentLoadedDate] = dayDataToSave; // 메모리의 currentMonthData 업데이트
            console.log(`[DailyView SaveToMemory] currentMonthData in memory for ${currentLoadedDate.substring(0, 7)} after update:`, JSON.parse(JSON.stringify(currentMonthData)));
            
            const yearMonth = currentLoadedDate.substring(0, 7);
            const objectToMarkDirty = { yearMonth: yearMonth, dailyData: currentMonthData };
            
            // dirtyFileService가 이 객체를 localStorage에 저장합니다.
            console.log(`[DEBUG] Saving to dirty store. Key: daily/${yearMonth}.json. Object:`, JSON.parse(JSON.stringify(objectToMarkDirty)));
            dirtyFileService.markFileAsDirty(`daily/${yearMonth}.json`, objectToMarkDirty);
        } else {
            // --- [로그 추가] ---
            console.warn("[DEBUG] handleGenericDataChange called, but currentLoadedDate is null. Save aborted.");
        }
    };

    initTodoApp('#todo-app-container',undefined,handleGenericDataChange);
    initProjectTodoApp('#project-todo-app-container',undefined,handleGenericDataChange);
    initRoutinesApp('#routines-app-container',undefined,handleGenericDataChange);
    initDiaryApp('#diary-app-container',undefined,handleGenericDataChange);

    const timelineCallbacks = {
        getSelectedColor: () => selectedColor,
        isDarkColor,
        normalizeColor,
        onTimeGridDataChange: () => {
            updateTimeSummary();
            handleGenericDataChange(); // 타임라인 변경 시 핸들러 호출
        }
    };
    initTimelines('timeGridDOM', 'goalTimeGridDOM', timelineCallbacks);
    
    loadJsonUponStart();

    const saveBtnEl=document.getElementById('stickySaveButton');
    const loadBtnEl=document.getElementById('stickyLoadButton');
    const loadInputEl=document.getElementById('stickyLoadInput');

    if(saveBtnEl)saveBtnEl.addEventListener('click',saveTimelineToFile);
    if(loadBtnEl&&loadInputEl){
        loadBtnEl.addEventListener('click',()=>loadInputEl.click());
        loadInputEl.addEventListener('change',(e)=>{
            if(e.target.files&&e.target.files[0]){loadTimelineFromFile(e.target.files[0]);e.target.value=null;}
        });
    }
    document.addEventListener('keydown',(e)=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();saveTimelineToFile();}});
    setInterval(()=>{if(currentLoadedDate){const t=new Date(),dS=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;if(currentLoadedDate===dS){updateElapsedTimeBlocks();}}},60000);
});