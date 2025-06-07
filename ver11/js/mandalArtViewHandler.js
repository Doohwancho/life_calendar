import { generateId } from './uiUtils.js'; // ID 생성을 위해 import
import { triggerFullYearSave } from './dirtyFileService.js';
import * as dirtyFileService from './dirtyFileService.js';

// dataManager와 eventBus는 init 함수에서 주입받아 사용합니다.
let data;
let eventBus;

// 이 뷰에서 추가한 모든 이벤트 리스너를 추적하여 cleanup 시 제거하기 위한 배열
const activeEventListeners = [];

// 컨텍스트 메뉴가 대상으로 하는 ID를 저장하기 위한 모듈 변수
let contextMenuTarget = {
    cellId: null,
    mandalId: null
};

// --- 9x9 그리드 상수 (모듈 스코프에 유지) ---
const NINE_GRID_CONFIG = {
    CENTRAL_GOAL_INDEX: 40,
    PALETTE: {
        30: { bg: '#ffcdd2', text: '#000000' }, 31: { bg: '#ffe0b2', text: '#000000' },
        32: { bg: '#fff9c4', text: '#000000' }, 39: { bg: '#c8e6c9', text: '#000000' },
        40: { bg: '#ffffff', text: '#000000' }, 41: { bg: '#b3e5fc', text: '#000000' },
        48: { bg: '#c5cae9', text: '#000000' }, 49: { bg: '#e1bee7', text: '#000000' },
        50: { bg: '#212121', text: '#ffffff' },
    },
    SYNC_MAP: { 30: 10, 31: 13, 32: 16, 39: 37, 41: 43, 48: 64, 49: 67, 50: 70 },
};

// --- 헬퍼 함수 ---
function getRepresentativeColor(cellIndex) {
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    const topicCellIndex = (blockRow + 3) * 9 + (blockCol + 3);
    return NINE_GRID_CONFIG.PALETTE[topicCellIndex]?.bg || '#ffffff';
}

// --- 렌더링 함수 ---
function render() {
    if (!data.getMandalArtState()) return; // 데이터가 아직 없으면 렌더링 중단
    renderSidebar();
    renderGrid();
}

function renderSidebar() {
    const mandalListEl = document.getElementById('mandal-list');
    if (!mandalListEl || !data) return;
    const mandalState = data.getMandalArtState();
    if (!mandalState) return;
    mandalListEl.innerHTML = '';
    mandalState.mandalArts.forEach(mandal => {
        const li = document.createElement('li');
        li.textContent = mandal.name;
        li.dataset.id = mandal.id;
        if (mandal.id === mandalState.activeMandalArtId) li.classList.add('active');
        mandalListEl.appendChild(li);
    });
}


function renderGrid() {
    const gridContainerEl = document.getElementById('mandal-art-grid');
    if (!gridContainerEl || !data) return;

    const mandalState = data.getMandalArtState();
    const activeMandal = mandalState.mandalArts.find(m => m.id === mandalState.activeMandalArtId);
    
    gridContainerEl.innerHTML = '';
    if (!activeMandal) return;

    gridContainerEl.style.setProperty('--mandal-grid-size', 9);
    gridContainerEl.className = 'mandal-art-grid-container grid-9x9';

    activeMandal.cells.forEach((cellData, i) => {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.id = cellData.id;
        
        const row = Math.floor(i / 9);
        const col = i % 9;
        const textarea = document.createElement('textarea');

        if ((col + 1) % 3 === 0 && col < 8) cellEl.classList.add('border-right-bold');
        if ((row + 1) % 3 === 0 && row < 8) cellEl.classList.add('border-bottom-bold');

        const syncSourceIndex = Object.keys(NINE_GRID_CONFIG.SYNC_MAP).find(key => NINE_GRID_CONFIG.SYNC_MAP[key] === i);
        if (syncSourceIndex) {
            cellData.content = activeMandal.cells[syncSourceIndex].content;
            cellEl.classList.add('sub-goal');
            textarea.readOnly = true;
        }

        if (i === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
            cellEl.classList.add('central-goal');
            cellData.content = activeMandal.name;
        }

        const paletteInfo = NINE_GRID_CONFIG.PALETTE[i] || NINE_GRID_CONFIG.PALETTE[syncSourceIndex];
        if (paletteInfo) {
            cellEl.style.backgroundColor = paletteInfo.bg;
            textarea.style.color = paletteInfo.text;
        }
        
        if (cellData.color) {
            cellEl.style.backgroundColor = cellData.color;
        }
        
        if (cellData.isCompleted) {
            cellEl.classList.add('completed');
            cellEl.style.backgroundColor = getRepresentativeColor(i);
        }
        
        if (cellData.isHighlighted) cellEl.classList.add('highlighted');

        textarea.value = cellData.content;
        
        const checkmark = document.createElement('div');
        checkmark.className = 'checkmark';
        checkmark.innerHTML = '✔';

        cellEl.appendChild(textarea);
        cellEl.appendChild(checkmark);
        gridContainerEl.appendChild(cellEl);
    });
}

