// projectTodos.js

const PROJECT_TODOS_LOCAL_STORAGE_KEY = 'timeLedgerProjectTodos_v4'; // Version bump
let projects = [];
let projectListContainerElement = null; // #project-todo-app-container
let projectsScrollAreaElement = null; // Div for scrollable project items
let addProjectBtnElement = null;      // Button to add new project
let onProjectDataChangeCallback = () => {};

let draggedProjectInfo = null; // { id, element, originalIndex } for project dragging

// --- Utility Functions ---
function generateId() { return '_' + Math.random().toString(36).substr(2, 9).slice(0,9); }

// --- Data Management ---
function saveProjectsToLocalBackup() {
    if (typeof localStorage !== 'undefined') {
        // Ensure isOpen state is preserved correctly
        const dataToSave = projects.map(p => ({...p, isOpen: p.isOpen || false }));
        localStorage.setItem(PROJECT_TODOS_LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    }
    onProjectDataChangeCallback();
}

function findProjectById(projectId) { return projects.find(p => p.id === projectId); }

// --- DOM Manipulation & Event Handlers for Sub-TODOs (createSubTodoElement, renderSubTodoList, getDragAfterElement for sub-todos) ---
// 이 부분은 이전 답변의 최종본과 동일하게 유지합니다. (번호 매기기, 삭제 버튼 호버, 중요도/시간 제거 등 반영된 상태)
// 단, renderSubTodoList 내에서 addSubTaskBtn이 subTodoListContainerElement의 마지막 자식으로 추가되도록 합니다.
let draggedTodo = null;
let draggedOverProject = null;

function calculateProjectCompletionStatus(project) { /* ... 이전과 동일 ... */
    if (!project.todos || project.todos.length === 0) return "0/0 (0%)";
    const completedCount = project.todos.filter(t => t.completed).length;
    const totalCount = project.todos.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return `${completedCount}/${totalCount} (${percentage}%)`;
}

function updateProjectCompletionDisplay(projectId) { /* ... 이전과 동일 ... */
    const project = findProjectById(projectId); if (!project) return;
    const projectWrapperElement = document.querySelector(`.project-item-wrapper[data-project-id="${projectId}"]`);
    if (projectWrapperElement) {
        const statusElement = projectWrapperElement.querySelector('.project-completion-status');
        if (statusElement) statusElement.textContent = calculateProjectCompletionStatus(project);
    }
}


function createSubTodoElement(todoItem, projectId, index) { /* ... 이전 답변의 최종본과 동일 ... */
    const project = findProjectById(projectId); if (!project) return null;
    const li = document.createElement('li'); li.className = `sub-todo-item ${todoItem.completed ? 'completed' : ''}`;
    li.dataset.todoId = todoItem.id; li.dataset.projectId = projectId; li.draggable = true;
    li.addEventListener('dragstart', (e) => { draggedTodo = { element: e.target, projectId: projectId, todoId: todoItem.id, originalIndex: project.todos.findIndex(t => t.id === todoItem.id) }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', todoItem.id); setTimeout(() => e.target.classList.add('dragging'), 0); });
    li.addEventListener('dragend', (e) => { e.target.classList.remove('dragging'); draggedTodo = null; draggedOverProject = null; document.querySelectorAll('.sub-todo-list-items').forEach(ul => ul.classList.remove('drag-over-active')); });
    const numberSpan = document.createElement('span'); numberSpan.className = 'sub-todo-number'; numberSpan.textContent = `${index + 1}. `;
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'sub-todo-checkbox'; checkbox.checked = todoItem.completed;
    checkbox.addEventListener('change', () => { todoItem.completed = checkbox.checked; li.classList.toggle('completed', todoItem.completed); const textInput = li.querySelector('.sub-todo-text-input'); if (textInput) textInput.classList.toggle('completed', todoItem.completed); updateProjectCompletionDisplay(projectId); saveProjectsToLocalBackup(); });
    const textInput = document.createElement('input'); textInput.type = 'text'; textInput.className = 'sub-todo-text-input'; if (todoItem.completed) textInput.classList.add('completed'); textInput.value = todoItem.text; textInput.placeholder = 'New task...';
    textInput.addEventListener('input', () => { todoItem.text = textInput.value; saveProjectsToLocalBackup(); });
    const controlsDiv = document.createElement('div'); controlsDiv.className = 'sub-todo-controls';
    const deleteButton = document.createElement('button'); deleteButton.className = 'sub-todo-delete-btn'; deleteButton.textContent = '✕'; deleteButton.title = "Delete task";
    deleteButton.addEventListener('click', () => { project.todos = project.todos.filter(t => t.id !== todoItem.id); saveProjectsToLocalBackup(); const projectWrapperElement = li.closest('.project-item-wrapper'); if(projectWrapperElement){ const subTodoListContainer = projectWrapperElement.querySelector('.sub-todo-list-container'); if(subTodoListContainer) renderSubTodoList(project, subTodoListContainer); } updateProjectCompletionDisplay(projectId); });
    controlsDiv.appendChild(deleteButton);
    li.appendChild(numberSpan); li.appendChild(checkbox); li.appendChild(textInput); li.appendChild(controlsDiv);
    return li;
}

function renderSubTodoList(project, subTodoListContainerElement) { /* ... 이전 답변의 최종본과 동일 (ul 드래그앤드롭 포함) ... */
    if (!subTodoListContainerElement) return; subTodoListContainerElement.innerHTML = '';
    const ul = document.createElement('ul'); ul.className = 'sub-todo-list-items';
    ul.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; ul.classList.add('drag-over-active'); draggedOverProject = project.id; const currentDragging = document.querySelector('.sub-todo-item.dragging'); if(currentDragging && currentDragging.dataset.projectId === project.id){ const afterElement = getDragAfterElement(ul, e.clientY); if (afterElement == null) { ul.appendChild(currentDragging); } else { ul.insertBefore(currentDragging, afterElement); } } });
    ul.addEventListener('dragleave', (e) => { if (!ul.contains(e.relatedTarget) && e.target === ul) { ul.classList.remove('drag-over-active'); if (draggedOverProject === project.id) draggedOverProject = null; } });
    ul.addEventListener('drop', (e) => { e.preventDefault(); ul.classList.remove('drag-over-active'); if (!draggedTodo || draggedOverProject !== project.id || draggedTodo.projectId !== project.id) { draggedTodo = null; draggedOverProject = null; return; } const targetProject = findProjectById(draggedTodo.projectId); if (!targetProject) { draggedTodo = null; return; } const todoToMove = targetProject.todos.find(t => t.id === draggedTodo.todoId); if (!todoToMove) { draggedTodo = null; return; } const originalTodosArray = [...targetProject.todos]; const itemToMove = originalTodosArray.find(t=> t.id === draggedTodo.todoId); const filteredArray = originalTodosArray.filter(t=> t.id !== draggedTodo.todoId); const childrenArray = Array.from(ul.children); let droppedElementIndex = childrenArray.findIndex(child => child.classList.contains('dragging')); if (draggedTodo.element.parentElement === ul) { const currentListOfLi = Array.from(ul.querySelectorAll('.sub-todo-item')); droppedElementIndex = currentListOfLi.indexOf(draggedTodo.element); } if (droppedElementIndex !== -1) { filteredArray.splice(droppedElementIndex, 0, itemToMove); targetProject.todos = filteredArray; } else { const oldIdx = targetProject.todos.findIndex(t => t.id === draggedTodo.todoId); if(oldIdx !== -1) targetProject.todos.splice(oldIdx, 1); targetProject.todos.push(itemToMove); } saveProjectsToLocalBackup(); renderSubTodoList(project, subTodoListContainerElement); updateProjectCompletionDisplay(project.id); draggedTodo = null; draggedOverProject = null; });
    if (project.todos && project.todos.length > 0) { project.todos.forEach((todoItem, index) => { const todoEl = createSubTodoElement(todoItem, project.id, index); if (todoEl) ul.appendChild(todoEl); }); }
    subTodoListContainerElement.appendChild(ul);
    const addSubTaskBtn = document.createElement('button'); addSubTaskBtn.className = 'add-sub-task-btn'; addSubTaskBtn.textContent = '+ Add Task';
    addSubTaskBtn.addEventListener('click', () => { const newSubTodo = { id: generateId(), text: '', completed: false }; project.todos.push(newSubTodo); saveProjectsToLocalBackup(); renderSubTodoList(project, subTodoListContainerElement); updateProjectCompletionDisplay(project.id); const newInputs = subTodoListContainerElement.querySelectorAll('.sub-todo-text-input'); if (newInputs.length > 0) { const lastInputContainer = newInputs[newInputs.length - 1].closest('.sub-todo-item'); if (lastInputContainer) { lastInputContainer.querySelector('.sub-todo-text-input').focus(); } } });
    subTodoListContainerElement.appendChild(addSubTaskBtn); // 버튼을 subTodoListContainerElement의 마지막 자식으로
}


function getDragAfterElement(container, y) { /* ... 이전과 동일 ... */
    const draggableElements = [...container.querySelectorAll('.project-item-wrapper:not(.dragging-project), .sub-todo-item:not(.dragging)')]; // Update selector if needed
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; }
        else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- DOM Manipulation & Event Handlers for Main Projects ---
function createProjectElement(project) {
    const projectWrapper = document.createElement('div');
    projectWrapper.className = `project-item-wrapper ${project.isOpen ? 'open' : ''}`;
    projectWrapper.dataset.projectId = project.id;
    projectWrapper.draggable = true; // Make project wrapper draggable

    // Project Drag and Drop Listeners
    projectWrapper.addEventListener('dragstart', (e) => {
        // Prevent dragging if an input field inside is focused or if a sub-todo is being dragged
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || document.querySelector('.dragging')) {
            e.preventDefault();
            return;
        }
        draggedProjectInfo = {
            id: project.id,
            element: projectWrapper,
            originalIndex: projects.findIndex(p => p.id === project.id)
        };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', project.id); // Mandatory for Firefox
        setTimeout(() => projectWrapper.classList.add('dragging-project'), 0);
    });

    projectWrapper.addEventListener('dragover', (e) => {
        if (!draggedProjectInfo || draggedProjectInfo.id === project.id) return;
        e.preventDefault();
        projectWrapper.classList.add('drag-over-project'); // Visual cue
    });

    projectWrapper.addEventListener('dragleave', (e) => {
        projectWrapper.classList.remove('drag-over-project');
    });

    projectWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedProjectInfo || draggedProjectInfo.id === project.id) return;
        projectWrapper.classList.remove('drag-over-project');

        const targetProjectId = project.id;
        const sourceProjectIndex = draggedProjectInfo.originalIndex;
        const projectToMove = projects.splice(sourceProjectIndex, 1)[0];

        if (projectToMove) {
            const targetProjectIndexInCurrentArray = projects.findIndex(p => p.id === targetProjectId);
            // Determine if dropping above or below the target's midpoint
            const rect = projectWrapper.getBoundingClientRect();
            const isDropOnUpperHalf = e.clientY < rect.top + rect.height / 2;

            if (isDropOnUpperHalf) {
                projects.splice(targetProjectIndexInCurrentArray, 0, projectToMove);
            } else {
                projects.splice(targetProjectIndexInCurrentArray + 1, 0, projectToMove);
            }
        }
        saveProjectsToLocalBackup();
        renderProjectListInternal();
        draggedProjectInfo = null;
    });

    projectWrapper.addEventListener('dragend', (e) => {
        projectWrapper.classList.remove('dragging-project');
        document.querySelectorAll('.drag-over-project').forEach(el => el.classList.remove('drag-over-project'));
        draggedProjectInfo = null;
    });


    const projectHeader = document.createElement('div');
    projectHeader.className = 'project-header';
    // ... (projectHeader 내용 및 이벤트 리스너는 이전 답변과 동일: 이름 표시/편집, 삭제 버튼, 완료율) ...
    const projectNameSpan = document.createElement('span'); projectNameSpan.className = 'project-name-text'; projectNameSpan.textContent = project.name || 'New Project';
    projectHeader.addEventListener('click', (e) => {
        if (e.target.closest('.project-action-btn') || e.target.classList.contains('project-name-input')) {
            return;
        }
        
        const currentlyOpen = project.isOpen; // 현재 상태 저장
        // Accordion: 다른 모든 프로젝트를 닫는다.
        projects.forEach(p => {
            p.isOpen = false;
        });
        // 클릭된 프로젝트의 상태를 토글 (만약 이미 열려있었다면 닫힘)
        project.isOpen = !currentlyOpen; 

        saveProjectsToLocalBackup();
        renderProjectListInternal(); // 전체 리스트를 다시 그려서 상태 반영
    });
    const projectControlsDiv = document.createElement('div'); projectControlsDiv.className = 'project-header-controls';
    const editNameBtn = document.createElement('button'); editNameBtn.className = 'project-action-btn edit-project-name-btn'; editNameBtn.innerHTML = '✏️'; editNameBtn.title = "Rename project";
    editNameBtn.addEventListener('click', (e) => { e.stopPropagation(); projectNameSpan.style.display = 'none'; projectControlsDiv.style.display = 'none'; const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.className = 'project-name-input'; nameInput.value = project.name; projectHeader.insertBefore(nameInput, completionStatusSpan); nameInput.focus(); nameInput.select(); const saveName = () => { const newName = nameInput.value.trim(); if (newName && newName !== project.name) { project.name = newName; saveProjectsToLocalBackup(); } projectNameSpan.textContent = project.name || 'New Project'; if (projectHeader.contains(nameInput)) projectHeader.removeChild(nameInput); projectNameSpan.style.display = ''; projectControlsDiv.style.display = ''; }; nameInput.addEventListener('blur', saveName); nameInput.addEventListener('keypress', (keyEvent) => { if (keyEvent.key === 'Enter') nameInput.blur(); }); });
    const deleteProjectBtn = document.createElement('button'); deleteProjectBtn.className = 'project-action-btn delete-project-btn'; deleteProjectBtn.innerHTML = '🗑️'; deleteProjectBtn.title = "Delete project";
    deleteProjectBtn.addEventListener('click', (e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to delete project "${project.name}" and all its tasks?`)) { projects = projects.filter(p => p.id !== project.id); saveProjectsToLocalBackup(); renderProjectListInternal(); } });
    projectControlsDiv.appendChild(editNameBtn); projectControlsDiv.appendChild(deleteProjectBtn);
    const completionStatusSpan = document.createElement('span'); completionStatusSpan.className = 'project-completion-status'; completionStatusSpan.textContent = calculateProjectCompletionStatus(project);
    projectHeader.appendChild(projectNameSpan); projectHeader.appendChild(projectControlsDiv); projectHeader.appendChild(completionStatusSpan);

    const subTodoListContainer = document.createElement('div');
    subTodoListContainer.className = 'sub-todo-list-container';
    if (project.isOpen) { // isOpen 상태에 따라 초기 렌더링 결정
        renderSubTodoList(project, subTodoListContainer);
    }

    projectWrapper.appendChild(projectHeader);
    projectWrapper.appendChild(subTodoListContainer);
    return projectWrapper;
}

function renderProjectListInternal() {
    if (!projectListContainerElement) return;

    // Add Project 버튼은 projectListContainerElement의 직접 자식으로 유지, 스크롤 영역 외부에 위치
    if (addProjectBtnElement) addProjectBtnElement.remove(); // 기존 버튼 제거
    
    if (!projectsScrollAreaElement || !projectListContainerElement.contains(projectsScrollAreaElement)) {
        projectListContainerElement.innerHTML = ''; // 기존 컨테이너 클리어
        projectsScrollAreaElement = document.createElement('div');
        projectsScrollAreaElement.className = 'projects-scroll-area';
        projectListContainerElement.appendChild(projectsScrollAreaElement);
    }
    // 버튼이 scrollArea 내부에 있다면 먼저 제거
    let oldAddProjectBtnInScrollArea = projectsScrollAreaElement.querySelector('#add-project-btn');
    if(oldAddProjectBtnInScrollArea) oldAddProjectBtnInScrollArea.remove();

    projectsScrollAreaElement.innerHTML = ''; // 프로젝트 아이템들만 클리어

    if (projects.length === 0) {
        projects.push({ id: generateId(), name: 'My First Project List', isOpen: false, todos: [{ id: generateId(), text: 'Add a task!', completed: false }] });
        // saveProjectsToLocalBackup(); // 기본 프로젝트 추가 시 저장할지 여부 결정
    }

    projects.forEach(project => {
        // project.isOpen = false; // 페이지 로드 시 모든 프로젝트를 닫힌 상태로 (요청 5) - init에서 처리
        projectsScrollAreaElement.appendChild(createProjectElement(project));
    });

    addProjectBtnElement = document.createElement('button');
    addProjectBtnElement.id = 'add-project-btn';
    addProjectBtnElement.textContent = '+ New Project List';
    addProjectBtnElement.addEventListener('click', () => { /* ... (add project logic as before, focus new project) ... */
        const newProjectName = `Project ${projects.length + 1}`;
        const newProject = { id: generateId(), name: newProjectName, isOpen: false, todos: [{ id: generateId(), text: 'New task', completed: false }] };
        projects.push(newProject); saveProjectsToLocalBackup(); renderProjectListInternal();
        const newProjectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${newProject.id}"]`);
        if(newProjectWrapper) { const editBtn = newProjectWrapper.querySelector('.edit-project-name-btn'); if(editBtn) { setTimeout(() => editBtn.click(), 0); } } // 약간의 지연 후 클릭
    });
    projectsScrollAreaElement.appendChild(addProjectBtnElement);
}


