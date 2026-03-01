(() => {
  const MAX_CANVAS_EDGE = 1600;
  const LINE_THRESHOLD = 112;
  const MAX_HISTORY = 20;

  const PALETTE = [
    "#ff4d6d", "#ff6b6b", "#ff922b", "#ffd43b", "#95d82f", "#38d9a9",
    "#15aabf", "#228be6", "#5c7cfa", "#9775fa", "#cc5de8", "#f06595",
    "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#a0c4ff", "#bdb2ff",
  ];

  const fallbackPages = [
    {
      id: "90",
      name: "Valentine Harbor",
      src: "Assets/optimized/90_Valentines.webp",
      fallbackSrc: "Assets/90_Valentines.PNG",
      thumb: "Assets/thumbs/90_Valentines_thumb.webp",
    },
    {
      id: "91",
      name: "Friendship Boats",
      src: "Assets/optimized/91_Valentines.webp",
      fallbackSrc: "Assets/91_Valentines.PNG",
      thumb: "Assets/thumbs/91_Valentines_thumb.webp",
    },
    {
      id: "92",
      name: "Hearts Coastline",
      src: "Assets/optimized/92_Valentines.webp",
      fallbackSrc: "Assets/92_Valentines.PNG",
      thumb: "Assets/thumbs/92_Valentines_thumb.webp",
    },
    {
      id: "93",
      name: "Love Lighthouse",
      src: "Assets/optimized/93_Valentines.webp",
      fallbackSrc: "Assets/93_Valentines.PNG",
      thumb: "Assets/thumbs/93_Valentines_thumb.webp",
    },
  ];

  const refs = {
    appShell: document.getElementById("appShell"),
    galleryView: document.getElementById("galleryView"),
    editorView: document.getElementById("editorView"),
    galleryGrid: document.getElementById("galleryGrid"),
    titleText: document.getElementById("titleText"),
    backBtn: document.getElementById("backBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    resetViewBtn: document.getElementById("resetViewBtn"),
    toolbarDock: document.getElementById("toolbarDock"),
    viewport: document.getElementById("viewport"),
    artworkLayer: document.getElementById("artworkLayer"),
    displayCanvas: document.getElementById("displayCanvas"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    statusMsg: document.getElementById("statusMsg"),
    palette: document.getElementById("palette"),
    recentColors: document.getElementById("recentColors"),
    customColorInput: document.getElementById("customColorInput"),
    currentColor: document.getElementById("currentColor"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    clearBtn: document.getElementById("clearBtn"),
    saveBtn: document.getElementById("saveBtn"),
    a2hsModal: document.getElementById("a2hsModal"),
    closeA2hsBtn: document.getElementById("closeA2hsBtn"),
  };

  const displayCtx = refs.displayCanvas.getContext("2d", { willReadFrequently: true });
  const fillCanvas = document.createElement("canvas");
  const fillCtx = fillCanvas.getContext("2d", { willReadFrequently: true });
  const lineCanvas = document.createElement("canvas");
  const lineCtx = lineCanvas.getContext("2d", { willReadFrequently: true });

  let pages = [];
  let currentPage = null;
  let currentColor = refs.customColorInput.value;
  let recentColors = StorageUtil.getRecentColors();
  let lineMask = null;
  let zoomController = null;
  let currentImage = null;
  let isEditor = false;
  let undoStack = [];
  let redoStack = [];
  let persistTimer = null;

  function setStatus(message, isError = false) {
    refs.statusMsg.textContent = message;
    refs.statusMsg.style.color = isError ? "#d6336c" : "";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRGBA(hex) {
    const normalized = hex.replace("#", "");
    const value = normalized.length === 3
      ? normalized.split("").map((item) => item + item).join("")
      : normalized;

    const int = Number.parseInt(value, 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255, 255];
  }

  function cloneImageData(imageData) {
    return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  }

  function pushHistory(stack, imageData) {
    stack.push(cloneImageData(imageData));
    if (stack.length > MAX_HISTORY) {
      stack.shift();
    }
  }

  function renderPalette() {
    refs.palette.innerHTML = "";

    PALETTE.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.style.background = color;
      btn.setAttribute("aria-label", `Use color ${color}`);
      btn.setAttribute("aria-pressed", String(color.toLowerCase() === currentColor.toLowerCase()));
      btn.addEventListener("click", () => applyColorSelection(color));
      refs.palette.appendChild(btn);
    });
  }

  function renderRecentColors() {
    refs.recentColors.innerHTML = "";

    for (let i = 0; i < 5; i += 1) {
      const color = recentColors[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";

      if (!color) {
        btn.classList.add("empty");
        btn.disabled = true;
        btn.setAttribute("aria-label", "Empty recent color slot");
      } else {
        btn.style.background = color;
        btn.setAttribute("aria-label", `Use recent color ${color}`);
        btn.setAttribute("aria-pressed", String(color.toLowerCase() === currentColor.toLowerCase()));
        btn.addEventListener("click", () => applyColorSelection(color));
      }

      refs.recentColors.appendChild(btn);
    }
  }

  function syncColorUI() {
    refs.customColorInput.value = currentColor;
    refs.currentColor.style.background = currentColor;

    refs.palette.querySelectorAll(".swatch").forEach((swatch) => {
      const bg = swatch.style.background;
      swatch.setAttribute("aria-pressed", String(bg.toLowerCase() === currentColor.toLowerCase()));
    });

    refs.recentColors.querySelectorAll(".swatch").forEach((swatch) => {
      const bg = swatch.style.background;
      swatch.setAttribute("aria-pressed", String(bg && bg.toLowerCase() === currentColor.toLowerCase()));
    });
  }

  function addRecentColor(color) {
    recentColors = [color, ...recentColors.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, 5);
    StorageUtil.saveRecentColors(recentColors);
    renderRecentColors();
    syncColorUI();
  }

  function applyColorSelection(color) {
    currentColor = color;
    syncColorUI();
    addRecentColor(color);
  }

  function renderGallery() {
    refs.galleryGrid.innerHTML = "";

    pages.forEach((page) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "gallery-card";
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `Open ${page.name}`);

      const hasProgress = StorageUtil.hasProgress(page.id);

      card.innerHTML = `
        <img src="${page.thumb}" alt="${page.name} thumbnail" loading="lazy" decoding="async">
        <div class="gallery-card-body">
          <p class="gallery-card-title">${page.name}</p>
          <div class="gallery-card-meta">
            <span class="dot ${hasProgress ? "progress" : ""}"></span>
            <span>${hasProgress ? "In progress" : "Not started"}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => openEditor(page.id));
      refs.galleryGrid.appendChild(card);
    });
  }

  function showLoading(show) {
    refs.loadingOverlay.hidden = !show;
  }

  function resizeWithinBounds(width, height) {
    const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height));
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  function clearFillToWhite() {
    fillCtx.fillStyle = "#ffffff";
    fillCtx.fillRect(0, 0, fillCanvas.width, fillCanvas.height);
  }

  function renderComposite() {
    displayCtx.clearRect(0, 0, refs.displayCanvas.width, refs.displayCanvas.height);
    displayCtx.drawImage(fillCanvas, 0, 0);
    displayCtx.save();
    displayCtx.globalCompositeOperation = "multiply";
    displayCtx.drawImage(lineCanvas, 0, 0);
    displayCtx.restore();
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
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (a > 20 && lum < LINE_THRESHOLD) {
        mask[i] = 1;
      }
    }

    return mask;
  }

  async function loadImageWithFallback(page) {
    const sources = [page.src, page.fallbackSrc].filter(Boolean);

    for (const source of sources) {
      // eslint-disable-next-line no-await-in-loop
      const image = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = source;
      });

      if (image) {
        return image;
      }
    }

    return null;
  }

  async function restoreSavedFill(pageId) {
    const saved = StorageUtil.getPageFill(pageId);
    if (!saved || !saved.dataUrl) {
      clearFillToWhite();
      return;
    }

    const image = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = saved.dataUrl;
    });

    if (!image) {
      clearFillToWhite();
      return;
    }

    fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
    fillCtx.drawImage(image, 0, 0, fillCanvas.width, fillCanvas.height);
  }

  function updateUndoRedoButtons() {
    refs.undoBtn.disabled = undoStack.length === 0;
    refs.redoBtn.disabled = redoStack.length === 0;
  }

  function persistFillSnapshotSoon() {
    if (!currentPage) {
      return;
    }

    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const dataUrl = fillCanvas.toDataURL("image/webp", 0.86);
        StorageUtil.savePageFill(currentPage.id, dataUrl);
      } catch (error) {
        // Ignore storage errors.
      }
      renderGallery();
    }, 180);
  }

  function attemptFillAt(artX, artY) {
    if (!lineMask || !currentPage) {
      return;
    }

    const width = fillCanvas.width;
    const height = fillCanvas.height;
    const x = Math.floor(clamp(artX, 0, width - 1));
    const y = Math.floor(clamp(artY, 0, height - 1));
    const startIndex = y * width + x;

    if (lineMask[startIndex] === 1) {
      setStatus("Tap inside an open white area.");
      return;
    }

    const imageData = fillCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const offset = startIndex * 4;
    const target = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    const fill = hexToRGBA(currentColor);

    if (
      target[0] === fill[0] &&
      target[1] === fill[1] &&
      target[2] === fill[2] &&
      target[3] === fill[3]
    ) {
      return;
    }

    const before = fillCtx.getImageData(0, 0, width, height);

    const visited = new Uint8Array(width * height);
    const stack = [startIndex];
    let changed = false;

    while (stack.length) {
      const index = stack.pop();
      if (visited[index] === 1 || lineMask[index] === 1) {
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

      const px = index % width;
      const py = Math.floor(index / width);
      if (px > 0) stack.push(index - 1);
      if (px < width - 1) stack.push(index + 1);
      if (py > 0) stack.push(index - width);
      if (py < height - 1) stack.push(index + width);
    }

    if (!changed) {
      return;
    }

    pushHistory(undoStack, before);
    redoStack = [];
    fillCtx.putImageData(imageData, 0, 0);
    renderComposite();
    updateUndoRedoButtons();
    persistFillSnapshotSoon();
    setStatus("Filled.");
  }

  function undo() {
    if (undoStack.length === 0) {
      return;
    }

    const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
    pushHistory(redoStack, current);
    const previous = undoStack.pop();
    fillCtx.putImageData(previous, 0, 0);
    renderComposite();
    updateUndoRedoButtons();
    persistFillSnapshotSoon();
    setStatus("Undid last fill.");
  }

  function redo() {
    if (redoStack.length === 0) {
      return;
    }

    const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
    pushHistory(undoStack, current);
    const next = redoStack.pop();
    fillCtx.putImageData(next, 0, 0);
    renderComposite();
    updateUndoRedoButtons();
    persistFillSnapshotSoon();
    setStatus("Redid fill.");
  }

  function clearPage() {
    const current = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height);
    let hasInk = false;
    for (let i = 0; i < current.data.length; i += 4) {
      if (current.data[i] !== 255 || current.data[i + 1] !== 255 || current.data[i + 2] !== 255) {
        hasInk = true;
        break;
      }
    }

    if (!hasInk) {
      return;
    }

    pushHistory(undoStack, current);
    redoStack = [];
    clearFillToWhite();
    renderComposite();
    updateUndoRedoButtons();
    persistFillSnapshotSoon();
    setStatus("Page cleared.");
  }

  async function savePNG() {
    if (!currentImage || !currentPage) {
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = currentImage.naturalWidth;
    exportCanvas.height = currentImage.naturalHeight;

    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.drawImage(fillCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.save();
    exportCtx.globalCompositeOperation = "multiply";
    exportCtx.drawImage(lineCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.restore();

    const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png"));
    if (!blob) {
      return;
    }

    const fileName = `${currentPage.name.toLowerCase().replace(/\s+/g, "-")}.png`;

    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: currentPage.name });
          setStatus("Shared.");
          return;
        }
      } catch (error) {
        // Fall through to download.
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus("Saved PNG.");
  }

  function updateEditorHeader() {
    refs.titleText.textContent = currentPage ? currentPage.name : "Color Cove";
  }

  async function openEditor(pageId) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) {
      return;
    }

    currentPage = page;
    StorageUtil.saveLastPage(page.id);

    isEditor = true;
    document.body.classList.add("editor-active");
    refs.galleryView.hidden = true;
    refs.editorView.hidden = false;
    refs.toolbarDock.hidden = false;
    refs.backBtn.hidden = false;
    refs.zoomInBtn.hidden = false;
    refs.zoomOutBtn.hidden = false;

    updateEditorHeader();
    showLoading(true);
    setStatus("Loading page...");

    const loadedImage = await loadImageWithFallback(page);
    if (!loadedImage) {
      showLoading(false);
      setStatus("Could not load this page.", true);
      return;
    }

    currentImage = loadedImage;

    const size = resizeWithinBounds(loadedImage.naturalWidth, loadedImage.naturalHeight);
    refs.displayCanvas.width = size.width;
    refs.displayCanvas.height = size.height;
    fillCanvas.width = size.width;
    fillCanvas.height = size.height;
    lineCanvas.width = size.width;
    lineCanvas.height = size.height;

    lineCtx.clearRect(0, 0, size.width, size.height);
    lineCtx.drawImage(loadedImage, 0, 0, size.width, size.height);

    await restoreSavedFill(page.id);

    try {
      lineMask = computeLineMask();
    } catch (error) {
      lineMask = null;
      setStatus("Fill is unavailable on this device/browser.", true);
    }

    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();

    renderComposite();

    if (!zoomController) {
      zoomController = new ZoomController({
        viewport: refs.viewport,
        layer: refs.artworkLayer,
        onTap: ({ x, y }) => {
          if (!isEditor) {
            return;
          }
          attemptFillAt(x, y);
        },
        onChange: ({ zoomLevel }) => {
          const percent = Math.round(zoomLevel * 100);
          refs.statusMsg.textContent = `Zoom ${percent}%`;
        },
      });
    }

    zoomController.setContentSize(size.width, size.height);
    showLoading(false);
    setStatus("Tap a shape to fill. Pinch or drag to zoom and pan.");

    location.hash = `page=${page.id}`;
  }

  function openGallery() {
    isEditor = false;
    document.body.classList.remove("editor-active");
    refs.galleryView.hidden = false;
    refs.editorView.hidden = true;
    refs.toolbarDock.hidden = true;
    refs.backBtn.hidden = true;
    refs.zoomInBtn.hidden = true;
    refs.zoomOutBtn.hidden = true;
    refs.titleText.textContent = "Color Cove";
    setStatus("");
    location.hash = "";
    renderGallery();
  }

  function toggleTip(targetId) {
    const popover = document.getElementById(targetId);
    if (!popover) {
      return;
    }

    const isHidden = popover.hidden;
    document.querySelectorAll(".tip-popover").forEach((el) => {
      el.hidden = true;
    });
    popover.hidden = !isHidden;
  }

  function setupEvents() {
    refs.backBtn.addEventListener("click", openGallery);
    refs.undoBtn.addEventListener("click", undo);
    refs.redoBtn.addEventListener("click", redo);
    refs.clearBtn.addEventListener("click", clearPage);
    refs.saveBtn.addEventListener("click", savePNG);

    refs.zoomInBtn.addEventListener("click", () => {
      if (!zoomController) {
        return;
      }
      zoomController.zoomByStep(1.2, refs.viewport.clientWidth / 2, refs.viewport.clientHeight / 2);
    });

    refs.zoomOutBtn.addEventListener("click", () => {
      if (!zoomController) {
        return;
      }
      zoomController.zoomByStep(1 / 1.2, refs.viewport.clientWidth / 2, refs.viewport.clientHeight / 2);
    });

    refs.resetViewBtn.addEventListener("click", () => {
      if (zoomController) {
        zoomController.resetView();
      }
      setStatus("View reset.");
    });

    refs.customColorInput.addEventListener("input", (event) => {
      applyColorSelection(event.target.value);
    });

    document.querySelectorAll(".tip-btn").forEach((btn) => {
      btn.addEventListener("click", () => toggleTip(btn.dataset.tipTarget));
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".tip-btn") && !event.target.closest(".tip-popover")) {
        document.querySelectorAll(".tip-popover").forEach((popover) => {
          popover.hidden = true;
        });
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!isEditor) {
        return;
      }

      if (event.key === "Escape") {
        openGallery();
      }

      if ((event.key === "+" || event.key === "=") && zoomController) {
        event.preventDefault();
        zoomController.zoomByStep(1.2, refs.viewport.clientWidth / 2, refs.viewport.clientHeight / 2);
      }

      if ((event.key === "-" || event.key === "_") && zoomController) {
        event.preventDefault();
        zoomController.zoomByStep(1 / 1.2, refs.viewport.clientWidth / 2, refs.viewport.clientHeight / 2);
      }

      if (event.key === "0" && zoomController) {
        event.preventDefault();
        zoomController.resetView();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    });

    refs.closeA2hsBtn.addEventListener("click", () => {
      StorageUtil.saveA2hsSeen();
      refs.a2hsModal.hidden = true;
    });

    refs.a2hsModal.addEventListener("click", (event) => {
      if (event.target === refs.a2hsModal) {
        StorageUtil.saveA2hsSeen();
        refs.a2hsModal.hidden = true;
      }
    });

    window.addEventListener("hashchange", () => {
      const match = location.hash.match(/page=([a-zA-Z0-9_-]+)/);
      if (match) {
        openEditor(match[1]);
      } else {
        openGallery();
      }
    });
  }

  async function loadPages() {
    try {
      const response = await fetch("pages/pages.json");
      if (!response.ok) {
        throw new Error("Failed to fetch page data");
      }
      return await response.json();
    } catch (error) {
      return fallbackPages;
    }
  }

  function maybeShowA2HSModal() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const alreadySeen = StorageUtil.getA2hsSeen();

    if (standalone || alreadySeen) {
      return;
    }

    setTimeout(() => {
      refs.a2hsModal.hidden = false;
    }, 800);
  }

  async function init() {
    renderPalette();
    renderRecentColors();
    syncColorUI();
    setupEvents();

    pages = await loadPages();
    renderGallery();

    const initialHash = location.hash.match(/page=([a-zA-Z0-9_-]+)/);
    const lastPage = StorageUtil.getLastPage();

    if (initialHash) {
      openEditor(initialHash[1]);
    } else if (lastPage && pages.some((page) => page.id === lastPage)) {
      openEditor(lastPage);
    } else {
      openGallery();
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }

    maybeShowA2HSModal();
  }

  init();
})();
