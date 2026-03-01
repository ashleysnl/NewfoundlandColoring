(function () {
  const PREFIX = "color-cove-v2";

  function key(name) {
    return `${PREFIX}:${name}`;
  }

  function safeGetJSON(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function safeSetJSON(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function saveRecentColors(colors) {
    return safeSetJSON("recent-colors", colors.slice(0, 5));
  }

  function getRecentColors() {
    return safeGetJSON("recent-colors", []);
  }

  function savePageFill(pageId, dataUrl) {
    return safeSetJSON(`fill:${pageId}`, { dataUrl, updatedAt: Date.now() });
  }

  function getPageFill(pageId) {
    return safeGetJSON(`fill:${pageId}`, null);
  }

  function clearPageFill(pageId) {
    try {
      localStorage.removeItem(key(`fill:${pageId}`));
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasProgress(pageId) {
    const item = getPageFill(pageId);
    return !!(item && item.dataUrl);
  }

  function saveA2hsSeen() {
    return safeSetJSON("a2hs-seen", { seen: true, at: Date.now() });
  }

  function getA2hsSeen() {
    const value = safeGetJSON("a2hs-seen", { seen: false });
    return !!value.seen;
  }

  function saveLastPage(pageId) {
    return safeSetJSON("last-page", { pageId, at: Date.now() });
  }

  function getLastPage() {
    const value = safeGetJSON("last-page", null);
    return value ? value.pageId : null;
  }

  window.StorageUtil = {
    saveRecentColors,
    getRecentColors,
    savePageFill,
    getPageFill,
    clearPageFill,
    hasProgress,
    saveA2hsSeen,
    getA2hsSeen,
    saveLastPage,
    getLastPage,
  };
})();