// --- Exported Functions ---
export function initProjectTodoApp(containerSelector, initialData = null, dataChangedCallback = () => {}) {
    const container = document.querySelector(containerSelector);
    if (!container) { console.error(`Project TODO app container "${containerSelector}" not found.`); return; }
    projectListContainerElement = container; 
    onProjectDataChangeCallback = dataChangedCallback;

    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
        projects = initialData.map(p => ({ 
            ...p, 
            isOpen: false, // 로드 시 모든 프로젝트 닫힘
            todos: p.todos ? p.todos.map(t => ({ id: t.id, text: t.text, completed: t.completed })) : [] 
        }));
    } else {
        // ... (로컬 스토리지 로드 또는 기본값 설정 로직, 모두 isOpen: false 로 설정) ...
        const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(PROJECT_TODOS_LOCAL_STORAGE_KEY) : null;
        if (stored) {
            try {
                const parsedProjects = JSON.parse(stored);
                projects = parsedProjects.map(p => ({ ...p, isOpen: false, todos: p.todos ? p.todos.map(t => ({ id: t.id, text: t.text, completed: t.completed })) : [] }));
            } catch(e) { projects = []; }
        }
        if (projects.length === 0) { // 기본값 설정 시에도 isOpen: false
            projects = [
                { id: generateId(), name: "Work Tasks", isOpen: false, todos: [{id: generateId(), text: "Prepare presentation", completed: false},{id: generateId(), text: "Send weekly update", completed: true}]},
                { id: generateId(), name: "Home Errands", isOpen: false, todos: [{id: generateId(), text: "Buy groceries", completed: false}]},
                { id: generateId(), name: "Learning Goals", isOpen: false, todos: [] }
            ];
        }
    }
    projects.forEach(p => p.isOpen = false); // 확실하게 모든 프로젝트를 닫힌 상태로 시작
    saveProjectsToLocalBackup(); 
    renderProjectListInternal();
}

export function setProjectTodoDataAndRender(newData) {
    projects = Array.isArray(newData) ? newData.map(p => ({ ...p, isOpen: false, todos: p.todos ? p.todos.map(t => ({ id: t.id, text: t.text, completed: t.completed })) : [] })) : [];
    saveProjectsToLocalBackup(); 
    renderProjectListInternal();
}

export function getProjectTodoData() {
    return JSON.parse(JSON.stringify(projects));
}