// js/dirtyFileService.js

const DIRTY_KEYS_LIST_KEY = 'dirty_file_keys_list';

/**
 * 파일 키에 'dirty_' 접두사를 붙여 localStorage 키로 사용합니다.
 * 예: settings.json -> dirty_settings
 * yearly/2025.json -> dirty_yearly_2025
 * daily/2025-05.json -> dirty_daily_2025-05
 */
function getStorageKey(fileIdentifier) {
    if (fileIdentifier === 'settings.json') return 'dirty_settings';
    if (fileIdentifier.startsWith('yearly/')) return `dirty_yearly_${fileIdentifier.split('/')[1].replace('.json', '')}`;
    if (fileIdentifier.startsWith('daily/')) return `dirty_daily_${fileIdentifier.split('/')[1].replace('.json', '')}`;
    console.warn('Unknown file identifier for dirty tracking:', fileIdentifier);
    return null;
}

function getOriginalFilename(storageKey) {
    if (storageKey === 'dirty_settings') return 'settings.json';
    if (storageKey.startsWith('dirty_yearly_')) return `yearly/${storageKey.replace('dirty_yearly_', '')}.json`;
    if (storageKey.startsWith('dirty_daily_')) return `daily/${storageKey.replace('dirty_daily_', '')}.json`;
    return 'unknown_file.json';
}


export function markFileAsDirty(fileIdentifier, dataObject) {
    if (typeof localStorage === 'undefined') return;
    const storageKey = getStorageKey(fileIdentifier);
    if (!storageKey) return;

    try {
        const stringifiedData = JSON.stringify(dataObject); // 직렬화 먼저
        localStorage.setItem(storageKey, stringifiedData);
        let dirtyKeys = JSON.parse(localStorage.getItem(DIRTY_KEYS_LIST_KEY) || '[]');
        if (!dirtyKeys.includes(storageKey)) {
            dirtyKeys.push(storageKey);
            localStorage.setItem(DIRTY_KEYS_LIST_KEY, JSON.stringify(dirtyKeys));
        }
        // --- [디버깅 로그] ---
        console.log(`[DirtyFileService - markFileAsDirty] Key: ${storageKey}, Data (first 200 chars): ${stringifiedData.substring(0,200)}...`);
        console.log(`[DirtyFileService - markFileAsDirty] Current dirty keys:`, JSON.stringify(dirtyKeys));
    } catch (e) {
        console.error(`Error marking file dirty in localStorage for ${fileIdentifier}:`, e);
    }
}

export function getDirtyFileData(fileIdentifier) {
    if (typeof localStorage === 'undefined') return null;
    const storageKey = getStorageKey(fileIdentifier);
    if (!storageKey) return null;

    const dataString = localStorage.getItem(storageKey);
    // --- [디버깅 로그] ---
    console.log(`[DirtyFileService - getDirtyFileData] Attempting to get key: ${storageKey}. Found data (first 200 chars):`, dataString ? dataString.substring(0,200)+'...' : null);

    if (dataString) {
        try {
            return JSON.parse(dataString);
        } catch (e) {
            console.error(`Error parsing dirty data from localStorage for ${fileIdentifier} (key: ${storageKey}):`, e);
            return null;
        }
    }
    return null;
}

export function getAllDirtyFiles() {
    if (typeof localStorage === 'undefined') return [];
    const dirtyKeys = JSON.parse(localStorage.getItem(DIRTY_KEYS_LIST_KEY) || '[]');
    const dirtyFiles = [];
    dirtyKeys.forEach(storageKey => {
        const dataString = localStorage.getItem(storageKey);
        if (dataString) {
            try {
                dirtyFiles.push({
                    filenameInZip: getOriginalFilename(storageKey), // ZIP 내 경로 및 파일명
                    data: JSON.parse(dataString)
                });
            } catch (e) {
                console.error(`Error parsing dirty data for key ${storageKey}:`, e);
            }
        }
    });
    return dirtyFiles;
}

export function clearDirtyFile(fileIdentifier) {
    if (typeof localStorage === 'undefined') return;
    const storageKey = getStorageKey(fileIdentifier);
    if (!storageKey) return;

    localStorage.removeItem(storageKey);
    let dirtyKeys = JSON.parse(localStorage.getItem(DIRTY_KEYS_LIST_KEY) || '[]');
    dirtyKeys = dirtyKeys.filter(key => key !== storageKey);
    localStorage.setItem(DIRTY_KEYS_LIST_KEY, JSON.stringify(dirtyKeys));
    console.log(`[DirtyFileService] Cleared dirty state for: ${fileIdentifier}`);
}

export function clearAllDirtyFiles() {
    if (typeof localStorage === 'undefined') return;
    const dirtyKeys = JSON.parse(localStorage.getItem(DIRTY_KEYS_LIST_KEY) || '[]');
    dirtyKeys.forEach(storageKey => {
        localStorage.removeItem(storageKey);
    });
    localStorage.setItem(DIRTY_KEYS_LIST_KEY, JSON.stringify([]));
    console.log('[DirtyFileService] All dirty states cleared.');
}


/**
 * [Phase 6] 모든 'dirty' 파일을 ZIP으로 묶어 다운로드합니다.
 */
export async function triggerGlobalSave() {
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded. Cannot create ZIP file.");
        return;
    }

    const dirtyFiles = getAllDirtyFiles(); // { filenameInZip, data } 배열

    if (dirtyFiles.length === 0) {
        alert("저장할 변경 사항이 없습니다.");
        return;
    }

    const zip = new JSZip();

    dirtyFiles.forEach(fileInfo => {
        // filenameInZip 예: "settings.json", "yearly/2025.json", "daily/2025-05.json"
        zip.file(fileInfo.filenameInZip, JSON.stringify(fileInfo.data, null, 2));
    });

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const zipFilename = `time_ledger_backup_${timestamp}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        alert(`모든 변경사항이 ${zipFilename}으로 저장(다운로드)되었습니다. 파일을 안전한 곳에 보관하고, 필요시 data 폴더에 압축 해제하여 덮어쓰세요.`);
        clearAllDirtyFiles(); // 저장 후 dirty 상태 초기화
    } catch (e) {
        console.error("Error generating ZIP file:", e);
        alert("ZIP 파일 생성 중 오류가 발생했습니다.");
    }
}
