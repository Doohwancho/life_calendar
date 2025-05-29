// js/spaRouter.js

// dataManager와 eventBus는 여러 뷰 핸들러에 전달될 수 있습니다.
import * as dataManager from './dataManager.js';
import { eventBus } from './eventBus.js';

// 각 뷰의 초기화 및 정리 로직을 담당할 모듈 (mainViewHandler.js, dailyViewHandler.js)
import { initMainCalendarView, cleanupMainCalendarView } from './mainViewHandler.js';
import { initDailyDetailView, cleanupDailyDetailView } from './dailyViewHandler.js';

const viewContainer = document.getElementById('view-container');
const viewCache = {}; // 간단한 HTML 템플릿 캐시

// 라우트 정의
const routes = {
    // 주의: 해시 기반 라우팅에서 경로는 보통 '/' 또는 '/path' 형태입니다.
    // spa-main.js에서 location.hash.substring(1)을 사용했으므로, 여기서 키는 '#'을 제외한 부분입니다.
    '': { // 기본 경로 (예: http://.../index.html 또는 http://.../index.html#)
        template: 'views/main-calendar-view.html',
        init: initMainCalendarView,
        cleanup: cleanupMainCalendarView,
        title: 'Main Calendar'
    },
    '/': { // 명시적 루트 경로 (예: http://.../index.html#/)
        template: 'views/main-calendar-view.html',
        init: initMainCalendarView,
        cleanup: cleanupMainCalendarView,
        title: 'Main Calendar'
    },
    '/daily/:date': { // Daily View 경로 (예: #/daily/2025-05-30)
        template: 'views/daily-detail-view.html',
        init: initDailyDetailView,
        cleanup: cleanupDailyDetailView,
        title: 'Daily Details' // 동적으로 날짜를 포함하도록 init에서 수정 가능
    }
    // 추가 라우트 정의 가능
};

let currentViewCleanupFunction = null;

/**
 * HTML 템플릿 파일을 비동기적으로 로드하고 캐시합니다.
 */
async function loadTemplate(templatePath) {
    if (viewCache[templatePath]) {
        return viewCache[templatePath];
    }
    try {
        const response = await fetch(templatePath);
        if (!response.ok) {
            throw new Error(`Template load error: ${templatePath} (Status: ${response.status})`);
        }
        const html = await response.text();
        viewCache[templatePath] = html;
        return html;
    } catch (error) {
        console.error('Error loading template:', error);
        if (viewContainer) {
            viewContainer.innerHTML = '<p>Error loading page content. Please try again.</p>';
        }
        return null;
    }
}

/**
 * 현재 URL 해시를 파싱하여 라우트 정보와 파라미터를 추출합니다.
 */
function parseCurrentRoute() {
    const rawHash = location.hash.startsWith('#') ? location.hash.substring(1) : '/'; // '#' 제거, 없으면 기본 '/'
    const [pathWithPossibleParams, queryString] = rawHash.split('?');
    
    const queryParams = {};
    if (queryString) {
        queryString.split('&').forEach(part => {
            const [key, value] = part.split('=');
            queryParams[key] = decodeURIComponent(value || '');
        });
    }

    // 파라미터가 있는 라우트 패턴과 먼저 매칭 시도
    for (const routePattern in routes) {
        const paramNames = [];
        // 예: '/daily/:date' -> /daily/([^\\/]+)
        // 정규식에서 routePattern의 시작과 끝이 정확히 일치하도록 수정 (^...$)
        const regexPattern = routePattern.replace(/:(\w+)/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^\\/]+)';
        });
        const regex = new RegExp(`^${regexPattern}$`);
        const match = pathWithPossibleParams.match(regex);

        if (match) {
            const routeParams = {};
            paramNames.forEach((name, index) => {
                routeParams[name] = match[index + 1]; // 캡처 그룹은 1부터 시작
            });
            return { ...routes[routePattern], params: routeParams, query: queryParams, matchedPattern: routePattern };
        }
    }
    return null; // 일치하는 라우트 없음
}

/**
 * URL 해시 변경에 따라 적절한 뷰를 로드하고 렌더링합니다.
 */
async function handleRouteChange() {
    console.log('[SPA Router] Route change detected. Current hash:', location.hash);

    if (typeof currentViewCleanupFunction === 'function') {
        console.log('[SPA Router] Cleaning up previous view...');
        currentViewCleanupFunction();
        currentViewCleanupFunction = null;
    }

    const routeConfig = parseCurrentRoute();

    if (routeConfig && viewContainer) {
        console.log('[SPA Router] Matched route:', routeConfig.matchedPattern, 'Params:', routeConfig.params);
        
        const htmlContent = await loadTemplate(routeConfig.template);

        if (htmlContent) {
            viewContainer.innerHTML = htmlContent;
            document.title = routeConfig.title || 'Calendar SPA'; // 페이지 타이틀 변경

            if (typeof routeConfig.init === 'function') {
                console.log('[SPA Router] Initializing view for:', routeConfig.matchedPattern);
                // dataManager와 eventBus, 그리고 파라미터 전달
                await routeConfig.init(dataManager, eventBus, routeConfig.params, routeConfig.query);
            }
            
            if (typeof routeConfig.cleanup === 'function') {
                currentViewCleanupFunction = routeConfig.cleanup;
            }
        }
    } else {
        console.error('[SPA Router] No route matched for hash:', location.hash);
        viewContainer.innerHTML = '<h2>404 - Page Not Found</h2><p>The requested page could not be found.</p>';
        document.title = 'Page Not Found';
    }
}

/**
 * SPA 애플리케이션을 초기화합니다.
 */
function initializeApp() {
    console.log('[SPA Router] Application initializing...');
    
    // dataManager 초기 데이터 로드는 각 뷰 핸들러에서 필요에 따라 수행하거나,
    // 여기서 앱 시작 시점에 한 번 수행할 수 있습니다.
    // 예를 들어, dataManager.loadDataForYear(new Date().getFullYear()); 등을 여기서 호출 가능.
    // 지금은 각 뷰 핸들러(mainViewHandler)에서 로드하도록 위임합니다.

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('load', () => {
        // 초기 로드 시 해시가 없으면 기본 경로로 설정하여 라우팅 트리거
        if (!location.hash || location.hash === "#") {
            location.hash = '/';
        } else {
            handleRouteChange(); // 이미 해시가 있으면 해당 해시로 라우팅
        }
    });
}

// 다른 모듈에서 프로그래매틱하게 네비게이션할 수 있도록 함수 export
export function navigate(path) {
    if (!path.startsWith('#')) {
        path = '#' + path;
    }
    // 현재 해시와 같은 경로로 네비게이트하려고 하면 강제로 hashchange 이벤트 발생
    if (location.hash === path) {
        handleRouteChange();
    } else {
        location.hash = path;
    }
}

// 애플리케이션 시작
initializeApp();