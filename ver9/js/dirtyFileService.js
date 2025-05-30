// js/dirtyFileService.js

const DIRTY_KEYS_LIST_KEY = 'dirty_file_keys_list';

/**
 * 새로운 파일 경로 구조에 맞춰 localStorage 키를 생성합니다.
 * 예:
 * - settings.json -> dirty_settings
 * - 2025/2025.json -> dirty_2025_yearly
 * - 2025/2025-05.json -> dirty_2025_daily_05
 */
function getStorageKey(fileIdentifier) {
    if (fileIdentifier === 'settings.json') {
        return 'dirty_settings';
    }
    // "2025/2025.json" 또는 "2025/2025-05.json" 과 같은 형식을 처리
    const parts = fileIdentifier.split('/');
    if (parts.length === 2) {
        const year = parts[0];
        const filename = parts[1].replace('.json', ''); // "2025" or "2025-05"

        if (filename === year) {
            return `dirty_${year}_yearly`;
        } else if (filename.startsWith(year)) { // "2025-05"
            const month = filename.split('-')[1];
            return `dirty_${year}_daily_${month}`;
        }
    }
    console.warn('Unknown file identifier for dirty tracking:', fileIdentifier);
    return null;
}


/**
 * localStorage 키를 원래 파일 경로로 변환합니다.
 */
function getOriginalFilename(storageKey) {
    if (storageKey === 'dirty_settings') {
        return 'settings.json';
    }
    const parts = storageKey.replace('dirty_', '').split('_'); // "2025_yearly" or "2025_daily_05"
    if (parts.length >= 2) {
        const year = parts[0];
        const type = parts[1];

        if (type === 'yearly') {
            return `${year}/${year}.json`;
        } else if (type === 'daily' && parts.length === 3) {
            const month = parts[2];
            return `${year}/${year}-${month}.json`;
        }
    }
    return 'unknown_file.json';
}


// markFileAsDirty, getDirtyFileData, getAllDirtyFiles, clear... 함수들은 수정할 필요 없음.
// 그대로 두시면 됩니다.
export function markFileAsDirty(fileIdentifier, dataObject) {
    if (typeof localStorage === 'undefined') return;
    const storageKey = getStorageKey(fileIdentifier);
    if (!storageKey) return;

    try {
        const stringifiedData = JSON.stringify(dataObject);
        localStorage.setItem(storageKey, stringifiedData);
        let dirtyKeys = JSON.parse(localStorage.getItem(DIRTY_KEYS_LIST_KEY) || '[]');
        if (!dirtyKeys.includes(storageKey)) {
            dirtyKeys.push(storageKey);
            localStorage.setItem(DIRTY_KEYS_LIST_KEY, JSON.stringify(dirtyKeys));
        }
        console.log(`[DirtyFileService - markFileAsDirty] Key: ${storageKey}`);
    } catch (e) {
        console.error(`Error marking file dirty in localStorage for ${fileIdentifier}:`, e);
    }
}


export function getDirtyFileData(fileIdentifier) {
    if (typeof localStorage === 'undefined') return null;
    const storageKey = getStorageKey(fileIdentifier);
    if (!storageKey) return null;

    const dataString = localStorage.getItem(storageKey);
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
                    filenameInZip: getOriginalFilename(storageKey),
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
 * 변경된 파일(dirty)만 ZIP으로 묶어 다운로드합니다. (Cmd+S 용)
 */
export async function triggerPartialSave() {
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded. Cannot create ZIP file.");
        return;
    }

    const dirtyFiles = getAllDirtyFiles();

    if (dirtyFiles.length === 0) {
        alert("저장할 변경 사항이 없습니다.");
        return;
    }

    const zip = new JSZip();

    dirtyFiles.forEach(fileInfo => {
        zip.file(fileInfo.filenameInZip, JSON.stringify(fileInfo.data, null, 2));
    });

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const zipFilename = `changes_backup_${timestamp}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        // alert(`변경사항이 ${zipFilename}으로 저장(다운로드)되었습니다.`);
        clearAllDirtyFiles();
    } catch (e) {
        console.error("Error generating ZIP file:", e);
        alert("ZIP 파일 생성 중 오류가 발생했습니다.");
    }
}
