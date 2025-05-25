// projectTodos.js
const PROJECT_TODOS_STORAGE_KEY = 'projectTodos_v_fresh_start_1';

// --- 전역 변수 ---
let projects = [];
let onDataChangeCallback = () => {};


// --- 모듈 UI 상세 변수 --- 
let projectListContainerElement = null; // #project-todo-app-container (CSS에서 .left-pane-top)
let projectsScrollAreaElement = null;   // 프로젝트 아이템들을 담고 스크롤될 영역
let addProjectBtnElement = null;
let floatingDropdownElement = null;     // 투두 목록을 보여줄 단일 플로팅 div
let openProjectId = null;               // 현재 열려있는 프로젝트의 ID

// --- 드래그 상태 변수 ---
let draggedProjectInfo = null; // { id, element } - 프로젝트 드래그용
let draggedSubTodoInfo = null; // { projectId, todoId, element } - 서브 투두 드래그용

// --- 유틸리티 함수 ---
function generateId(prefix = 'id_') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

// --- 프로젝트 데이터 관련 헬퍼 함수 ---
function findProjectById(projectId) {
    return projects.find(p => p.id === projectId);
}

// --- 데이터 변경 알림 ---
/**
 * 데이터에 변경이 있을 때마다 호출됩니다.
 * localStorage에 직접 저장하는 대신, main.js에 정의된 콜백을 호출하여
 * 전체 애플리케이션 상태가 저장되도록 합니다.
 */
function notifyDataChange() {
    onDataChangeCallback();
}

// --- 데이터 저장 및 로드 ---
function saveProjects() {
    localStorage.setItem(PROJECT_TODOS_STORAGE_KEY, JSON.stringify(projects));
    onDataChangeCallback(); // 외부 콜백 호출 (예: 메인 앱 상태 저장)
}

function loadProjects() {
    const storedData = localStorage.getItem(PROJECT_TODOS_STORAGE_KEY);
    if (storedData) {
        try {
            projects = JSON.parse(storedData);
            // 데이터 무결성 검사 및 ID 할당
            projects.forEach(p => {
                p.id = p.id || generateId('proj_');
                p.todos = p.todos || [];
                p.todos.forEach(t => {
                    t.id = t.id || generateId('todo_');
                });
            });
        } catch (e) {
            console.error("Error parsing projects from localStorage:", e);
            projects = [];
        }
    } else {
        projects = []; // 저장된 데이터 없으면 빈 배열로 시작
    }
}

// --- 핵심 DOM 렌더링 함수 ---

// 프로젝트 목록 전체 (스크롤 영역 내부) 렌더링
function renderProjectList() {
    if (!projectsScrollAreaElement) return;

    const currentScroll = projectsScrollAreaElement.scrollTop; // 스크롤 위치 기억
    projectsScrollAreaElement.innerHTML = ''; // 기존 내용 지우기

    projects.forEach(project => {
        const projectEl = createProjectElement(project);
        projectsScrollAreaElement.appendChild(projectEl);
    });

    // "+ New Project List" 버튼 추가 (항상 마지막에)
    if (addProjectBtnElement) { // 버튼이 init에서 생성되었는지 확인
        projectsScrollAreaElement.appendChild(addProjectBtnElement);
    }
    projectsScrollAreaElement.scrollTop = currentScroll; // 스크롤 위치 복원
}

