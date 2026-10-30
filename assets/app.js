/**
 * DocuRead Offline - Engine for reading PDF and DOCX files 100% offline
 */

// Configure PDF.js worker to local bundled script
if (window.pdfjsLib) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
  } catch (e) {
    console.warn('PDF.js worker initialization:', e);
  }
}

// App State
const state = {
  currentFile: null,
  fileType: null, // 'pdf' | 'docx'
  pdfDoc: null,
  currentPage: 1,
  totalPages: 1,
  zoomScale: 1.0,
  theme: 'sepia',
  fontScale: 0.85,
  pageRendering: false,
  pageNumPending: null,
};

// DOM Elements
let fileInput, emptyState, loadingOverlay, loadingText;
let docViewport, pdfContainer, docxContainer, docControls, mobileNavBar;
let prevPageBtn, nextPageBtn, pageNumInput, pageCountSpan;
let mobPrevPageBtn, mobNextPageBtn, mobPageIndicator;
let zoomInBtn, zoomOutBtn, zoomResetBtn, zoomLevelSpan;
let btnMoreMenu, moreDropdown, menuBackdrop;
let btnFontDec, btnFontInc, fontScaleDisplay, btnMenuOpenFile;
let btnSampleDocx, btnSamplePdf, dropzone;

// Initialize Event Listeners
function init() {
  fileInput = document.getElementById('file-input');
  emptyState = document.getElementById('empty-state');
  loadingOverlay = document.getElementById('loading-overlay');
  loadingText = document.getElementById('loading-text');
  docViewport = document.getElementById('document-viewport');
  pdfContainer = document.getElementById('pdf-container');
  docxContainer = document.getElementById('docx-container');
  docControls = document.getElementById('doc-controls');
  mobileNavBar = document.getElementById('mobile-nav-bar');

  prevPageBtn = document.getElementById('prev-page-btn');
  nextPageBtn = document.getElementById('next-page-btn');
  pageNumInput = document.getElementById('page-num-input');
  pageCountSpan = document.getElementById('page-count-span');

  mobPrevPageBtn = document.getElementById('mob-prev-page');
  mobNextPageBtn = document.getElementById('mob-next-page');
  mobPageIndicator = document.getElementById('mob-page-indicator');

  zoomInBtn = document.getElementById('zoom-in-btn');
  zoomOutBtn = document.getElementById('zoom-out-btn');
  zoomResetBtn = document.getElementById('zoom-reset-btn');
  zoomLevelSpan = document.getElementById('zoom-level-span');

  btnMoreMenu = document.getElementById('btn-more-menu');
  moreDropdown = document.getElementById('more-dropdown');
  menuBackdrop = document.getElementById('menu-backdrop');
  btnFontDec = document.getElementById('btn-font-dec');
  btnFontInc = document.getElementById('btn-font-inc');
  fontScaleDisplay = document.getElementById('font-scale-display');
  btnMenuOpenFile = document.getElementById('btn-menu-open-file');

  btnSampleDocx = document.getElementById('btn-sample-docx');
  btnSamplePdf = document.getElementById('btn-sample-pdf');
  dropzone = document.getElementById('dropzone');

  // File Picker Trigger
  const triggerPicker = () => {
    if (window.AndroidBridge && typeof window.AndroidBridge.pickFile === 'function') {
      window.AndroidBridge.pickFile();
    } else if (fileInput) {
      fileInput.click();
    }
  };

  if (btnMenuOpenFile) {
    btnMenuOpenFile.addEventListener('click', () => {
      toggleMenu(false);
      triggerPicker();
    });
  }
  if (dropzone) dropzone.addEventListener('click', triggerPicker);

  // 3-dots Menu Toggle
  if (btnMoreMenu) {
    btnMoreMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }
  if (menuBackdrop) {
    menuBackdrop.addEventListener('click', () => toggleMenu(false));
  }

  // Font Scaling Handlers
  if (btnFontDec) {
    btnFontDec.addEventListener('click', () => setDocFontScale(state.fontScale - 0.1));
  }
  if (btnFontInc) {
    btnFontInc.addEventListener('click', () => setDocFontScale(state.fontScale + 0.1));
  }
  document.querySelectorAll('.font-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = parseFloat(btn.getAttribute('data-scale'));
      if (!isNaN(scale)) setDocFontScale(scale);
    });
  });

  // Theme Switching Handlers
  document.querySelectorAll('.theme-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      if (theme) setTheme(theme);
    });
  });

  // Restore saved preferences
  try {
    const savedTheme = localStorage.getItem('docuread_theme') || 'sepia';
    setTheme(savedTheme);
    const savedScale = parseFloat(localStorage.getItem('docuread_font_scale')) || 0.85;
    setDocFontScale(savedScale);
  } catch (e) {
    setTheme('sepia');
    setDocFontScale(0.85);
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        loadFile(file);
      }
    });
  }

  // Drag and Drop
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        loadFile(files[0]);
      }
    });
  }

  // Pagination events
  if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
  if (mobPrevPageBtn) mobPrevPageBtn.addEventListener('click', () => changePage(-1));
  if (mobNextPageBtn) mobNextPageBtn.addEventListener('click', () => changePage(1));

  if (pageNumInput) {
    pageNumInput.addEventListener('change', (e) => {
      const page = parseInt(e.target.value, 10);
      if (!isNaN(page) && page >= 1 && page <= state.totalPages) {
        goToPage(page);
      } else {
        pageNumInput.value = state.currentPage;
      }
    });
  }

  // Zoom events
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(0.15));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-0.15));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1.0));

  // Quick Sample Tests
  if (btnSampleDocx) {
    btnSampleDocx.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleFile('sample.docx', 'docx');
    });
  }

  if (btnSamplePdf) {
    btnSamplePdf.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleFile('sample.pdf', 'pdf');
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      changePage(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      changePage(-1);
    } else if (e.key === '+' || e.key === '=') {
      changeZoom(0.15);
    } else if (e.key === '-') {
      changeZoom(-0.15);
    }
  });

  // Native Android Bridge listener setup
  setupAndroidBridge();
}

