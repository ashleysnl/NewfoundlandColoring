const pages = [
  { id: "90", title: "Valentine 90", src: "Assets/90_Valentines.PNG" },
  { id: "91", title: "Valentine 91", src: "Assets/91_Valentines.PNG" },
  { id: "92", title: "Valentine 92", src: "Assets/92_Valentines.PNG" },
  { id: "93", title: "Valentine 93", src: "Assets/93_Valentines.PNG" },
];

const paletteColors = [
  "#ff5d8f",
  "#f95d23",
  "#ffbe0b",
  "#8ac926",
  "#2ec4b6",
  "#1982c4",
  "#6a4c93",
  "#ef476f",
  "#f4a261",
  "#ffd166",
  "#06d6a0",
  "#118ab2",
  "#9b5de5",
  "#ff99c8",
  "#adb5ff",
];

const MAX_HISTORY = 20;
const MAX_CANVAS_EDGE = 1600;
const LINE_BARRIER_THRESHOLD = 120;

const stateByPage = {};

const pageListEl = document.getElementById("pageList");
const paletteEl = document.getElementById("palette");
const colorPickerEl = document.getElementById("colorPicker");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const canvas = document.getElementById("paintCanvas");
const statusMsgEl = document.getElementById("statusMsg");

const viewCtx = canvas.getContext("2d", { willReadFrequently: true });
const fillCanvas = document.createElement("canvas");
const fillCtx = fillCanvas.getContext("2d", { willReadFrequently: true });
const lineCanvas = document.createElement("canvas");
const lineCtx = lineCanvas.getContext("2d", { willReadFrequently: true });

let activePageId = pages[0].id;
let selectedColor = colorPickerEl.value;

function setStatus(message, isError = false) {
  if (!statusMsgEl) {
    return;
  }
  statusMsgEl.textContent = message;
  statusMsgEl.classList.toggle("error", isError);
}

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function getPageState(pageId) {
  if (!stateByPage[pageId]) {
    stateByPage[pageId] = {
      width: 0,
      height: 0,
      fillData: null,
      lineMask: null,
      undoStack: [],
      redoStack: [],
    };
  }
  return stateByPage[pageId];
}

function renderPageList() {
  pageListEl.innerHTML = "";

  pages.forEach((page) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn";
    btn.setAttribute("aria-pressed", String(page.id === activePageId));
    btn.innerHTML = `<img src="${page.src}" alt="${page.title} preview"><span>${page.title}</span>`;
    btn.addEventListener("click", () => {
      if (page.id !== activePageId) {
        persistCurrentPage();
        loadPage(page.id);
      }
    });
    pageListEl.appendChild(btn);
  });
}

function renderPalette() {
  paletteEl.innerHTML = "";

  paletteColors.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.style.background = color;
    btn.setAttribute("aria-label", `Select ${color}`);
    btn.setAttribute("aria-pressed", String(color.toLowerCase() === selectedColor.toLowerCase()));
    btn.addEventListener("click", () => {
      selectedColor = color;
      colorPickerEl.value = color;
      syncPalette();
    });
    paletteEl.appendChild(btn);
  });
}

function syncPalette() {
  const swatches = paletteEl.querySelectorAll(".swatch");
  swatches.forEach((swatch) => {
    const rgb = window.getComputedStyle(swatch).backgroundColor;
    const hex = rgbToHex(rgb).toLowerCase();
    swatch.setAttribute("aria-pressed", String(hex === selectedColor.toLowerCase()));
  });
}