// 개별 프로젝트 아이템(헤더) DOM 생성
function createProjectElement(project) {
    const wrapper = document.createElement('div');
    wrapper.className = `project-item-wrapper ${project.id === openProjectId ? 'open' : ''}`;
    wrapper.dataset.projectId = project.id;
    wrapper.draggable = true;

    const header = document.createElement('div');
    header.className = 'project-header';

    const arrow = document.createElement('span');
    arrow.className = 'project-arrow';
    arrow.textContent = '▶';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'project-name';
    nameSpan.textContent = project.name || 'Unnamed Project';
    nameSpan.title = project.name || 'Unnamed Project';
    nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        editProjectName(project, nameSpan);
    });

    const completionSpan = document.createElement('span');
    completionSpan.className = 'project-completion';
    // updateProjectCompletionDisplay 호출은 project.todos가 확정된 후 또는 데이터 변경 시
    // 초기 렌더링 시에도 호출
    updateProjectCompletionDisplay(project, completionSpan);


    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'project-controls';

    const editBtn = document.createElement('button');
    editBtn.className = 'project-action-btn project-edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Rename Project';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editProjectName(project, nameSpan);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'project-action-btn project-delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete Project';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete project "${project.name || 'this project'}"?`)) {
            if (project.id === openProjectId) {
                hideFloatingDropdown();
            }
            projects = projects.filter(p => p.id !== project.id);
            notifyDataChange();
            renderProjectList(); // Re-render the whole list
        }
    });

    controlsDiv.appendChild(editBtn);
    controlsDiv.appendChild(deleteBtn);

    header.appendChild(arrow);
    header.appendChild(nameSpan);
    header.appendChild(completionSpan);
    header.appendChild(controlsDiv);
    wrapper.appendChild(header);

    header.addEventListener('click', () => {
        // createProjectElement 스코프의 project.id, header, wrapper를 전달
        handleProjectHeaderClick(project.id, header, wrapper);
    });

    // Project Drag & Drop
    wrapper.addEventListener('dragstart', (e) => handleProjectDragStart(e, project, wrapper));
    wrapper.addEventListener('dragend', () => handleProjectDragEnd(wrapper));

    return wrapper;
}

function editProjectName(project, nameSpanElement) {
    if (project.id === openProjectId) {
        hideFloatingDropdown();
    }
    const currentName = project.name;
    const newName = prompt("Enter new project name:", currentName);
    if (newName !== null && newName.trim() !== "") {
        project.name = newName.trim();
        nameSpanElement.textContent = project.name;
        nameSpanElement.title = project.name; // title도 업데이트
        notifyDataChange();
    } else if (newName !== null && newName.trim() === "" && currentName !== "Unnamed Project") {
        // 사용자가 빈 이름을 입력했지만 원래 이름이 "Unnamed Project"가 아니었다면, 기본 이름으로 변경
        project.name = "Unnamed Project";
        nameSpanElement.textContent = project.name;
        nameSpanElement.title = project.name;
        notifyDataChange();
    }
}


// 플로팅 드롭다운에 특정 프로젝트의 투두 목록 렌더링
function renderTodosInDropdown(project) {
    if (!floatingDropdownElement || !project) {
        console.error("renderTodosInDropdown: Invalid project or floating container.", project, floatingDropdownElement);
        return;
    }
    floatingDropdownElement.innerHTML = ''; // 이전 내용 지우기

    const todoListUl = document.createElement('ul');
    todoListUl.className = 'sub-todo-list';
    todoListUl.dataset.projectId = project.id;

    if (project.todos && project.todos.length > 0) {
        project.todos.forEach((todo, index) => {
            const todoEl = createSubTodoElement(todo, project.id, index);
            todoListUl.appendChild(todoEl);
        });
    }
    floatingDropdownElement.appendChild(todoListUl);

    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-sub-task-btn';
    addTaskBtn.textContent = '+ Add Task';
    addTaskBtn.addEventListener('click', () => {
        // 1. 데이터 업데이트
        const newTodo = { id: generateId('todo_'), text: 'New Task', completed: false };
        project.todos.push(newTodo);
        notifyDataChange();

        // 2. UI 다시 렌더링 (이 시점에서 기존 DOM 참조는 무효화됨)
        renderTodosInDropdown(project);

        // 3. 프로젝트 진행률 업데이트
        const projectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${project.id}"]`);
        if (projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.project-completion'));
        }

        // --- FIX START ---
        // 4. 새로 렌더링된 UI에서 새 task 요소를 찾아 편집 모드로 전환
        // 다시 렌더링되었으므로, floatingDropdownElement에서 새로 생성된 ul을 다시 찾아야 합니다.
        const newTodoListUl = floatingDropdownElement.querySelector('.sub-todo-list');
        if (!newTodoListUl) return;

        // 새로 생성된 ul에서 마지막 li 요소를 찾습니다. 이것이 방금 추가한 task입니다.
        const newTodoElement = newTodoListUl.querySelector('.sub-todo-item:last-of-type');
        
        if (newTodoElement) {
            const textSpanToEdit = newTodoElement.querySelector('.sub-todo-text');
            const deleteBtnOfNew = newTodoElement.querySelector('.sub-todo-delete-btn');
            // 데이터 배열에서 마지막 todo 객체를 가져옵니다.
            const todoObject = project.todos[project.todos.length - 1]; 
            
            if (textSpanToEdit && deleteBtnOfNew && todoObject) {
                 // 편집 함수를 호출하여 바로 입력할 수 있도록 만듭니다.
                 makeTodoTextEditable(todoObject, textSpanToEdit, deleteBtnOfNew);
            }
        }
        // --- FIX END ---
    });
    floatingDropdownElement.appendChild(addTaskBtn);

    // 서브 투두 드래그 앤 드롭 리스너 (UL에)
    todoListUl.addEventListener('dragover', (e) => handleSubTodoDragOver(e, project.id));
    todoListUl.addEventListener('drop', (e) => handleSubTodoDrop(e, project.id, todoListUl));
}