// Toggle 3-dots popup menu
function toggleMenu(show) {
  if (!moreDropdown || !menuBackdrop) return;
  const shouldOpen = (show !== undefined) ? show : moreDropdown.classList.contains('hidden');
  if (shouldOpen) {
    moreDropdown.classList.remove('hidden');
    menuBackdrop.classList.remove('hidden');
  } else {
    moreDropdown.classList.add('hidden');
    menuBackdrop.classList.add('hidden');
  }
}

// Adjust Document Font Scale
function setDocFontScale(scale) {
  const clamped = Math.min(Math.max(scale, 0.55), 1.5);
  state.fontScale = Math.round(clamped * 100) / 100;
  document.documentElement.style.setProperty('--doc-font-scale', state.fontScale);
  
  if (fontScaleDisplay) {
    fontScaleDisplay.textContent = `${Math.round(state.fontScale * 100)}%`;
  }
  
  document.querySelectorAll('.font-preset-btn').forEach(btn => {
    const btnScale = parseFloat(btn.getAttribute('data-scale'));
    if (Math.abs(btnScale - state.fontScale) < 0.05) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  try {
    localStorage.setItem('docuread_font_scale', state.fontScale);
  } catch (e) {}
}

// Change Theme
function setTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-sepia');
  if (theme !== 'default') {
    document.body.classList.add(`theme-${theme}`);
  }
  state.theme = theme;

  document.querySelectorAll('.theme-option-btn').forEach(btn => {
    if (btn.getAttribute('data-theme') === theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  try {
    localStorage.setItem('docuread_theme', theme);
  } catch (e) {}
}

// Show / Hide Loading
function showLoading(msg = 'Đang tải tài liệu...') {
  if (loadingText) loadingText.textContent = msg;
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

// Load a local file from disk/input
function loadFile(file) {
  state.currentFile = file;
  const fileName = (file.name || '').toLowerCase();
  
  showLoading(`Đang mở ${file.name}...`);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    if (fileName.endsWith('.pdf')) {
      renderPdf(arrayBuffer);
    } else if (fileName.endsWith('.docx')) {
      renderDocx(arrayBuffer);
    } else if (fileName.endsWith('.doc')) {
      hideLoading();
      alert('Tệp .doc là định dạng Word cũ. Vui lòng lưu thành định dạng .docx hoặc .pdf để đọc offline.');
    } else {
      // Try detecting from magic bytes
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) { // %PDF
        renderPdf(arrayBuffer);
      } else if (header[0] === 0x50 && header[1] === 0x4B) { // PK (ZIP/DOCX)
        renderDocx(arrayBuffer);
      } else {
        hideLoading();
        alert('Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp .pdf hoặc .docx');
      }
    }
  };
  reader.onerror = function() {
    hideLoading();
    alert('Không thể đọc tệp tin từ thiết bị!');
  };
  reader.readAsArrayBuffer(file);
}

// Load sample files (for direct 1-click offline test)
async function loadSampleFile(url, type) {
  showLoading(`Đang mở file mẫu ${url}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Không thể tải file mẫu');
    const arrayBuffer = await response.arrayBuffer();
    if (type === 'pdf') {
      renderPdf(arrayBuffer);
    } else {
      renderDocx(arrayBuffer);
    }
  } catch (err) {
    hideLoading();
    alert('Lỗi tải file mẫu: ' + err.message);
  }
}

// ========================
// PDF RENDERING LOGIC
// ========================
async function renderPdf(arrayBuffer) {
  state.fileType = 'pdf';
  if (docxContainer) {
    docxContainer.innerHTML = '';
    docxContainer.style.display = 'none';
  }
  if (pdfContainer) {
    pdfContainer.style.display = 'flex';
    pdfContainer.innerHTML = '';
  }

  try {
    if (!window.pdfjsLib) {
      throw new Error('Thư viện PDF.js chưa được tải!');
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;
    state.zoomScale = 1.0;

    // Show controls
    if (emptyState) emptyState.classList.add('hidden');
    if (docControls) docControls.classList.add('visible');
    const pageNavEl = document.querySelector('.page-nav');
    if (pageNavEl) pageNavEl.style.display = 'flex';
    if (mobileNavBar) mobileNavBar.classList.add('visible');
    
    updatePaginationUI();
    updateZoomUI();
    
    await renderPdfPage(state.currentPage);
    hideLoading();
  } catch (err) {
    hideLoading();
    console.error('PDF error:', err);
    alert('Lỗi hiển thị PDF: ' + err.message);
  }
}

async function renderPdfPage(num) {
  state.pageRendering = true;
  if (!pdfContainer) return;
  pdfContainer.innerHTML = '';

  try {
    const page = await state.pdfDoc.getPage(num);
    
    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: state.zoomScale });

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper';

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    const ctx = canvas.getContext('2d');

    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    ctx.scale(pixelRatio, pixelRatio);

    wrapper.appendChild(canvas);
    pdfContainer.appendChild(wrapper);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    state.pageRendering = false;

    if (state.pageNumPending !== null) {
      const pending = state.pageNumPending;
      state.pageNumPending = null;
      renderPdfPage(pending);
    }
  } catch (err) {
    state.pageRendering = false;
    console.error('Render page error:', err);
  }
}

function queueRenderPage(num) {
  if (state.pageRendering) {
    state.pageNumPending = num;
  } else {
    renderPdfPage(num);
  }
}

function changePage(delta) {
  if (state.fileType !== 'pdf') return;
  const newPage = state.currentPage + delta;
  if (newPage >= 1 && newPage <= state.totalPages) {
    goToPage(newPage);
  }
}

function goToPage(num) {
  state.currentPage = num;
  updatePaginationUI();
  queueRenderPage(num);
  if (docViewport) docViewport.scrollTop = 0;
}

function updatePaginationUI() {
  if (pageNumInput) pageNumInput.value = state.currentPage;
  if (pageCountSpan) pageCountSpan.textContent = `/ ${state.totalPages}`;
  if (prevPageBtn) prevPageBtn.disabled = (state.currentPage <= 1);
  if (nextPageBtn) nextPageBtn.disabled = (state.currentPage >= state.totalPages);

  if (mobPageIndicator) {
    mobPageIndicator.textContent = `${state.currentPage} / ${state.totalPages}`;
  }
  if (mobPrevPageBtn) mobPrevPageBtn.disabled = (state.currentPage <= 1);
  if (mobNextPageBtn) mobNextPageBtn.disabled = (state.currentPage >= state.totalPages);
}

// ========================
// DOCX RENDERING LOGIC
// ========================
async function renderDocx(arrayBuffer) {
  state.fileType = 'docx';
  if (pdfContainer) {
    pdfContainer.innerHTML = '';
    pdfContainer.style.display = 'none';
  }
  if (docxContainer) {
    docxContainer.style.display = 'block';
    docxContainer.innerHTML = '';
  }

  try {
    if (!window.docx) {
      throw new Error('Thư viện docx-preview chưa sẵn sàng');
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (docControls) docControls.classList.add('visible');
    if (mobileNavBar) mobileNavBar.classList.remove('visible');

    const pageNavEl = document.querySelector('.page-nav');
    if (pageNavEl) pageNavEl.style.display = 'none';

    state.zoomScale = 1.0;
    updateZoomUI();

    const options = {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      useBase64URL: true,
      debug: false
    };

    await docx.renderAsync(arrayBuffer, docxContainer, null, options);
    hideLoading();
  } catch (err) {
    hideLoading();
    console.error('DOCX error:', err);
    alert('Lỗi hiển thị Word DOCX: ' + err.message);
  }
}

// ========================
// ZOOM CONTROLS
// ========================
function changeZoom(delta) {
  setZoom(state.zoomScale + delta);
}

function setZoom(newScale) {
  const clamped = Math.min(Math.max(newScale, 0.4), 2.5);
  state.zoomScale = Math.round(clamped * 100) / 100;
  updateZoomUI();

  if (state.fileType === 'pdf') {
    queueRenderPage(state.currentPage);
  } else if (state.fileType === 'docx' && docxContainer) {
    docxContainer.style.transform = `scale(${state.zoomScale})`;
  }
}

function updateZoomUI() {
  const percent = Math.round(state.zoomScale * 100) + '%';
  if (zoomLevelSpan) zoomLevelSpan.textContent = percent;
}

// ========================
// ANDROID NATIVE BRIDGE
// ========================
function setupAndroidBridge() {
  // New Chunked Bridge: Transfers files of any size without Binder 1MB overflow
  window.onNativeDocumentReady = function(fileName, mimeType, totalSize) {
    showLoading(`Đang mở ${fileName} (${Math.round(totalSize / 1024)} KB)...`);
    
    setTimeout(() => {
      try {
        const chunkSize = 256 * 1024;
        const fullBytes = new Uint8Array(totalSize);
        let offset = 0;

        while (offset < totalSize) {
          const len = Math.min(chunkSize, totalSize - offset);
          const base64Chunk = window.AndroidBridge.getChunk(offset, len);
          const binaryStr = window.atob(base64Chunk);
          for (let i = 0; i < binaryStr.length; i++) {
            fullBytes[offset + i] = binaryStr.charCodeAt(i);
          }
          offset += len;
        }

        const buffer = fullBytes.buffer;
        const lowerName = (fileName || '').toLowerCase();
        if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
          renderPdf(buffer);
        } else {
          renderDocx(buffer);
        }
      } catch (err) {
        hideLoading();
        console.error('Bridge chunk read error:', err);
        alert('Lỗi nạp tệp từ Android: ' + err.message);
      }
    }, 20);
  };

  // Legacy direct base64 fallback
  window.openDocumentFromNative = function(base64Data, fileName, mimeType) {
    showLoading(`Đang mở ${fileName}...`);
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;

      const lowerName = (fileName || '').toLowerCase();
      if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
        renderPdf(buffer);
      } else {
        renderDocx(buffer);
      }
    } catch (err) {
      hideLoading();
      alert('Lỗi giải mã tệp từ Android: ' + err.message);
    }
  };

  // Signal to native bridge that the web view is fully ready
  if (window.AndroidBridge && typeof window.AndroidBridge.onAppReady === 'function') {
    window.AndroidBridge.onAppReady();
  }
}

// Bootstrap when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
