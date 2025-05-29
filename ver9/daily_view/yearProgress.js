// yearProgress.js

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
let headerContainerElement = null;
let dateTextElement = null;

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInYear(year) {
    return isLeapYear(year) ? 366 : 365;
}

function getDayOfYear(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    let dayCount = 0;
    for (let i = 0; i < month; i++) {
        dayCount += (i === 1 && isLeapYear(year)) ? 29 : DAYS_IN_MONTH[i];
    }
    dayCount += date.getDate();
    return dayCount;
}

function updateDateText() {
    if (!dateTextElement) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dateTextElement.textContent = `${year} / ${month} / ${day}`;
}

function renderYearProgress() {
    if (!headerContainerElement) return;
    headerContainerElement.innerHTML = ''; // Clear previous content

    const now = new Date();
    const currentYear = now.getFullYear();
    const todayDayOfYear = getDayOfYear(now);
    const totalDaysInYear = getDaysInYear(currentYear);

    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'dv-year-progress-bar'; // << 수정됨

    let dayCounter = 0;
    for (let m = 0; m < 12; m++) { // Iterate through months
        const daysInThisMonth = (m === 1 && isLeapYear(currentYear)) ? 29 : DAYS_IN_MONTH[m];
        for (let d = 1; d <= daysInThisMonth; d++) {
            dayCounter++;
            const segment = document.createElement('div');
            segment.className = 'dv-day-segment'; // << 수정됨
            if (dayCounter <= todayDayOfYear) {
                segment.classList.add('dv-passed'); // << 수정됨
            } else {
                segment.classList.add('dv-future'); // << 수정됨
            }
            // 월의 마지막 날에 특별한 구분선 스타일 적용
            if (d === daysInThisMonth && m < 11) { // 마지막 달(12월)의 마지막 날은 전체 바의 끝이므로 제외
                segment.classList.add('dv-month-end-segment'); // << 수정됨
            }
            progressBarContainer.appendChild(segment);
        }
    }
    headerContainerElement.appendChild(progressBarContainer);

    // 날짜 텍스트 표시 요소 재생성 및 추가
    if (!dateTextElement || !document.body.contains(dateTextElement)) { // Ensure it's created if not existing
        dateTextElement = document.createElement('span');
        dateTextElement.id = 'current-date-display'; // ID는 그대로 유지
    }
    headerContainerElement.appendChild(dateTextElement); // ProgressBar 뒤, CSS로 z-index 처리
    updateDateText(); // 초기 날짜 설정
}


export function initYearProgress(headerContainerSelector) {
    headerContainerElement = document.querySelector(headerContainerSelector);
    if (!headerContainerElement) {
        console.error(`Year progress header container "${headerContainerSelector}" not found.`);
        return;
    }
    renderYearProgress();
    // 매일 자정에 업데이트 (또는 더 자주, 하지만 진행률은 하루에 한 번만 변경됨)
    // 간단하게는 페이지 로드 시 한 번만 렌더링하고, 날짜 텍스트만 주기적으로 업데이트
    setInterval(updateDateText, 60 * 60 * 1000); // 매시간 날짜 텍스트 업데이트 (예시)
    // 자정에 진행률 바를 다시 그리려면 더 복잡한 타이머 필요
    // 예: const now = new Date();
    // const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0) - now;
    // setTimeout(() => { renderYearProgress(); setInterval(renderYearProgress, 24 * 60 * 60 * 1000); }, msUntilMidnight);
}