// 개별 서브 투두 아이템 DOM 생성
function createSubTodoElement(todo, projectId, index) {
    const li = document.createElement('li');
    li.className = `sub-todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.todoId = todo.id;
    li.draggable = true;

    const numberSpan = document.createElement('span');
    numberSpan.className = 'sub-todo-number';
    numberSpan.textContent = `${index + 1}. `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sub-todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
        todo.completed = checkbox.checked;
        li.classList.toggle('completed', todo.completed);
        if(textSpan) textSpan.classList.toggle('completed', todo.completed);
        const project = findProjectById(projectId);
        const projectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${projectId}"]`);
        if (project && projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.project-completion'));
        }
        notifyDataChange();
    });

    const textSpan = document.createElement('span');
    textSpan.className = 'sub-todo-text';
    textSpan.textContent = todo.text || 'New Task';
    if (todo.completed) textSpan.classList.add('completed');

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'sub-todo-delete-btn project-action-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Delete Task';
    deleteBtn.addEventListener('click', () => {
        const project = findProjectById(projectId);
        if (!project) return;
        project.todos = project.todos.filter(t => t.id !== todo.id);
        notifyDataChange();
        renderTodosInDropdown(project); // 현재 드롭다운 다시 그리기
        const projectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${projectId}"]`);
        if (projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.project-completion'));
        }
    });

    textSpan.addEventListener('dblclick', () => {
        makeTodoTextEditable(todo, textSpan, deleteBtn);
    });


    li.appendChild(numberSpan);
    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);

    // 서브 투두 드래그 이벤트
    li.addEventListener('dragstart', (e) => handleSubTodoDragStart(e, projectId, todo.id, li));
    li.addEventListener('dragend', () => handleSubTodoDragEnd(li));

    return li;
}

function makeTodoTextEditable(todo, textSpanElement, nextSiblingForInput) {
    if (textSpanElement.style.display === 'none') return; // 이미 편집 중이면 중복 실행 방지

    textSpanElement.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sub-todo-text-edit';
    input.value = todo.text;

    textSpanElement.parentElement.insertBefore(input, nextSiblingForInput);
    input.focus();
    input.select();

    const saveTodoText = () => {
        const newText = input.value.trim();
        todo.text = newText === "" ? (todo.text || "New Task") : newText; // 빈칸이면 이전 값 유지 또는 기본값
        textSpanElement.textContent = todo.text;
        textSpanElement.style.display = '';
        if (input.parentElement) {
            input.parentElement.removeChild(input);
        }
        notifyDataChange();
    };
    input.addEventListener('blur', saveTodoText);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape'){
            input.value = todo.text; // 원래 값으로 되돌리고 blur
            input.blur();
        }
    });
}

