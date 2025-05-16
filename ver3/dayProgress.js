// dayProgress.js

let dayProgressContainerElement = null;
const SEGMENTS_PER_HOUR = 6; // 10분 단위
const TOTAL_HOURS = 24;
const TOTAL_SEGMENTS = TOTAL_HOURS * SEGMENTS_PER_HOUR;
const START_HOUR_OFFSET = 8; // 오전 8시부터 시작

function renderDayProgress() {
    if (!dayProgressContainerElement) return;
    dayProgressContainerElement.innerHTML = ''; // 기존 내용 초기화

    const progressBar = document.createElement('div');
    progressBar.className = 'day-progress-bar-visual'; // 실제 막대들을 담을 컨테이너

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 오늘 오전 8시부터 현재까지 총 몇 개의 10분 세그먼트가 지났는지 계산
    let segmentsPassedSince8AM;
    if (currentHour < START_HOUR_OFFSET) {
        // 예: 현재 새벽 2시 -> 어제 오전 8시부터는 (24 - 8 + 2)시간 = 18시간 경과
        segmentsPassedSince8AM = (TOTAL_HOURS - START_HOUR_OFFSET + currentHour) * SEGMENTS_PER_HOUR + Math.floor(currentMinute / 10);
    } else {
        // 예: 현재 오전 10시 -> (10 - 8)시간 = 2시간 경과
        segmentsPassedSince8AM = (currentHour - START_HOUR_OFFSET) * SEGMENTS_PER_HOUR + Math.floor(currentMinute / 10);
    }
    // segmentsPassedSince8AM = Math.max(0, segmentsPassedSince8AM); // 음수 방지 (이론상 발생 안 함)


    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
        const segment = document.createElement('div');
        segment.className = 'time-segment';

        if (i < segmentsPassedSince8AM) {
            segment.classList.add('passed-time');
        } else {
            segment.classList.add('future-time');
        }

        // (i+1)이 SEGMENTS_PER_HOUR의 배수이면 시간 구분선
        if ((i + 1) % SEGMENTS_PER_HOUR === 0 && i < TOTAL_SEGMENTS -1) { // 마지막 세그먼트의 오른쪽은 그리지 않음
            segment.classList.add('hour-marker');
        }
        progressBar.appendChild(segment);
    }
    dayProgressContainerElement.appendChild(progressBar);
}

export function initDayProgress(containerSelector) {
    dayProgressContainerElement = document.querySelector(containerSelector);
    if (!dayProgressContainerElement) {
        console.error(`Day progress container "${containerSelector}" not found.`);
        return;
    }
    renderDayProgress(); // 초기 렌더링
    setInterval(renderDayProgress, 60 * 1000); // 1분마다 업데이트 (10분 단위이므로 더 길게 해도 무방)
}