// --- 이벤트 핸들러 ---
// 모든 핸들러는 dataManager를 통해 상태를 업데이트합니다.

function handleAddMandal() {
    const name = prompt("새 만다라트의 이름을 입력하세요:", "새 프로젝트");
    if (!name) return;

    const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState())); // 상태 복사
    const newId = generateId('mandal_');
    const newMandal = {
        id: newId,
        name: name,
        type: '9x9',
        cells: Array.from({ length: 81 }, (_, i) => ({
            id: `cell-${i}`, content: '', isCompleted: false, isHighlighted: false, color: null
        }))
    };
    newMandal.cells[NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX].content = name;

    mandalState.mandalArts.push(newMandal);
    mandalState.activeMandalArtId = newId;

    data.updateMandalArtState(mandalState);
}

function handleDeleteMandal() {
    const { mandalId } = contextMenuTarget;
    if (!mandalId) return;

    const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
    const mandalToDelete = mandalState.mandalArts.find(m => m.id === mandalId);
    
    if (mandalToDelete && confirm(`'${mandalToDelete.name}' 만다라트를 정말 삭제하시겠습니까?`)) {
        mandalState.mandalArts = mandalState.mandalArts.filter(m => m.id !== mandalId);
        
        if (mandalState.activeMandalArtId === mandalId) {
            mandalState.activeMandalArtId = mandalState.mandalArts.length > 0 ? mandalState.mandalArts[0].id : null;
        }
        data.updateMandalArtState(mandalState);
    }
}

async function handleFullSave() {
    console.log('[MandalArtViewHandler] Triggering Full Year Save...');
    const currentYear = data.getState().currentDisplayYear;
    const filesToSave = data.getCurrentYearDataForSave(); // 최적화된 데이터 포함
    
    await triggerFullYearSave(currentYear, filesToSave);
    
    // 저장이 완료되었으므로 dirty 상태 클리어
    data.clearAllDirtyFilesForYear(currentYear); 
    // 만다라트 데이터는 연도와 무관하므로 별도 클리어
    dirtyFileService.clearDirtyFile('mandal-art.json');
}



// --- SPA 페이지 초기화 및 정리 함수 ---