// --- 드롭다운 위치 및 표시/숨김 ---
function handleProjectHeaderClick(projectId, headerElement, wrapperElement) {
    const project = findProjectById(projectId); // <<< 오류 발생 지점
    if (!project) {
        console.error("Project not found for ID:", projectId);
        return;
    }

    if (openProjectId === projectId) {
        hideFloatingDropdown();
    } else {
        if (openProjectId) { // 다른 프로젝트가 열려 있었다면, 해당 UI 닫기 처리
            const previouslyOpenWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${openProjectId}"]`);
            previouslyOpenWrapper?.classList.remove('open');
        }
        openProjectId = projectId;
        wrapperElement.classList.add('open');
        renderTodosInDropdown(project);
        positionAndShowDropdown(headerElement);
    }
}

function positionAndShowDropdown(headerElement) {
    if (!floatingDropdownElement || !headerElement || !projectListContainerElement) return;

    const headerRect = headerElement.getBoundingClientRect();

    // position: 'fixed' 이므로 뷰포트 기준 좌표를 바로 사용
    floatingDropdownElement.style.top = `${headerRect.bottom}px`;
    floatingDropdownElement.style.left = `${headerRect.left}px`;
    floatingDropdownElement.style.width = `${headerRect.width}px`;
    floatingDropdownElement.style.display = 'block';
}

function hideFloatingDropdown() {
    if (floatingDropdownElement) {
        floatingDropdownElement.style.display = 'none';
        floatingDropdownElement.innerHTML = '';
    }
    if (openProjectId && projectsScrollAreaElement) {
        const openWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${openProjectId}"]`);
        openWrapper?.classList.remove('open');
    }
    openProjectId = null;
    // saveProjects(); // 호출하는 쪽에서 필요 시 save 호출하도록 변경 (중복 방지)
}

// --- 완료 상태 업데이트 ---
function updateProjectCompletionDisplay(project, completionSpanElement) {
    if (!project || !completionSpanElement) return;
    const totalTodos = project.todos ? project.todos.length : 0;
    const completedTodos = project.todos ? project.todos.filter(t => t.completed).length : 0;
    const percentage = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    completionSpanElement.textContent = `${completedTodos}/${totalTodos} (${percentage}%)`;
}


// --- 드래그 앤 드롭 핸들러 ---
// Project Dragging
function handleProjectDragStart(event, project, projectElement) {
    if (event.target.matches('input, button, [contenteditable=true], .project-action-btn')) {
        event.preventDefault(); return;
    }
    event.stopPropagation();
    draggedProjectInfo = { id: project.id, element: projectElement };
    event.dataTransfer.setData('text/plain', project.id);
    event.dataTransfer.effectAllowed = 'move';
    projectElement.classList.add('dragging-project');
    if (project.id === openProjectId) {
        hideFloatingDropdown();
    }
}

function handleProjectDragEnd(projectElement) {
    if (projectElement) projectElement.classList.remove('dragging-project'); // Null check
    projectsScrollAreaElement?.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });
    draggedProjectInfo = null;
}

