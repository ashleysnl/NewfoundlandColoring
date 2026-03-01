(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function center(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  class ZoomController {
    constructor(options) {
      this.viewport = options.viewport;
      this.layer = options.layer;
      this.onTap = options.onTap || (() => {});
      this.onChange = options.onChange || (() => {});

      this.minZoom = options.minZoom || 1;
      this.maxZoom = options.maxZoom || 8;
      this.doubleTapZoom = options.doubleTapZoom || 2.5;

      this.contentWidth = 1;
      this.contentHeight = 1;

      this.fitScale = 1;
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;

      this.pointers = new Map();
      this.lastTapTime = 0;
      this.lastTapPoint = null;
      this.tapCandidate = null;
      this.pinchState = null;

      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.handleTouchStart = this.handleTouchStart.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
      this.handleTouchEnd = this.handleTouchEnd.bind(this);

      this.attachEvents();
      this.resetView();
    }

    attachEvents() {
      window.addEventListener("resize", this.handleResize);

      if ("PointerEvent" in window) {
        this.viewport.addEventListener("pointerdown", this.handlePointerDown);
        this.viewport.addEventListener("pointermove", this.handlePointerMove);
        this.viewport.addEventListener("pointerup", this.handlePointerUp);
        this.viewport.addEventListener("pointercancel", this.handlePointerUp);
      } else {
        this.viewport.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        this.viewport.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        this.viewport.addEventListener("touchend", this.handleTouchEnd, { passive: false });
        this.viewport.addEventListener("touchcancel", this.handleTouchEnd, { passive: false });
      }
    }

    destroy() {
      window.removeEventListener("resize", this.handleResize);
    }

    setContentSize(width, height) {
      this.contentWidth = Math.max(1, width);
      this.contentHeight = Math.max(1, height);
      this.layer.style.width = `${this.contentWidth}px`;
      this.layer.style.height = `${this.contentHeight}px`;
      this.resetView();
    }

    handleResize() {
      const centerPoint = {
        x: this.viewport.clientWidth / 2,
        y: this.viewport.clientHeight / 2,
      };
      const art = this.toArtworkCoords(centerPoint.x, centerPoint.y);
      this.updateFitScale();
      this.scale = clamp(this.scale, this.fitScale * this.minZoom, this.fitScale * this.maxZoom);
      this.translateX = centerPoint.x - art.x * this.scale;
      this.translateY = centerPoint.y - art.y * this.scale;
      this.clampTranslation();
      this.applyTransform();
    }

    updateFitScale() {
      const w = this.viewport.clientWidth || 1;
      const h = this.viewport.clientHeight || 1;
      this.fitScale = Math.min(w / this.contentWidth, h / this.contentHeight);
    }

    resetView() {
      this.updateFitScale();
      this.scale = this.fitScale * this.minZoom;
      const w = this.contentWidth * this.scale;
      const h = this.contentHeight * this.scale;
      this.translateX = (this.viewport.clientWidth - w) / 2;
      this.translateY = (this.viewport.clientHeight - h) / 2;
      this.clampTranslation();
      this.applyTransform();
    }

    zoomByStep(step, focalX, focalY) {
      const next = clamp(this.scale * step, this.fitScale * this.minZoom, this.fitScale * this.maxZoom);
      this.zoomAt(focalX, focalY, next);
    }

    zoomAt(viewportX, viewportY, newScale) {
      const clamped = clamp(newScale, this.fitScale * this.minZoom, this.fitScale * this.maxZoom);
      const art = this.toArtworkCoords(viewportX, viewportY);
      this.scale = clamped;
      this.translateX = viewportX - art.x * this.scale;
      this.translateY = viewportY - art.y * this.scale;
      this.clampTranslation();
      this.applyTransform();
    }

    toggleDoubleTapZoom(viewportX, viewportY) {
      const minScale = this.fitScale * this.minZoom;
      const target = this.scale <= minScale * 1.05
        ? clamp(this.fitScale * this.doubleTapZoom, minScale, this.fitScale * this.maxZoom)
        : minScale;
      this.zoomAt(viewportX, viewportY, target);
    }

    clampTranslation() {
      const contentW = this.contentWidth * this.scale;
      const contentH = this.contentHeight * this.scale;
      const viewportW = this.viewport.clientWidth;
      const viewportH = this.viewport.clientHeight;

      const minX = contentW > viewportW ? viewportW - contentW : (viewportW - contentW) / 2;
      const maxX = contentW > viewportW ? 0 : (viewportW - contentW) / 2;
      const minY = contentH > viewportH ? viewportH - contentH : (viewportH - contentH) / 2;
      const maxY = contentH > viewportH ? 0 : (viewportH - contentH) / 2;

      this.translateX = clamp(this.translateX, minX, maxX);
      this.translateY = clamp(this.translateY, minY, maxY);
    }

    applyTransform() {
      this.layer.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
      this.onChange({
        scale: this.scale,
        fitScale: this.fitScale,
        zoomLevel: this.scale / this.fitScale,
      });
    }

    toArtworkCoords(viewportX, viewportY) {
      return {
        x: (viewportX - this.translateX) / this.scale,
        y: (viewportY - this.translateY) / this.scale,
      };
    }

    toViewportPointFromEvent(event) {
      const rect = this.viewport.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    handlePointerDown(event) {
      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }

      this.viewport.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size === 1) {
        this.tapCandidate = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
          time: performance.now(),
        };
      }

      if (this.pointers.size === 2) {
        const arr = Array.from(this.pointers.values());
        this.pinchState = {
          lastDistance: dist(arr[0], arr[1]),
          lastCenter: center(arr[0], arr[1]),
        };
        this.tapCandidate = null;
      }
    }

    handlePointerMove(event) {
      if (!this.pointers.has(event.pointerId)) {
        return;
      }

      const previous = this.pointers.get(event.pointerId);
      const next = { x: event.clientX, y: event.clientY };
      this.pointers.set(event.pointerId, next);

      if (this.pointers.size === 1 && this.tapCandidate && this.tapCandidate.id === event.pointerId) {
        const dx = next.x - this.tapCandidate.x;
        const dy = next.y - this.tapCandidate.y;
        if (Math.hypot(dx, dy) > 8) {
          this.tapCandidate.moved = true;
        }

        if (this.scale > this.fitScale * 1.01) {
          this.translateX += next.x - previous.x;
          this.translateY += next.y - previous.y;
          this.clampTranslation();
          this.applyTransform();
        }
      }

      if (this.pointers.size === 2 && this.pinchState) {
        const arr = Array.from(this.pointers.values());
        const newCenter = center(arr[0], arr[1]);
        const newDistance = dist(arr[0], arr[1]);
        if (newDistance <= 0) {
          return;
        }

        const scaleFactor = newDistance / this.pinchState.lastDistance;
        const rect = this.viewport.getBoundingClientRect();
        const viewportCenterX = newCenter.x - rect.left;
        const viewportCenterY = newCenter.y - rect.top;

        const nextScale = clamp(
          this.scale * scaleFactor,
          this.fitScale * this.minZoom,
          this.fitScale * this.maxZoom,
        );

        this.zoomAt(viewportCenterX, viewportCenterY, nextScale);
        this.translateX += newCenter.x - this.pinchState.lastCenter.x;
        this.translateY += newCenter.y - this.pinchState.lastCenter.y;
        this.clampTranslation();
        this.applyTransform();

        this.pinchState.lastDistance = newDistance;
        this.pinchState.lastCenter = newCenter;
      }
    }

    handlePointerUp(event) {
      if (this.pointers.has(event.pointerId)) {
        this.pointers.delete(event.pointerId);
      }

      if (this.pointers.size < 2) {
        this.pinchState = null;
      }

      if (!this.tapCandidate || this.tapCandidate.id !== event.pointerId) {
        return;
      }

      const elapsed = performance.now() - this.tapCandidate.time;
      const moved = this.tapCandidate.moved;

      if (!moved && elapsed < 250) {
        const now = performance.now();
        const rect = this.viewport.getBoundingClientRect();
        const viewportPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        if (
          this.lastTapPoint &&
          now - this.lastTapTime < 320 &&
          Math.hypot(viewportPoint.x - this.lastTapPoint.x, viewportPoint.y - this.lastTapPoint.y) < 26
        ) {
          this.toggleDoubleTapZoom(viewportPoint.x, viewportPoint.y);
          this.lastTapTime = 0;
          this.lastTapPoint = null;
        } else {
          this.lastTapTime = now;
          this.lastTapPoint = viewportPoint;
          const art = this.toArtworkCoords(viewportPoint.x, viewportPoint.y);
          this.onTap({ x: art.x, y: art.y, viewportX: viewportPoint.x, viewportY: viewportPoint.y });
        }
      }

      this.tapCandidate = null;
    }

    handleTouchStart(event) {
      event.preventDefault();
      if (event.touches.length === 1) {
        const t = event.touches[0];
        this.tapCandidate = {
          id: "touch",
          x: t.clientX,
          y: t.clientY,
          moved: false,
          time: performance.now(),
          lastX: t.clientX,
          lastY: t.clientY,
        };
        this.pinchState = null;
        return;
      }

      if (event.touches.length === 2) {
        const a = event.touches[0];
        const b = event.touches[1];
        this.pinchState = {
          lastDistance: dist(a, b),
          lastCenter: center(a, b),
        };
        this.tapCandidate = null;
      }
    }

    handleTouchMove(event) {
      event.preventDefault();
      if (event.touches.length === 1 && this.tapCandidate) {
        const t = event.touches[0];
        const dxStart = t.clientX - this.tapCandidate.x;
        const dyStart = t.clientY - this.tapCandidate.y;
        if (Math.hypot(dxStart, dyStart) > 8) {
          this.tapCandidate.moved = true;
        }

        if (this.scale > this.fitScale * 1.01) {
          this.translateX += t.clientX - this.tapCandidate.lastX;
          this.translateY += t.clientY - this.tapCandidate.lastY;
          this.clampTranslation();
          this.applyTransform();
        }

        this.tapCandidate.lastX = t.clientX;
        this.tapCandidate.lastY = t.clientY;
        return;
      }

      if (event.touches.length === 2 && this.pinchState) {
        const a = event.touches[0];
        const b = event.touches[1];
        const currentCenter = center(a, b);
        const currentDistance = dist(a, b);

        if (currentDistance <= 0) {
          return;
        }

        const scaleFactor = currentDistance / this.pinchState.lastDistance;
        const rect = this.viewport.getBoundingClientRect();
        const viewportCenterX = currentCenter.x - rect.left;
        const viewportCenterY = currentCenter.y - rect.top;
        const nextScale = clamp(
          this.scale * scaleFactor,
          this.fitScale * this.minZoom,
          this.fitScale * this.maxZoom,
        );

        this.zoomAt(viewportCenterX, viewportCenterY, nextScale);
        this.translateX += currentCenter.x - this.pinchState.lastCenter.x;
        this.translateY += currentCenter.y - this.pinchState.lastCenter.y;
        this.clampTranslation();
        this.applyTransform();

        this.pinchState.lastDistance = currentDistance;
        this.pinchState.lastCenter = currentCenter;
      }
    }

    handleTouchEnd(event) {
      event.preventDefault();
      if (event.touches.length >= 2) {
        const a = event.touches[0];
        const b = event.touches[1];
        this.pinchState = {
          lastDistance: dist(a, b),
          lastCenter: center(a, b),
        };
        this.tapCandidate = null;
        return;
      }

      if (event.touches.length === 0 && this.tapCandidate) {
        const elapsed = performance.now() - this.tapCandidate.time;
        if (!this.tapCandidate.moved && elapsed < 250) {
          const changed = event.changedTouches[0];
          const now = performance.now();
          const rect = this.viewport.getBoundingClientRect();
          const viewportPoint = {
            x: changed.clientX - rect.left,
            y: changed.clientY - rect.top,
          };

          if (
            this.lastTapPoint &&
            now - this.lastTapTime < 320 &&
            Math.hypot(viewportPoint.x - this.lastTapPoint.x, viewportPoint.y - this.lastTapPoint.y) < 26
          ) {
            this.toggleDoubleTapZoom(viewportPoint.x, viewportPoint.y);
            this.lastTapTime = 0;
            this.lastTapPoint = null;
          } else {
            this.lastTapTime = now;
            this.lastTapPoint = viewportPoint;
            const art = this.toArtworkCoords(viewportPoint.x, viewportPoint.y);
            this.onTap({ x: art.x, y: art.y, viewportX: viewportPoint.x, viewportY: viewportPoint.y });
          }
        }
      }

      this.tapCandidate = null;
      this.pinchState = null;
    }
  }

  window.ZoomController = ZoomController;
})();