function rgbToHex(rgb) {
  if (rgb.startsWith("#")) {
    return rgb;
  }

  const parts = rgb.match(/\d+/g);
  if (!parts || parts.length < 3) {
    return "#000000";
  }

  return `#${parts
    .slice(0, 3)
    .map((value) => Number(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgba(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;

  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255, 255];
}

function pushHistory(stack, imageData) {
  stack.push(cloneImageData(imageData));
  if (stack.length > MAX_HISTORY) {
    stack.shift();
  }
}

function resizeWithinBounds(width, height) {
  const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function fillWhiteBackground() {
  fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
  fillCtx.fillStyle = "#ffffff";
  fillCtx.fillRect(0, 0, fillCanvas.width, fillCanvas.height);
}

function renderComposite() {
  viewCtx.clearRect(0, 0, canvas.width, canvas.height);
  viewCtx.drawImage(fillCanvas, 0, 0);
  viewCtx.save();
  viewCtx.globalCompositeOperation = "multiply";
  viewCtx.drawImage(lineCanvas, 0, 0);
  viewCtx.restore();
}

function persistCurrentPage() {
  if (!canvas.width || !canvas.height) {
    return;
  }

  const pageState = getPageState(activePageId);
  pageState.fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
}

function computeLineMask() {
  const imageData = lineCtx.getImageData(0, 0, lineCanvas.width, lineCanvas.height);
  const pixels = imageData.data;
  const mask = new Uint8Array(lineCanvas.width * lineCanvas.height);

  for (let i = 0; i < mask.length; i += 1) {
    const o = i * 4;
    const r = pixels[o];
    const g = pixels[o + 1];
    const b = pixels[o + 2];
    const a = pixels[o + 3];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (a > 20 && luminance < LINE_BARRIER_THRESHOLD) {
      mask[i] = 1;
    }
  }

  return mask;
}

function restoreFillForPage(pageState) {
  if (
    pageState.fillData &&
    pageState.fillData.width === fillCanvas.width &&
    pageState.fillData.height === fillCanvas.height
  ) {
    fillCtx.putImageData(pageState.fillData, 0, 0);
  } else {
    fillWhiteBackground();
    pageState.fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
  }
}

function updateButtons() {
  const pageState = getPageState(activePageId);
  undoBtn.disabled = pageState.undoStack.length === 0;
  redoBtn.disabled = pageState.redoStack.length === 0;
}

function getCurrentPage() {
  return pages.find((page) => page.id === activePageId);
}

function loadPage(pageId) {
  activePageId = pageId;
  const page = getCurrentPage();
  const pageState = getPageState(pageId);
  const image = new Image();
  setStatus("Loading page...");

  image.onload = () => {
    if (activePageId !== pageId) {
      return;
    }

    const size = resizeWithinBounds(image.naturalWidth, image.naturalHeight);

    canvas.width = size.width;
    canvas.height = size.height;
    fillCanvas.width = size.width;
    fillCanvas.height = size.height;
    lineCanvas.width = size.width;
    lineCanvas.height = size.height;

    lineCtx.clearRect(0, 0, size.width, size.height);
    lineCtx.drawImage(image, 0, 0, size.width, size.height);

    pageState.width = size.width;
    pageState.height = size.height;

    restoreFillForPage(pageState);
    renderComposite();
    setStatus("Page ready. Click inside a shape to fill.");

    try {
      pageState.lineMask = computeLineMask();
    } catch (error) {
      pageState.lineMask = null;
      setStatus("Could not activate fill on this page. Serve the app over http://localhost to enable canvas fill.", true);
    }

    updateButtons();
    renderPageList();
  };

  image.onerror = () => {
    pageState.lineMask = null;
    canvas.width = 0;
    canvas.height = 0;
    setStatus(`Could not load image: ${page.src}`, true);
  };

  image.src = page.src;
}

function getCanvasPoint(event) {
  const point = getClientPoint(event);
  if (!point) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor((point.clientX - rect.left) * scaleX))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor((point.clientY - rect.top) * scaleY))),
  };
}

function getClientPoint(event) {
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  if (event.changedTouches && event.changedTouches.length > 0) {
    return {
      clientX: event.changedTouches[0].clientX,
      clientY: event.changedTouches[0].clientY,
    };
  }

  if (event.touches && event.touches.length > 0) {
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
    };
  }

  return null;
}

function bucketFill(startX, startY) {
  const pageState = getPageState(activePageId);
  if (!pageState.lineMask) {
    setStatus("Fill is unavailable until the page image is fully loaded.", true);
    return;
  }

  const width = fillCanvas.width;
  const height = fillCanvas.height;
  const startIndex = startY * width + startX;

  if (pageState.lineMask[startIndex] === 1) {
    return;
  }

  const imageData = fillCtx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const targetOffset = startIndex * 4;
  const target = [
    data[targetOffset],
    data[targetOffset + 1],
    data[targetOffset + 2],
    data[targetOffset + 3],
  ];
  const fill = hexToRgba(selectedColor);

  if (
    target[0] === fill[0] &&
    target[1] === fill[1] &&
    target[2] === fill[2] &&
    target[3] === fill[3]
  ) {
    return;
  }

  const visited = new Uint8Array(width * height);
  const stack = [startIndex];
  let changed = false;

  while (stack.length) {
    const index = stack.pop();
    if (visited[index] === 1 || pageState.lineMask[index] === 1) {
      continue;
    }

    visited[index] = 1;

    const o = index * 4;
    if (
      data[o] !== target[0] ||
      data[o + 1] !== target[1] ||
      data[o + 2] !== target[2] ||
      data[o + 3] !== target[3]
    ) {
      continue;
    }

    data[o] = fill[0];
    data[o + 1] = fill[1];
    data[o + 2] = fill[2];
    data[o + 3] = 255;
    changed = true;

    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  if (!changed) {
    return;
  }

  const before = pageState.fillData
    ? cloneImageData(pageState.fillData)
    : fillCtx.getImageData(0, 0, width, height);

  pushHistory(pageState.undoStack, before);
  pageState.redoStack = [];

  fillCtx.putImageData(imageData, 0, 0);
  pageState.fillData = fillCtx.getImageData(0, 0, width, height);

  renderComposite();
  updateButtons();
  setStatus("Filled.");
}

function handleFillClick(event) {
  event.preventDefault();
  if (!canvas.width || !canvas.height) {
    return;
  }

  const point = getCanvasPoint(event);
  if (!point) {
    return;
  }
  bucketFill(point.x, point.y);
}

function undo() {
  const pageState = getPageState(activePageId);
  const previous = pageState.undoStack.pop();
  if (!previous) {
    return;
  }

  const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
  pushHistory(pageState.redoStack, current);

  fillCtx.putImageData(previous, 0, 0);
  pageState.fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);

  renderComposite();
  updateButtons();
}

function redo() {
  const pageState = getPageState(activePageId);
  const next = pageState.redoStack.pop();
  if (!next) {
    return;
  }

  const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
  pushHistory(pageState.undoStack, current);

  fillCtx.putImageData(next, 0, 0);
  pageState.fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);

  renderComposite();
  updateButtons();
}

function clearPage() {
  if (!fillCanvas.width || !fillCanvas.height) {
    return;
  }

  const pageState = getPageState(activePageId);
  const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
  const white = new Uint8ClampedArray(current.data.length);

  let hasColor = false;
  for (let i = 0; i < current.data.length; i += 4) {
    const r = current.data[i];
    const g = current.data[i + 1];
    const b = current.data[i + 2];
    const a = current.data[i + 3];
    if (r !== 255 || g !== 255 || b !== 255 || a !== 255) {
      hasColor = true;
    }
    white[i] = 255;
    white[i + 1] = 255;
    white[i + 2] = 255;
    white[i + 3] = 255;
  }

  if (!hasColor) {
    return;
  }

  pushHistory(pageState.undoStack, current);
  pageState.redoStack = [];

  fillCtx.putImageData(new ImageData(white, fillCanvas.width, fillCanvas.height), 0, 0);
  pageState.fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);

  renderComposite();
  updateButtons();
}

function saveAsPng() {
  if (!fillCanvas.width || !fillCanvas.height) {
    return;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = fillCanvas.width;
  exportCanvas.height = fillCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.drawImage(fillCanvas, 0, 0);
  exportCtx.save();
  exportCtx.globalCompositeOperation = "multiply";
  exportCtx.drawImage(lineCanvas, 0, 0);
  exportCtx.restore();

  const page = getCurrentPage();
  const link = document.createElement("a");
  link.download = `${page.title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

if ("PointerEvent" in window) {
  canvas.addEventListener("pointerdown", handleFillClick);
} else {
  canvas.addEventListener("touchstart", handleFillClick, { passive: false });
  canvas.addEventListener("click", handleFillClick);
}

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
clearBtn.addEventListener("click", clearPage);
saveBtn.addEventListener("click", saveAsPng);

colorPickerEl.addEventListener("input", (event) => {
  selectedColor = event.target.value;
  syncPalette();
});

renderPalette();
syncPalette();
renderPageList();
loadPage(activePageId);
