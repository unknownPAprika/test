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

// ===== Скачивание через XHR (работает даже там, где fetch падает) =====
function downloadViaXHR(url, filename) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.onload = () => {
            // Успех: 200, или 0 (бывает при file://)
            if (xhr.status === 200 || xhr.status === 0) {
                const blob = xhr.response;
                if (!blob || blob.size === 0) {
                    reject(new Error('Пустой файл'));
                    return;
                }
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

// Универсальное сохранение blob
function saveBlob(blob, filename) {
    // Пытаемся через File System Access API (Chrome/Edge) — самый надёжный способ
    if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Изображение',
                accept: { [blob.type || 'image/jpeg']: ['.' + (filename.split('.').pop() || 'jpg')] }
            }]
        }).then(handle => handle.createWritable())
          .then(writable => writable.write(blob).then(() => writable.close()))
          .catch(err => {
              // Пользователь отменил — не страшно
              if (err.name !== 'AbortError') {
                  fallbackSave(blob, filename);
              }
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

// Главная функция скачивания с несколькими попытками
async function downloadImage(url, filename) {
    try {
        // Попытка 1: fetch + blob
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        if (!blob || blob.size === 0) throw new Error('Пустой файл');
        saveBlob(blob, filename);
        return;
    } catch (e1) {
        console.warn('fetch не сработал:', e1.message);
    }

    try {
        // Попытка 2: XHR + blob
        await downloadViaXHR(url, filename);
        return;
    } catch (e2) {
        console.warn('XHR не сработал:', e2.message);
    }

    // Попытка 3: canvas — рисуем картинку и сохраняем как dataURL
    // Работает только для same-origin картинок и без CORS-проблем
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
        canvas.toBlob(blob => {
            if (blob) saveBlob(blob, filename);
            else openManually(url);
        }, 'image/jpeg', 0.95);
        return;
    } catch (e3) {
        console.warn('canvas не сработал:', e3.message);
    }

    // Последний шанс: открываем в новой вкладке
    openManually(url);
}

function openManually(url) {
    const w = window.open(url, '_blank');
    if (!w) {
        // Если блокировщик не дал открыть — создаём ссылку
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    // Показываем подсказку
    showToast('Открыл фото в новой вкладке — нажмите правой кнопкой → «Сохранить изображение»');
}

// Маленький тост-помощник вместо alert()
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

// ===== Привязка кнопок =====
document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = btn.getAttribute('href');
        const filename = decodeURIComponent(url.split('/').pop());
        downloadImage(url, filename);
    });
});