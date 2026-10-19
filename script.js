// ===== Модальное окно =====
const modal = document.createElement('div');
modal.className = 'modal';
modal.innerHTML = `<span class="modal-close">&times;</span><img src="" alt="Просмотр">`;
document.body.appendChild(modal);

const modalImg = modal.querySelector('img');
const closeBtn = modal.querySelector('.modal-close');

document.querySelectorAll('.card img').forEach(img => {
    img.addEventListener('click', () => {
        modalImg.src = img.src;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ===== Универсальное сохранение blob =====
function saveBlob(blob, filename) {
    // File System Access API (Chrome/Edge) — окно "Сохранить как"
    if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Файл',
                accept: { [blob.type || 'application/octet-stream']: ['.' + (filename.split('.').pop() || 'bin')] }
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

    // Попытка 3: canvas (только для картинок)
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = () => rej(new Error('Не загрузилась'));
                img.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            await new Promise(resolve => {
                canvas.toBlob(blob => {
                    if (blob) saveBlob(blob, filename);
                    else openManually(url);
                    resolve();
                }, 'image/jpeg', 0.95);
            });
            return;
        } catch (e3) {
            console.warn('canvas не сработал:', e3.message);
        }
    }

    // Последний шанс
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
    showToast('Открыл файл в новой вкладке — сохраните его вручную (Ctrl+S)');
}

function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '14px 22px',
        borderRadius: '10px',
        fontFamily: 'sans-serif',
        fontSize: '15px',
        maxWidth: '90%',
        textAlign: 'center',
        zIndex: 2000,
        boxShadow: '0 5px 25px rgba(0,0,0,0.4)'
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
}

// ===== Привязка ко всем кнопкам =====
document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = btn.getAttribute('href');
        const filename = decodeURIComponent(url.split('/').pop());
        downloadFile(url, filename);
    });
});