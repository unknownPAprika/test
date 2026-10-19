(function () {
    'use strict';

    // ===== Сохранение blob с учётом IE11 =====
    function saveBlob(blob, filename) {
        // IE10/IE11: нативный способ скачивания
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob, filename);
            return;
        }

        // Современные браузеры: File System Access API (Chrome/Edge)
        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'ZIP-архив',
                    accept: { 'application/zip': ['.zip'] }
                }]
            }).then(function (handle) {
                return handle.createWritable();
            }).then(function (writable) {
                return writable.write(blob).then(function () {
                    return writable.close();
                });
            }).catch(function (err) {
                if (err && err.name !== 'AbortError') {
                    fallbackSave(blob, filename);
                }
            });
            return;
        }

        // Остальные современные браузеры
        fallbackSave(blob, filename);
    }

    function fallbackSave(blob, filename) {
        var blobUrl = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        }, 1500);
    }

    // ===== Скачивание через XHR (работает во всех IE) =====
    function downloadViaXHR(url, filename, onError) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) {
                var blob = xhr.response;
                if (!blob || blob.size === 0) {
                    onError('Пустой файл');
                    return;
                }
                saveBlob(blob, filename);
            } else {
                onError('HTTP ' + xhr.status);
            }
        };
        xhr.onerror = function () {
            onError('Сетевая ошибка');
        };
        xhr.send();
    }

    // ===== Современные браузеры: fetch (если есть) =====
    function downloadViaFetch(url, filename, onError) {
        fetch(url, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.blob();
            })
            .then(function (blob) {
                if (!blob || blob.size === 0) throw new Error('Пустой файл');
                saveBlob(blob, filename);
            })
            .catch(function (e) {
                onError(e.message || 'fetch error');
            });
    }

    // ===== Главная функция =====
    function downloadFile(url, filename) {
        // В IE fetch нет — сразу идём через XHR
        if (typeof fetch === 'function' && !(window.navigator && window.navigator.msSaveOrOpenBlob)) {
            downloadViaFetch(url, filename, function (msg) {
                console.warn('fetch не сработал: ' + msg + ', пробуем XHR');
                downloadViaXHR(url, filename, function () {
                    openManually(url);
                });
            });
        } else {
            downloadViaXHR(url, filename, function (msg) {
                console.warn('XHR не сработал: ' + msg);
                openManually(url);
            });
        }
    }

    // ===== Крайний случай: открыть в новой вкладке =====
    function openManually(url) {
        var w = window.open(url, '_blank');
        if (!w) {
            var a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        showToast('Открыл файл в новой вкладке — сохраните вручную (Ctrl+S)');
    }

    // ===== Тост (ES5, без шаблонных строк) =====
    function showToast(msg) {
        var t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 5000);
    }

    // ===== Привязка кликов =====
    function bindCards() {
        var cards = document.querySelectorAll('.card[data-file]');
        for (var i = 0; i < cards.length; i++) {
            (function (card) {
                var url = card.getAttribute('data-file');
                var filename = decodeURIComponent(url.split('/').pop());

                card.addEventListener('click', function () {
                    downloadFile(url, filename);
                });

                card.addEventListener('keydown', function (e) {
                    var key = e.key || e.keyCode;
                    if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
                        if (e.preventDefault) e.preventDefault();
                        else e.returnValue = false;
                        downloadFile(url, filename);
                    }
                });
            })(cards[i]);
        }
    }

    // Запуск после загрузки DOM (IE не всегда понимает DOMContentLoaded в старых режимах)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        bindCards();
    } else {
        document.addEventListener('DOMContentLoaded', bindCards);
        // Фолбэк для очень старых IE
        window.attachEvent && window.attachEvent('onload', bindCards);
    }
})();