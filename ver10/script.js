document.addEventListener('DOMContentLoaded', () => {

    // --- DOM 요소 ---
    const mandalListEl = document.getElementById('mandal-list');
    const gridContainerEl = document.getElementById('mandal-art-grid');
    const addMandalBtn = document.getElementById('add-mandal-btn');
    const cellContextMenuEl = document.getElementById('context-menu');
    const sidebarContextMenuEl = document.getElementById('sidebar-context-menu');
    const colorPicker = document.getElementById('color-picker');

    // --- 9x9 그리드 상수 ---
    const NINE_GRID_CONFIG = {
        CENTRAL_GOAL_INDEX: 40,
        // ★ 수정 2: 팔레트에 text 색상 정보가 핵심
        PALETTE: {
            30: { bg: '#ffcdd2', text: '#000000' }, 31: { bg: '#ffe0b2', text: '#000000' },
            32: { bg: '#fff9c4', text: '#000000' }, 39: { bg: '#c8e6c9', text: '#000000' },
            40: { bg: '#ffffff', text: '#000000' }, 41: { bg: '#b3e5fc', text: '#000000' },
            48: { bg: '#c5cae9', text: '#000000' }, 49: { bg: '#e1bee7', text: '#000000' },
            50: { bg: '#212121', text: '#ffffff' }, // 검은 배경, 흰색 텍스트
        },
        SYNC_MAP: { 30: 10, 31: 13, 32: 16, 39: 37, 41: 43, 48: 64, 49: 67, 50: 70 },
    };

    // --- 통합 상태 관리 ---
    const state = {
        activeMandalArtId: 'mandal-1',
        contextMenuTargetCellId: null,
        contextMenuTargetMandalId: null,
        // ★ 수정 1: 5x5 만다라트 제거
        mandalArts: [
            { id: 'mandal-1', name: '🚀 2025년 목표', type: '9x9', cells: generateInitialCells(81) },
        ]
    };

    function generateInitialCells(count) {
        return Array.from({ length: count }, (_, i) => ({
            id: `cell-${i}`, content: '', isCompleted: false, isHighlighted: false, color: null
        }));
    }
    
    // --- 헬퍼 함수 ---
    /** ★ 수정 4: 특정 셀 인덱스가 속한 3x3 블록의 대표 색상을 찾는 함수 */
    function getRepresentativeColor(cellIndex) {
        const row = Math.floor(cellIndex / 9);
        const col = cellIndex % 9;
        const blockRow = Math.floor(row / 3);
        const blockCol = Math.floor(col / 3);
        // 중앙 목차 블록에서 해당하는 셀의 인덱스 계산
        const topicCellIndex = (blockRow + 3) * 9 + (blockCol + 3);
        return NINE_GRID_CONFIG.PALETTE[topicCellIndex]?.bg || '#ffffff'; // 색 정보가 없으면 흰색
    }

    // --- 렌더링 함수 ---
    function render() {
        renderSidebar();
        renderGrid();
    }

    function renderSidebar() {
        mandalListEl.innerHTML = '';
        state.mandalArts.forEach(mandal => {
            const li = document.createElement('li');
            li.textContent = mandal.name;
            li.dataset.id = mandal.id;
            if (mandal.id === state.activeMandalArtId) li.classList.add('active');
            
            li.addEventListener('contextmenu', handleSidebarContextMenu);
            mandalListEl.appendChild(li);
        });
    }

    function renderGrid() {
        gridContainerEl.innerHTML = '';
        const activeMandal = state.mandalArts.find(m => m.id === state.activeMandalArtId);
        if (!activeMandal) return;

        gridContainerEl.style.setProperty('--grid-size', 9);
        gridContainerEl.className = 'grid-container grid-9x9';

        activeMandal.cells.forEach((cellData, i) => {
            const cellEl = document.createElement('div');
            cellEl.className = 'cell';
            cellEl.dataset.id = cellData.id;
            
            const row = Math.floor(i / 9);
            const col = i % 9;
            const textarea = document.createElement('textarea');

            // 굵은 테두리 적용
            if ((col + 1) % 3 === 0 && col < 8) cellEl.classList.add('border-right-bold');
            if ((row + 1) % 3 === 0 && row < 8) cellEl.classList.add('border-bottom-bold');

            // 동기화되는 하위 목표 셀 처리
            const syncSourceIndex = Object.keys(NINE_GRID_CONFIG.SYNC_MAP).find(key => NINE_GRID_CONFIG.SYNC_MAP[key] === i);
            if (syncSourceIndex) {
                const sourceCellData = activeMandal.cells[syncSourceIndex];
                cellData.content = sourceCellData.content;
                cellEl.classList.add('sub-goal');
                textarea.readOnly = true;
            }

            // 중앙 목표 셀 처리
            if (i === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
                cellEl.classList.add('central-goal');
                activeMandal.cells[i].content = activeMandal.name;
            }

            // --- 색상 및 스타일 적용 (우선순위: 완료 > 사용자 지정 > 목차 팔레트 > 기본) ---

            // 1. 기본 목차 팔레트 적용
            const paletteInfo = NINE_GRID_CONFIG.PALETTE[i] || NINE_GRID_CONFIG.PALETTE[syncSourceIndex];
            if (paletteInfo) {
                cellEl.style.backgroundColor = paletteInfo.bg;
                // ★ 수정 2: textarea에 직접 글자색 적용
                textarea.style.color = paletteInfo.text;
            }
            
            // 2. 사용자 지정 색상이 있다면 덮어쓰기
            if (cellData.color) {
                cellEl.style.backgroundColor = cellData.color;
            }
            
            // ★ 수정 4: 완료 상태라면 대표 색상으로 덮어쓰기
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
    /** ★ 수정 1: 만다라트 생성 단순화 */
    function handleAddMandal() {
        const name = prompt("새 만다라트의 이름을 입력하세요:", "새 프로젝트");
        if (!name) return;

        const newId = `mandal-${Date.now()}`;
        const newMandal = { id: newId, name: name, type: '9x9', cells: generateInitialCells(81) };

        state.mandalArts.push(newMandal);
        state.activeMandalArtId = newId;
        render();
    }

    function handleDeleteMandal() {
        if (!state.contextMenuTargetMandalId) return;
        if (confirm(`'${state.mandalArts.find(m=>m.id === state.contextMenuTargetMandalId).name}' 만다라트를 정말 삭제하시겠습니까?`)) {
            state.mandalArts = state.mandalArts.filter(m => m.id !== state.contextMenuTargetMandalId);
            if (state.activeMandalArtId === state.contextMenuTargetMandalId) {
                state.activeMandalArtId = state.mandalArts.length > 0 ? state.mandalArts[0].id : null;
            }
            render();
        }
    }
    
    function handleSidebarContextMenu(e) {
        e.preventDefault();
        const li = e.target.closest('li');
        if (li) {
            state.contextMenuTargetMandalId = li.dataset.id;
            sidebarContextMenuEl.style.display = 'block';
            sidebarContextMenuEl.style.top = `${e.clientY}px`;
            sidebarContextMenuEl.style.left = `${e.clientX}px`;
        }
    }
    
    gridContainerEl.addEventListener('input', (e) => {
        if (e.target.tagName !== 'TEXTAREA') return;

        const cellEl = e.target.closest('.cell');
        const cellId = cellEl.dataset.id;
        const cellIndex = parseInt(cellId.split('-')[1]);
        
        const activeMandal = state.mandalArts.find(m => m.id === state.activeMandalArtId);
        const cellData = activeMandal.cells.find(c => c.id === cellId);
        cellData.content = e.target.value;

        if (NINE_GRID_CONFIG.SYNC_MAP[cellIndex] !== undefined) {
            const targetCellIndex = NINE_GRID_CONFIG.SYNC_MAP[cellIndex];
            activeMandal.cells[targetCellIndex].content = e.target.value;
            const targetCellEl = gridContainerEl.querySelector(`[data-id="cell-${targetCellIndex}"]`);
            if (targetCellEl) targetCellEl.querySelector('textarea').value = e.target.value;
        } else if (cellIndex === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
            activeMandal.name = e.target.value;
            renderSidebar();
        }
    });

    /** ★ 수정 3: blur 이벤트를 이용해 포커스가 사라질 때 스크롤을 맨 위로 이동 */
    gridContainerEl.addEventListener('blur', (e) => {
        if (e.target.tagName === 'TEXTAREA') {
            e.target.scrollTop = 0;
        }
    }, true); // 캡처링 단계에서 이벤트를 처리하기 위해 true 옵션 사용

    gridContainerEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('cell')) {
            const cellId = e.target.dataset.id;
            const activeMandal = state.mandalArts.find(m => m.id === state.activeMandalArtId);
            const cellData = activeMandal.cells.find(c => c.id === cellId);
            cellData.isCompleted = !cellData.isCompleted;
            render();
        }
    });
    
    gridContainerEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cellEl = e.target.closest('.cell');
        if (cellEl) {
            state.contextMenuTargetCellId = cellEl.dataset.id;
            cellContextMenuEl.style.display = 'block';
            cellContextMenuEl.style.top = `${e.clientY}px`;
            cellContextMenuEl.style.left = `${e.clientX}px`;
        }
    });

    cellContextMenuEl.addEventListener('click', (e) => {
        const action = e.target.closest('li')?.dataset.action;
        if (!action) return;
        const activeMandal = state.mandalArts.find(m => m.id === state.activeMandalArtId);
        const cellData = activeMandal.cells.find(c => c.id === state.contextMenuTargetCellId);
        if (!cellData) return;

        switch (action) {
            case 'toggle-complete': cellData.isCompleted = !cellData.isCompleted; break;
            case 'highlight': cellData.isHighlighted = !cellData.isHighlighted; break;
            case 'delete': cellData.content = ''; break;
            case 'set-color': colorPicker.click(); return;
        }
        cellContextMenuEl.style.display = 'none';
        render();
    });

    sidebarContextMenuEl.addEventListener('click', (e) => {
        const action = e.target.closest('li')?.dataset.action;
        if (action === 'delete') handleDeleteMandal();
        sidebarContextMenuEl.style.display = 'none';
    });
    
    colorPicker.addEventListener('input', (e) => {
        const activeMandal = state.mandalArts.find(m => m.id === state.activeMandalArtId);
        const cellData = activeMandal.cells.find(c => c.id === state.contextMenuTargetCellId);
        if (cellData) {
            cellData.color = e.target.value;
            cellContextMenuEl.style.display = 'none';
            render();
        }
    });
    
    window.addEventListener('click', () => {
        cellContextMenuEl.style.display = 'none';
        sidebarContextMenuEl.style.display = 'none';
    });

    // --- 이벤트 리스너 연결 및 초기화 ---
    addMandalBtn.addEventListener('click', handleAddMandal);
    mandalListEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            state.activeMandalArtId = e.target.dataset.id;
            render();
        }
    });

    render();
});