function handleProjectsScrollAreaDragOver(event) {
    event.preventDefault();
    if (!draggedProjectInfo) return;
    event.dataTransfer.dropEffect = 'move';

    projectsScrollAreaElement.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });

    const afterElement = getDragAfterProject(event.clientY);
    const draggingElement = draggedProjectInfo.element;

    if (afterElement && afterElement !== draggingElement) {
        const rect = afterElement.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
            afterElement.classList.add('drag-over-project-top');
        } else {
            afterElement.classList.add('drag-over-project-bottom');
        }
    } else if (!afterElement && projects.length > 0) {
        const lastVisibleProjectElement = projectsScrollAreaElement.querySelector('.project-item-wrapper:not(.dragging-project):last-of-type');
        if (lastVisibleProjectElement && lastVisibleProjectElement !== draggingElement) {
            lastVisibleProjectElement.classList.add('drag-over-project-bottom');
        }
    }
}

function handleProjectsScrollAreaDrop(event) {
    event.preventDefault();
    if (!draggedProjectInfo) return;

    projectsScrollAreaElement.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });

    const draggedId = draggedProjectInfo.id;
    const oldProjectIndex = projects.findIndex(p => p.id === draggedId);
    if (oldProjectIndex === -1) { draggedProjectInfo = null; return; }

    const [movedProjectData] = projects.splice(oldProjectIndex, 1);
    const afterElement = getDragAfterProject(event.clientY);

    if (afterElement) {
        const afterElementId = afterElement.dataset.projectId;
        let targetIndexInArray = projects.findIndex(p => p.id === afterElementId);
        if (targetIndexInArray === -1) {
            projects.push(movedProjectData);
        } else {
            const rect = afterElement.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                projects.splice(targetIndexInArray, 0, movedProjectData);
            } else {
                projects.splice(targetIndexInArray + 1, 0, movedProjectData);
            }
        }
    } else {
        projects.push(movedProjectData);
    }

    draggedProjectInfo = null; // Clear after successful operation
    notifyDataChange();
    renderProjectList();
}

function getDragAfterProject(y) {
    const projectElements = [...projectsScrollAreaElement.querySelectorAll('.project-item-wrapper:not(.dragging-project)')];
    return projectElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// Sub-Todo Dragging
function handleSubTodoDragStart(event, projectId, todoId, todoElement) {
    event.stopPropagation();
    draggedSubTodoInfo = { projectId, todoId, element: todoElement };
    event.dataTransfer.setData('text/plain', todoId);
    event.dataTransfer.effectAllowed = 'move';
    todoElement.classList.add('dragging-sub-todo');
}

function handleSubTodoDragEnd(todoElement) {
    if (todoElement) todoElement.classList.remove('dragging-sub-todo');
    // draggedSubTodoInfo is cleared in the drop handler
}

function handleSubTodoDragOver(event, targetProjectId) {
    event.preventDefault();
    if (!draggedSubTodoInfo || draggedSubTodoInfo.projectId !== targetProjectId) return;
    event.dataTransfer.dropEffect = 'move';

    const ul = event.currentTarget;
    const afterElement = getDragAfterSubTodo(ul, event.clientY);
    const draggingElement = draggedSubTodoInfo.element;
    // Visual feedback for sub-todo drop position
    ul.querySelectorAll('.sub-todo-item').forEach(item => {
        item.classList.remove('drag-over-sub-todo-top', 'drag-over-sub-todo-bottom');
    });

    if (afterElement && afterElement !== draggingElement) {
        const rect = afterElement.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
            afterElement.classList.add('drag-over-sub-todo-top');
        } else {
            afterElement.classList.add('drag-over-sub-todo-bottom');
        }
         // Move element for instant feedback, array updated on drop
        // if (afterElement) ul.insertBefore(draggingElement, afterElement); else ul.appendChild(draggingElement);
    } else if (!afterElement && draggingElement.parentElement === ul) { // dragging to the end
        const lastItem = ul.querySelector('.sub-todo-item:not(.dragging-sub-todo):last-child');
        if(lastItem && lastItem !== draggingElement) lastItem.classList.add('drag-over-sub-todo-bottom');
        // ul.appendChild(draggingElement);
    }
     // Actual DOM move for live feedback (careful with array sync on drop)
    const actualDraggingElement = draggedSubTodoInfo.element;
    if (actualDraggingElement.parentElement === ul) { // Ensure it's part of this list
        if (afterElement) {
            if (afterElement !== actualDraggingElement) ul.insertBefore(actualDraggingElement, afterElement);
        } else {
            ul.appendChild(actualDraggingElement);
        }
    }

}

