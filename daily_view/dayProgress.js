// dayProgress.js

let dayProgressContainerElement = null;
const SEGMENTS_PER_HOUR = 6;     // 10분 단위 (기존과 동일)
const DISPLAYED_HOURS = 16;      // <<<< 변경: 하루 중 시각화할 시간 (16시간)
const TOTAL_DISPLAY_SEGMENTS = DISPLAYED_HOURS * SEGMENTS_PER_HOUR; // <<<< 변경: 전체 표시될 세그먼트 수 (16 * 6 = 96)

const ACTUAL_DAY_HOURS = 24;     // 실제 하루의 시간 (시간 경과 계산용)
const START_HOUR_OFFSET = 8;     // 시각화 시작 시간 (예: 오전 8시, 기존과 동일)

function renderDayProgress() {
    if (!dayProgressContainerElement) return;
    dayProgressContainerElement.innerHTML = ''; // 기존 내용 초기화

    const progressBar = document.createElement('div');
    progressBar.className = 'dv-day-progress-bar-visual'; // << 수정됨

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    let rawSegmentsPassedSinceStartOffset;

    // START_HOUR_OFFSET (예: 오전 8시)부터 현재까지 실제로 몇 개의 10분 세그먼트가 지났는지 계산합니다.
    // 이 계산은 자정을 넘어도 정확히 누적된 시간을 반영합니다.
    if (currentHour < START_HOUR_OFFSET) {
        // 예: 현재 새벽 2시 (currentHour = 2), START_HOUR_OFFSET = 8.
        // 전날 오전 8시부터 (24 - 8 + 2) = 18시간 경과한 것임.
        rawSegmentsPassedSinceStartOffset = (ACTUAL_DAY_HOURS - START_HOUR_OFFSET + currentHour) * SEGMENTS_PER_HOUR + Math.floor(currentMinute / 10);
    } else {
        // 예: 현재 오전 10시 (currentHour = 10), START_HOUR_OFFSET = 8.
        // 오늘 오전 8시부터 (10 - 8) = 2시간 경과한 것임.
        rawSegmentsPassedSinceStartOffset = (currentHour - START_HOUR_OFFSET) * SEGMENTS_PER_HOUR + Math.floor(currentMinute / 10);
    }

    // 진행률 표시줄에 채워질 세그먼트 수는 DISPLAYED_HOURS (16시간) 분량을 넘지 않도록 합니다.
    // START_HOUR_OFFSET (오전 8시)에 rawSegmentsPassedSinceStartOffset은 0이 되므로 막대가 초기화됩니다.
    const segmentsToFill = Math.min(rawSegmentsPassedSinceStartOffset, TOTAL_DISPLAY_SEGMENTS);

    // TOTAL_DISPLAY_SEGMENTS (16시간 분량) 만큼의 세그먼트 막대를 생성합니다.
    for (let i = 0; i < TOTAL_DISPLAY_SEGMENTS; i++) {
        const segment = document.createElement('div');
        segment.className = 'dv-time-segment'; // << 수정됨

        if (i < segmentsToFill) {
            segment.classList.add('dv-passed-time'); // << 수정됨
        } else {
            segment.classList.add('dv-future-time'); // << 수정됨
        }

        // 매 시간 구분선 추가 (16시간 표시 막대 내에서)
        // (i+1)이 SEGMENTS_PER_HOUR의 배수이면 시간 구분선
        if ((i + 1) % SEGMENTS_PER_HOUR === 0 && i < TOTAL_DISPLAY_SEGMENTS - 1) { // 마지막 세그먼트 오른쪽 끝은 제외
            segment.classList.add('dv-hour-marker'); // << 수정됨
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
    setInterval(renderDayProgress, 60 * 1000); // 1분마다 업데이트
}