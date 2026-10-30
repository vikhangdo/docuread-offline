/**
 * DocuRead Offline - Engine for reading PDF and DOCX files 100% offline
 */

// Configure PDF.js worker to local bundled script
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
}

// App State
const state = {
  currentFile: null,
  fileType: null, // 'pdf' | 'docx'
  pdfDoc: null,
  currentPage: 1,
  totalPages: 1,
  zoomScale: 1.0,
  theme: 'dark', // 'dark' | 'light' | 'sepia'
  pageRendering: false,
  pageNumPending: null,
};

// DOM Elements
const fileInput = document.getElementById('file-input');
const emptyState = document.getElementById('empty-state');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const docViewport = document.getElementById('document-viewport');
const pdfContainer = document.getElementById('pdf-container');
const docxContainer = document.getElementById('docx-container');
const docControls = document.getElementById('doc-controls');
const mobileNavBar = document.getElementById('mobile-nav-bar');

// Pagination UI
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count-span');

// Mobile Pagination UI
const mobPrevPageBtn = document.getElementById('mob-prev-page');
const mobNextPageBtn = document.getElementById('mob-next-page');
const mobPageIndicator = document.getElementById('mob-page-indicator');

// Zoom UI
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomLevelSpan = document.getElementById('zoom-level-span');

// Header Actions
const openFileBtn = document.getElementById('open-file-btn');
const fabOpenFileBtn = document.getElementById('fab-open-file');
const themeSelect = document.getElementById('theme-select');
const btnSampleDocx = document.getElementById('btn-sample-docx');
const btnSamplePdf = document.getElementById('btn-sample-pdf');
const dropzone = document.getElementById('dropzone');

// Initialize Event Listeners
function init() {
  // Theme change
  themeSelect.addEventListener('change', (e) => {
    setTheme(e.target.value);
  });

  // File Picker Trigger
  const triggerPicker = () => {
    if (window.AndroidBridge && typeof window.AndroidBridge.pickFile === 'function') {
      window.AndroidBridge.pickFile();
    } else {
      fileInput.click();
    }
  };

  openFileBtn.addEventListener('click', triggerPicker);
  if (fabOpenFileBtn) fabOpenFileBtn.addEventListener('click', triggerPicker);
  if (dropzone) dropzone.addEventListener('click', triggerPicker);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadFile(file);
    }
  });

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
  prevPageBtn.addEventListener('click', () => changePage(-1));
  nextPageBtn.addEventListener('click', () => changePage(1));
  if (mobPrevPageBtn) mobPrevPageBtn.addEventListener('click', () => changePage(-1));
  if (mobNextPageBtn) mobNextPageBtn.addEventListener('click', () => changePage(1));

  pageNumInput.addEventListener('change', (e) => {
    const page = parseInt(e.target.value, 10);
    if (!isNaN(page) && page >= 1 && page <= state.totalPages) {
      goToPage(page);
    } else {
      pageNumInput.value = state.currentPage;
    }
  });

  // Zoom events
  zoomInBtn.addEventListener('click', () => changeZoom(0.15));
  zoomOutBtn.addEventListener('click', () => changeZoom(-0.15));
  zoomResetBtn.addEventListener('click', () => setZoom(1.0));

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

  // Setup Keyboard Shortcuts
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

// Change Theme
function setTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-sepia');
  if (theme !== 'default') {
    document.body.classList.add(`theme-${theme}`);
  }
  state.theme = theme;
}

// Show / Hide Loading
function showLoading(msg = 'Đang tải tài liệu...') {
  loadingText.textContent = msg;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Load a local file from disk/input
function loadFile(file) {
  state.currentFile = file;
  const fileName = file.name.toLowerCase();
  
  showLoading(`Đang mở ${file.name}...`);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    if (fileName.endsWith('.pdf')) {
      renderPdf(arrayBuffer);
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      renderDocx(arrayBuffer);
    } else {
      hideLoading();
      alert('Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp .pdf hoặc .docx');
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
  docxContainer.innerHTML = '';
  docxContainer.style.display = 'none';
  pdfContainer.style.display = 'flex';
  pdfContainer.innerHTML = '';

  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;
    state.zoomScale = 1.0;

    // Show controls
    emptyState.classList.add('hidden');
    docControls.classList.add('visible');
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
  pdfContainer.innerHTML = '';

  try {
    const page = await state.pdfDoc.getPage(num);
    
    // Scale for crisp high-DPI rendering
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
  docViewport.scrollTop = 0;
}

function updatePaginationUI() {
  pageNumInput.value = state.currentPage;
  pageCountSpan.textContent = `/ ${state.totalPages}`;
  prevPageBtn.disabled = (state.currentPage <= 1);
  nextPageBtn.disabled = (state.currentPage >= state.totalPages);

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
  pdfContainer.innerHTML = '';
  pdfContainer.style.display = 'none';
  docxContainer.style.display = 'block';
  docxContainer.innerHTML = '';

  try {
    if (!window.docx) {
      throw new Error('Thư viện docx-preview chưa sẵn sàng');
    }

    emptyState.classList.add('hidden');
    docControls.classList.add('visible');
    if (mobileNavBar) mobileNavBar.classList.remove('visible'); // DOCX is continuous scroll

    // Hide page navigation controls for DOCX since it flows continuously
    document.querySelector('.page-nav').style.display = 'none';

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
  } else if (state.fileType === 'docx') {
    docxContainer.style.transform = `scale(${state.zoomScale})`;
  }
}

function updateZoomUI() {
  const percent = Math.round(state.zoomScale * 100) + '%';
  zoomLevelSpan.textContent = percent;
}

// ========================
// ANDROID NATIVE BRIDGE
// ========================
function setupAndroidBridge() {
  // Method called from Android native code to open document by base64
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
document.addEventListener('DOMContentLoaded', init);