export async function initMandalArtView(dataModule, eventBusModule) {
    console.log('[MandalArtViewHandler] 만다라트 뷰 초기화');
    data = dataModule;
    eventBus = eventBusModule;
    activeEventListeners.length = 0;

    // 만다라트 데이터가 없으면 dataManager를 통해 초기화
    if (!data.getMandalArtState()) {
        data.initializeMandalArtState();
    }
    
    // DOM 요소 참조
    const addMandalBtn = document.getElementById('add-mandal-btn');
    const mandalListEl = document.getElementById('mandal-list');
    const gridContainerEl = document.getElementById('mandal-art-grid');
    const cellContextMenuEl = document.getElementById('mandal-cell-context-menu');
    const sidebarContextMenuEl = document.getElementById('mandal-sidebar-context-menu');
    const colorPicker = document.getElementById('mandal-color-picker');

    // --- 이벤트 리스너 등록 ---

    // 1. 데이터 변경 감지 리스너
    const dataChangedHandler = (payload) => {
        // mandalArt 관련 업데이트가 있을 때만 렌더링
        if (payload.source && payload.source.startsWith('mandalArt')) {
            render();
        }
    };
    eventBus.on("dataChanged", dataChangedHandler);
    activeEventListeners.push({ target: eventBus, type: 'dataChanged', handler: dataChangedHandler, isEventBus: true });

    // 2. 버튼 클릭 리스너
    if (addMandalBtn) {
        addMandalBtn.addEventListener('click', handleAddMandal);
        activeEventListeners.push({ element: addMandalBtn, type: 'click', handler: handleAddMandal });
    }

    // 3. 이벤트 위임을 사용한 리스너
    if (mandalListEl) {
        const switchMandalHandler = (e) => {
            const li = e.target.closest('li');
            if (li && li.dataset.id) {
                const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
                mandalState.activeMandalArtId = li.dataset.id;
                data.updateMandalArtState(mandalState);
            }
        };
        mandalListEl.addEventListener('click', switchMandalHandler);
        activeEventListeners.push({ element: mandalListEl, type: 'click', handler: switchMandalHandler });

        const sidebarContextMenuHandler = (e) => {
            e.preventDefault();
            const li = e.target.closest('li');
            if (li) {
                contextMenuTarget.mandalId = li.dataset.id;
                sidebarContextMenuEl.style.display = 'block';
                sidebarContextMenuEl.style.top = `${e.clientY}px`;
                sidebarContextMenuEl.style.left = `${e.clientX}px`;
            }
        };
        mandalListEl.addEventListener('contextmenu', sidebarContextMenuHandler);
        activeEventListeners.push({ element: mandalListEl, type: 'contextmenu', handler: sidebarContextMenuHandler });
    }

    if (gridContainerEl) {
        // Grid 입력/수정 핸들러
        const gridInputHandler = (e) => {
            if (e.target.tagName !== 'TEXTAREA') return;
            
            const cellId = e.target.closest('.cell').dataset.id;
            const cellIndex = parseInt(cellId.split('-')[1]);
            
            const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
            const activeMandal = mandalState.mandalArts.find(m => m.id === mandalState.activeMandalArtId);
            if (!activeMandal) return;
            
            const cellData = activeMandal.cells.find(c => c.id === cellId);
            if (!cellData) return;
            
            cellData.content = e.target.value;

            // 중앙 목표 셀 수정 시
            if (cellIndex === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
                activeMandal.name = e.target.value;
                // UI 즉시 업데이트를 위해 사이드바만 다시 렌더링
                renderSidebar(); 
            } 
            // 8개 하위 목표 셀 수정 시
            else if (NINE_GRID_CONFIG.SYNC_MAP[cellIndex] !== undefined) {
                const targetCellIndex = NINE_GRID_CONFIG.SYNC_MAP[cellIndex];
                activeMandal.cells[targetCellIndex].content = e.target.value;
                const targetTextarea = gridContainerEl.querySelector(`[data-id="cell-${targetCellIndex}"] textarea`);
                if (targetTextarea) targetTextarea.value = e.target.value;
            }
            
            // 변경된 상태를 broadcast 없이 조용히 저장
            data.updateMandalArtState(mandalState, { broadcast: false });
        };
        gridContainerEl.addEventListener('input', gridInputHandler);
        activeEventListeners.push({ element: gridContainerEl, type: 'input', handler: gridInputHandler });

        // Grid 자동 스크롤 핸들러
        const gridBlurHandler = (e) => {
            if (e.target.tagName === 'TEXTAREA') e.target.scrollTop = 0;
        };
        gridContainerEl.addEventListener('blur', gridBlurHandler, true);
        activeEventListeners.push({ element: gridContainerEl, type: 'blur', handler: gridBlurHandler, options: true });

        // Grid 왼쪽 클릭 핸들러 (완료)
        const gridClickHandler = (e) => {
            const cellEl = e.target.closest('.cell');
            if (cellEl && e.target.tagName !== 'TEXTAREA') { // 셀 자체를 클릭했을 때
                const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
                const activeMandal = mandalState.mandalArts.find(m => m.id === mandalState.activeMandalArtId);
                const cellData = activeMandal.cells.find(c => c.id === cellEl.dataset.id);
                cellData.isCompleted = !cellData.isCompleted;
                data.updateMandalArtState(mandalState);
            }
        };
        gridContainerEl.addEventListener('click', gridClickHandler);
        activeEventListeners.push({ element: gridContainerEl, type: 'click', handler: gridClickHandler });

        // Grid 우클릭 핸들러
        const gridContextMenuHandler = (e) => {
            e.preventDefault();
            const cellEl = e.target.closest('.cell');
            if (cellEl) {
                contextMenuTarget.cellId = cellEl.dataset.id;
                cellContextMenuEl.style.display = 'block';
                cellContextMenuEl.style.top = `${e.clientY}px`;
                cellContextMenuEl.style.left = `${e.clientX}px`;
            }
        };
        gridContainerEl.addEventListener('contextmenu', gridContextMenuHandler);
        activeEventListeners.push({ element: gridContainerEl, type: 'contextmenu', handler: gridContextMenuHandler });

        // 전체 저장 단축키 핸들러
        const keydownHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleFullSave();
            }
        };
        document.addEventListener("keydown", keydownHandler);
        activeEventListeners.push({ target: document, type: 'keydown', handler: keydownHandler });
    }
    
    // 4. 컨텍스트 메뉴 리스너
    if (cellContextMenuEl) {
        const cellMenuClickHandler = (e) => {
            const action = e.target.closest('li')?.dataset.action;
            if (!action) return;

            const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
            const activeMandal = mandalState.mandalArts.find(m => m.id === mandalState.activeMandalArtId);
            const cellData = activeMandal.cells.find(c => c.id === contextMenuTarget.cellId);
            if (!cellData) return;

            switch (action) {
                case 'toggle-complete': cellData.isCompleted = !cellData.isCompleted; break;
                case 'highlight': cellData.isHighlighted = !cellData.isHighlighted; break;
                case 'delete-content': cellData.content = ''; break;
                case 'set-color': colorPicker.click(); return;
            }
            cellContextMenuEl.style.display = 'none';
            data.updateMandalArtState(mandalState);
        };
        cellContextMenuEl.addEventListener('click', cellMenuClickHandler);
        activeEventListeners.push({ element: cellContextMenuEl, type: 'click', handler: cellMenuClickHandler });
    }

    if (sidebarContextMenuEl) {
        sidebarContextMenuEl.addEventListener('click', (e) => {
            if (e.target.closest('li')?.dataset.action === 'delete-mandal') {
                handleDeleteMandal();
            }
            sidebarContextMenuEl.style.display = 'none';
        });
        activeEventListeners.push({ element: sidebarContextMenuEl, type: 'click', handler: (e)=>{/* ... */} });
    }

    if(colorPicker) {
        const colorChangeHandler = (e) => {
            const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
            const activeMandal = mandalState.mandalArts.find(m => m.id === mandalState.activeMandalArtId);
            const cellData = activeMandal.cells.find(c => c.id === contextMenuTarget.cellId);
            if(cellData) {
                cellData.color = e.target.value;
                data.updateMandalArtState(mandalState);
            }
        };
        colorPicker.addEventListener('input', colorChangeHandler);
        activeEventListeners.push({ element: colorPicker, type: 'input', handler: colorChangeHandler });
    }
    
    // 5. 전역 클릭 리스너 (메뉴 닫기)
    const globalClickHandler = () => {
        if (cellContextMenuEl) cellContextMenuEl.style.display = 'none';
        if (sidebarContextMenuEl) sidebarContextMenuEl.style.display = 'none';
    };
    window.addEventListener('click', globalClickHandler);
    activeEventListeners.push({ target: window, type: 'click', handler: globalClickHandler });

    // 첫 렌더링
    render();
}

export function cleanupMandalArtView() {
    console.log('[MandalArtViewHandler] 만다라트 뷰 정리');
    activeEventListeners.forEach(listener => {
        const target = listener.target || listener.element;
        if (target) {
            if (listener.isEventBus) {
                if (typeof target.off === 'function') {
                    target.off(listener.type, listener.handler);
                    console.log(`[MandalArtViewHandler] EventBus listener for '${listener.type}' removed.`);
                }
            } else {
                const options = listener.options || false;
                if (typeof target.removeEventListener === 'function') {
                    target.removeEventListener(listener.type, listener.handler, options);
                }
            }
        }
    });
    activeEventListeners.length = 0; // 배열 비우기
}