function handleSubTodoDrop(event, targetProjectId, todoListUl) {
    event.preventDefault();
    todoListUl.querySelectorAll('.sub-todo-item').forEach(item => { // Clear all indicators
        item.classList.remove('drag-over-sub-todo-top', 'drag-over-sub-todo-bottom');
    });
    if (!draggedSubTodoInfo || draggedSubTodoInfo.projectId !== targetProjectId) {
        draggedSubTodoInfo = null; return;
    }

    const project = findProjectById(targetProjectId);
    if (!project) { draggedSubTodoInfo = null; return; }

    const todoId = draggedSubTodoInfo.todoId;
    const oldArrayIndex = project.todos.findIndex(t => t.id === todoId);
    if (oldArrayIndex === -1) { draggedSubTodoInfo = null; return; }

    const [movedTodo] = project.todos.splice(oldArrayIndex, 1);

    // New index based on final DOM position of the dragged element
    const newDomIndex = Array.from(todoListUl.children).indexOf(draggedSubTodoInfo.element);

    if (newDomIndex === -1) { // Should not happen if element is child of todoListUl
        project.todos.push(movedTodo); // Fallback: add to end of array
    } else {
        project.todos.splice(newDomIndex, 0, movedTodo);
    }

    draggedSubTodoInfo = null; // Clear drag state
    saveProjects();
    renderTodosInDropdown(project); // Re-render current dropdown to update numbers & reflect order
    const projectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${project.id}"]`);
    if (projectWrapper) {
        updateProjectCompletionDisplay(project, projectWrapper.querySelector('.project-completion'));
    }
}


