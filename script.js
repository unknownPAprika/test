// ===== Универсальное сохранение blob =====
function saveBlob(blob, filename) {
    // File System Access API (Chrome/Edge) — окно "Сохранить как"
    if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'ZIP-архив',
                accept: { 'application/zip': ['.zip'] }
            }]
        }).then(handle => handle.createWritable())
          .then(writable => writable.write(blob).then(() => writable.close()))
          .catch(err => {
              if (err.name !== 'AbortError') fallbackSave(blob, filename);
          });
    } else {
        fallbackSave(blob, filename);
    }
}

function fallbackSave(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    }, 1500);
}

// ===== Скачивание через XHR =====
function downloadViaXHR(url, filename) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 0) {
                const blob = xhr.response;
                if (!blob || blob.size === 0) return reject(new Error('Пустой файл'));
                saveBlob(blob, filename);
                resolve();
            } else {
                reject(new Error('HTTP ' + xhr.status));
            }
        };
        xhr.onerror = () => reject(new Error('Сетевая ошибка'));
        xhr.send();
    });
}

// ===== Главная функция с несколькими попытками =====
async function downloadFile(url, filename) {
    // Попытка 1: fetch
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        if (!blob || blob.size === 0) throw new Error('Пустой файл');
        saveBlob(blob, filename);
        return;
    } catch (e1) {
        console.warn('fetch не сработал:', e1.message);
    }

    // Попытка 2: XHR
    try {
        await downloadViaXHR(url, filename);
        return;
    } catch (e2) {
        console.warn('XHR не сработал:', e2.message);
    }

    // Последний шанс: открыть в новой вкладке
    openManually(url);
}

function openManually(url) {
    const w = window.open(url, '_blank');
    if (!w) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    showToast('Открыл файл в новой вкладке — сохраните вручную (Ctrl+S)');
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
}

// ===== Привязка кнопки =====
document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = btn.getAttribute('href');
        const filename = decodeURIComponent(url.split('/').pop());
        downloadFile(url, filename);
    });
});