function getDragAfterSubTodo(ulElement, y) {
    const todoElements = [...ulElement.querySelectorAll('.sub-todo-item:not(.dragging-sub-todo)')];
    return todoElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// --- 초기화 ---
export function initProjectTodoApp(containerSelector, initialExternalData = null, dataChangeCb = () => {}) {
    projectListContainerElement = document.querySelector(containerSelector);
    if (!projectListContainerElement) {
        console.error("Project todo app container not found:", containerSelector);
        return;
    }
    onDataChangeCallback = dataChangeCb;

    // 1. 스크롤 영역 생성
    projectsScrollAreaElement = document.createElement('div');
    projectsScrollAreaElement.className = 'projects-scroll-area';
    projectListContainerElement.appendChild(projectsScrollAreaElement);

    // 2. 플로팅 드롭다운 생성 (최초 한 번만)
    if (!floatingDropdownElement) {
        floatingDropdownElement = document.createElement('div');
        floatingDropdownElement.id = 'floating-project-dropdown';
        floatingDropdownElement.className = 'sub-todo-list-container floating-dropdown';
        floatingDropdownElement.style.display = 'none';
        floatingDropdownElement.style.position = 'fixed';
        floatingDropdownElement.style.zIndex = '1001';
        document.body.appendChild(floatingDropdownElement);
    }

    // 3. "Add Project" 버튼 생성
    addProjectBtnElement = document.createElement('button');
    addProjectBtnElement.id = 'add-project-btn';
    addProjectBtnElement.textContent = '+ New Project List';
    addProjectBtnElement.addEventListener('click', () => {
        if (openProjectId) {
            hideFloatingDropdown();
        }
        const newProjectName = `Project ${projects.length + 1}`;
        const newProject = { id: generateId('proj_'), name: newProjectName, todos: [] };
        projects.push(newProject);
        notifyDataChange();
        renderProjectList();
        const newProjectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${newProject.id}"]`);
        if (newProjectWrapper) {
            newProjectWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const nameSpan = newProjectWrapper.querySelector('.project-name');
            if (nameSpan) {
                setTimeout(() => editProjectName(newProject, nameSpan), 100);
            }
        }
    });

    // 4. 전역 이벤트 리스너 설정
    document.addEventListener('click', (event) => {
        if (!floatingDropdownElement || floatingDropdownElement.style.display === 'none' || !projectsScrollAreaElement) return;
        const isClickInsideDropdown = floatingDropdownElement.contains(event.target);
        const openProjectHeaderElement = openProjectId ? projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${openProjectId}"] .project-header`) : null;
        const isClickOnOpenHeader = openProjectHeaderElement ? openProjectHeaderElement.contains(event.target) : false;
        const isClickOnEditInput = event.target.matches('.project-name-input, .sub-todo-text-edit');
        if (!isClickInsideDropdown && !isClickOnOpenHeader && !isClickOnEditInput) {
            hideFloatingDropdown();
        }
    }, true);

    projectsScrollAreaElement.addEventListener('scroll', () => {
        if (openProjectId && floatingDropdownElement.style.display !== 'none') {
            const openProjectWrapper = projectsScrollAreaElement.querySelector(`.project-item-wrapper[data-project-id="${openProjectId}"]`);
            if (openProjectWrapper) {
                const header = openProjectWrapper.querySelector('.project-header');
                if (header) {
                    const headerRect = header.getBoundingClientRect();
                    const projectListContainerRect = projectListContainerElement.getBoundingClientRect();
                    if (headerRect.bottom < projectListContainerRect.top || headerRect.top > projectListContainerRect.bottom) {
                        hideFloatingDropdown();
                    } else {
                        positionAndShowDropdown(header); // Re-position based on new scroll
                    }
                } else { hideFloatingDropdown(); }
            } else { hideFloatingDropdown(); }
        }
    });

    projectsScrollAreaElement.addEventListener('dragover', handleProjectsScrollAreaDragOver);
    projectsScrollAreaElement.addEventListener('drop', handleProjectsScrollAreaDrop);
    projectsScrollAreaElement.addEventListener('dragleave', (e) => {
         if (e.target === projectsScrollAreaElement && !projectsScrollAreaElement.contains(e.relatedTarget)) {
            projectsScrollAreaElement.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
                el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
            });
        }
    });

    // 5. 데이터 초기화 (localStorage 로드 로직 제거)
    // main.js에서 받은 데이터로 projects 배열을 설정합니다.
    setProjectTodoDataAndRender(initialExternalData); // 초기 데이터로 UI 설정
}


// --- 외부 인터페이스 (Export) ---

/**
 * 현재 모듈이 관리하는 프로젝트 데이터 배열을 반환합니다.
 * main.js가 전체 데이터를 파일에 저장할 때 이 함수를 호출합니다.
 * @returns {Array} 현재 프로젝트 데이터
 */
export function getProjectTodoData() {
    // 상태 UI와 관련 없는 순수 데이터만 반환하도록 깊은 복사
    return JSON.parse(JSON.stringify(projects));
}

/**
 * 외부(main.js)로부터 받은 데이터로 모듈의 상태를 설정하고 UI를 다시 렌더링합니다.
 * 파일 로드 시 또는 날짜 변경 시 호출됩니다.
 * @param {Array | null} newDataArray - 표시할 새로운 프로젝트 데이터 배열
 */
export function setProjectTodoDataAndRender(newDataArray) {
    // null이나 undefined가 들어올 경우 빈 배열로 처리
    projects = Array.isArray(newDataArray) ? newDataArray : [];

    // 데이터 무결성 검사 및 ID 할당
    projects.forEach(p => {
        p.id = p.id || generateId('proj_');
        p.todos = p.todos || [];
        p.todos.forEach(t => { t.id = t.id || generateId('todo_'); });
    });

    openProjectId = null;
    hideFloatingDropdown();
    renderProjectList();
}
