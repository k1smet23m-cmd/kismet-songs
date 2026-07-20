(function () {
  "use strict";

  var CONFIG = window.BLINDBOX_CONFIG || {};
  var SITE = CONFIG.SITE || {};
  var WEEKS = Object.assign({}, CONFIG.WEEKS || {}, window.BLINDBOX_AUTO_WEEKS || {});
  var BRAND = SITE.title || "Kismet Songs";
  var NICKNAME = SITE.nickname || "小月亮";
  var LOVE_START = SITE.loveStart || "2026-06-24";
  var FIRST_WEEK = SITE.firstWeek || "2026-W29";
  var PREOPENED_WEEKS = Array.isArray(SITE.preopenedWeeks) ? SITE.preopenedWeeks.slice() : [];
  var DRAW_ALLOWANCE_REPAIR = SITE.drawAllowanceRepair || null;
  var ACCESS_HASH = SITE.accessHash || "";
  var ACCESS_KEY = "kismet_access_granted_v1";
  var STORE_KEY_V2 = "kismet_songs_state_v2";
  var STORE_KEY_V3 = "kismet_songs_state_v3";
  var PALETTE = ["#ff9fc7", "#c5a7ff", "#91d5ff", "#ffd57a", "#8de3c7", "#ffb3c6", "#b7b0ff"];
  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BODY_FONT = '"PingFang SC", "Microsoft YaHei", "Source Han Sans SC", system-ui, sans-serif';

  function byId(id) { return document.getElementById(id); }
  function pad(value) { return String(value).padStart(2, "0"); }
  function localDateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }
  function parseLocalDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    return Math.floor(seconds / 60) + ":" + pad(Math.floor(seconds % 60));
  }
  function formatDisplayDate(value) {
    if (!value) return "";
    var date = parseLocalDate(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.getFullYear() + "." + (date.getMonth() + 1) + "." + date.getDate();
  }
  function getISOWeek(date) {
    var utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    var week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return utc.getUTCFullYear() + "-W" + pad(week);
  }
  function isoWeekMonday(weekKey) {
    var parts = String(weekKey).split("-W").map(Number);
    if (!parts[0] || !parts[1]) return null;
    var simple = new Date(Date.UTC(parts[0], 0, 4));
    var day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1 + (parts[1] - 1) * 7);
    return simple;
  }
  function weekOrdinal(weekKey, baseKey) {
    var target = isoWeekMonday(weekKey);
    var base = isoWeekMonday(baseKey);
    if (!target || !base) return 1;
    return Math.max(1, Math.floor((target - base) / 604800000) + 1);
  }
  function weekDateRange(weekKey) {
    var monday = isoWeekMonday(weekKey);
    if (!monday) return "";
    var sunday = new Date(monday.getTime());
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return (monday.getUTCMonth() + 1) + "." + monday.getUTCDate() + " — " +
      (sunday.getUTCMonth() + 1) + "." + sunday.getUTCDate();
  }
  function darken(hex, amount) {
    var clean = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(clean)) return "#b65d88";
    var number = parseInt(clean, 16);
    var r = Math.max(0, (number >> 16) - amount);
    var g = Math.max(0, ((number >> 8) & 255) - amount);
    var b = Math.max(0, (number & 255) - amount);
    return "#" + [r, g, b].map(function (part) { return part.toString(16).padStart(2, "0"); }).join("");
  }
  function uniqueNumbers(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).filter(function (value) {
      if (!Number.isInteger(value) || value < 0 || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }
  function createSvgUse(iconId) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", iconId);
    svg.setAttribute("aria-hidden", "true");
    svg.appendChild(use);
    return svg;
  }

  function getWeekData(weekKey) {
    var raw = WEEKS[weekKey];
    if (!raw || !Array.isArray(raw.songs)) return null;
    return { key: weekKey, raw: raw, songs: raw.songs.slice(0, 7) };
  }
  function getWeekLabel(weekKey) {
    var data = getWeekData(weekKey);
    return (data && data.raw.label) || ("音乐盲盒的第 " + weekOrdinal(weekKey, FIRST_WEEK) + " 周");
  }
  function getThemeName(data) {
    var name = data && data.raw && data.raw.theme && data.raw.theme.name;
    return ["default", "summer-moon", "winter-watercolor"].indexOf(name) !== -1 ? name : "default";
  }

  function emptyStore() { return { version: 3, lastDrawDate: null, appliedRepairs: [], weeks: {} }; }
  function normalizeWeekState(raw) {
    var openedAt = raw && raw.openedAt && typeof raw.openedAt === "object" ? Object.assign({}, raw.openedAt) : {};
    return { openedBoxes: uniqueNumbers(raw && raw.openedBoxes), openedAt: openedAt };
  }
  function normalizeStoreV3(raw) {
    var normalized = emptyStore();
    if (!raw || typeof raw !== "object" || !raw.weeks || typeof raw.weeks !== "object") return normalized;
    normalized.lastDrawDate = typeof raw.lastDrawDate === "string" ? raw.lastDrawDate : null;
    normalized.appliedRepairs = Array.isArray(raw.appliedRepairs)
      ? raw.appliedRepairs.filter(function (value) { return typeof value === "string"; })
      : [];
    Object.keys(raw.weeks).forEach(function (weekKey) {
      normalized.weeks[weekKey] = normalizeWeekState(raw.weeks[weekKey]);
    });
    return normalized;
  }
  function migrateStoreV2ToV3(raw) {
    var migrated = emptyStore();
    if (!raw || typeof raw !== "object" || !raw.weeks || typeof raw.weeks !== "object") return migrated;
    var dates = [];
    Object.keys(raw.weeks).forEach(function (weekKey) {
      var oldWeek = raw.weeks[weekKey] || {};
      migrated.weeks[weekKey] = normalizeWeekState(oldWeek);
      if (typeof oldWeek.lastDrawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(oldWeek.lastDrawDate)) {
        dates.push(oldWeek.lastDrawDate);
      }
    });
    dates.sort();
    migrated.lastDrawDate = dates.length ? dates[dates.length - 1] : null;
    return migrated;
  }
  function loadStore() {
    try {
      var savedV3 = JSON.parse(localStorage.getItem(STORE_KEY_V3));
      if (savedV3 && savedV3.version === 3 && savedV3.weeks) return normalizeStoreV3(savedV3);
    } catch (error) {}
    try {
      var savedV2 = JSON.parse(localStorage.getItem(STORE_KEY_V2));
      if (savedV2 && savedV2.weeks) {
        var migrated = migrateStoreV2ToV3(savedV2);
        try { localStorage.setItem(STORE_KEY_V3, JSON.stringify(migrated)); } catch (error) {}
        return migrated;
      }
    } catch (error) {}
    return emptyStore();
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY_V3, JSON.stringify(store)); } catch (error) {}
  }
  function getWeekState(weekKey, create) {
    if (!store.weeks[weekKey] && create) store.weeks[weekKey] = normalizeWeekState(null);
    return store.weeks[weekKey] || normalizeWeekState(null);
  }
  function getOpenedIndices(weekKey) {
    var data = getWeekData(weekKey);
    var total = data ? data.songs.length : 0;
    return getWeekState(weekKey, false).openedBoxes.filter(function (index) { return index < total; });
  }
  function getRemainingSongCount(weekKey) {
    var data = getWeekData(weekKey);
    return data ? Math.max(0, data.songs.length - getOpenedIndices(weekKey).length) : 0;
  }
  function hasDrawnToday() { return store.lastDrawDate === todayKey; }
  function canOpenAnyNewSong() { return !hasDrawnToday(); }
  function canOpenBox(weekKey, songIndex) {
    if (weekKey > currentWeekKey || !getWeekData(weekKey)) return false;
    return getOpenedIndices(weekKey).indexOf(songIndex) === -1 && canOpenAnyNewSong();
  }
  function configuredWeekKeys() {
    return Object.keys(WEEKS).filter(function (key) {
      var data = getWeekData(key);
      return key <= currentWeekKey && data && data.songs.length;
    }).sort();
  }
  function getIncompletePastWeeks() {
    return configuredWeekKeys().filter(function (key) { return getRemainingSongCount(key) > 0; }).sort().reverse();
  }
  function getCompletedWeeks() {
    return configuredWeekKeys().filter(function (key) { return getRemainingSongCount(key) === 0; }).sort().reverse();
  }
  function getReceivedCount() {
    return configuredWeekKeys().reduce(function (sum, key) { return sum + getOpenedIndices(key).length; }, 0);
  }
  function getGlobalSongOrdinal(weekKey, songIndex) {
    var count = 0;
    var keys = Object.keys(WEEKS).filter(function (key) { return key <= currentWeekKey && getWeekData(key); }).sort();
    for (var i = 0; i < keys.length; i += 1) {
      if (keys[i] === weekKey) return count + songIndex + 1;
      count += getWeekData(keys[i]).songs.length;
    }
    return songIndex + 1;
  }

  var params = new URLSearchParams(window.location.search);
  var currentWeekKey = getISOWeek(new Date());
  var displayedWeekKey = params.get("week") || currentWeekKey;
  var todayKey = localDateKey(new Date());
  var store = loadStore();

  function applyDrawAllowanceRepair() {
    var repair = DRAW_ALLOWANCE_REPAIR;
    if (!repair || typeof repair.date !== "string" || typeof repair.token !== "string") return;
    if (store.appliedRepairs.indexOf(repair.token) !== -1) return;
    if (todayKey === repair.date && store.lastDrawDate === repair.date) {
      store.lastDrawDate = null;
    }
    store.appliedRepairs.push(repair.token);
    saveStore();
  }
  applyDrawAllowanceRepair();

  function applyPreopenedWeeks() {
    var changed = false;
    PREOPENED_WEEKS.forEach(function (weekKey) {
      var data = getWeekData(weekKey);
      if (!data || weekKey > currentWeekKey) return;
      var state = getWeekState(weekKey, true);
      for (var index = 0; index < data.songs.length; index += 1) {
        if (state.openedBoxes.indexOf(index) === -1) {
          state.openedBoxes.push(index);
          changed = true;
        }
      }
      state.openedBoxes.sort(function (a, b) { return a - b; });
    });
    // 这里只补齐历史周进度，不修改顶层 lastDrawDate，今天仍可拆本周歌曲。
    if (changed) saveStore();
  }
  applyPreopenedWeeks();

  var drawing = false;
  var activePage = 1;
  var transitionBusy = false;
  var currentSongIndex = -1;
  var currentSongWeekKey = null;
  var playerReturnTarget = "gifts";
  var cabinetScrollY = 0;
  var giftScrollY = 0;
  var audioEnded = false;

  var pages = [byId("page1"), byId("page2"), byId("page3"), byId("page4")];
  var stage = document.querySelector(".stage");
  var veil = byId("veil");
  var envelope = byId("envelope");
  var accessGate = byId("accessGate");
  var accessForm = byId("accessForm");
  var accessPassword = byId("accessPassword");
  var accessError = byId("accessError");
  var giftPage = byId("page2");
  var giftDecor = document.querySelector(".gift-decor");
  var giftHeading = byId("giftHeading");
  var boxes = byId("boxes");
  var giftFooter = byId("giftFooter");
  var status = byId("status");
  var statusText = byId("statusText");
  var progressText = byId("progressText");
  var progressDots = byId("progressDots");
  var weekNotice = byId("weekNotice");
  var weekNoticeTitle = byId("weekNoticeTitle");
  var weekNoticeText = byId("weekNoticeText");
  var weekNoticeBtn = byId("weekNoticeBtn");
  var audio = byId("audio");
  var playButton = byId("playBtn");
  var progress = byId("progress");
  var currentTime = byId("currentTime");
  var duration = byId("duration");
  var audioHint = byId("audioHint");
  var coverArt = byId("coverArt");
  var songTitle = byId("songTitle");
  var songNote = byId("songNote");

  function setPageState(pageNumber) {
    pages.forEach(function (page, index) {
      var active = index === pageNumber - 1;
      page.classList.toggle("is-active", active);
      page.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) page.removeAttribute("inert");
      else page.setAttribute("inert", "");
    });
  }
  function focusElement(targetId) {
    var target = targetId && byId(targetId);
    if (!target) return;
    try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
  }
  function transitionTo(pageNumber, focusTarget, restoreScroll) {
    if (pageNumber === activePage || transitionBusy) return;
    transitionBusy = true;
    veil.classList.remove("exit");
    veil.classList.add("show");
    window.setTimeout(function () {
      setPageState(pageNumber);
      activePage = pageNumber;
      window.scrollTo(0, 0);
      veil.classList.add("exit");
      veil.classList.remove("show");
      window.setTimeout(function () {
        veil.style.transition = "none";
        veil.classList.remove("exit");
        void veil.offsetWidth;
        veil.style.transition = "";
        transitionBusy = false;
        focusElement(focusTarget);
        if (Number.isFinite(restoreScroll) && restoreScroll > 0) window.scrollTo(0, restoreScroll);
      }, REDUCED_MOTION ? 20 : 350);
    }, REDUCED_MOTION ? 20 : 320);
  }

  function unlockSite(shouldFocus) {
    document.body.classList.remove("is-locked");
    accessGate.hidden = true;
    accessGate.classList.remove("is-unlocking");
    stage.removeAttribute("inert");
    stage.setAttribute("aria-hidden", "false");
    if (shouldFocus) window.requestAnimationFrame(function () { envelope.focus(); });
  }
  function animateUnlock() {
    accessGate.classList.add("is-unlocking");
    window.setTimeout(function () { unlockSite(true); }, REDUCED_MOTION ? 20 : 340);
  }
  function hashText(value) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error("Web Crypto unavailable"));
    var bytes = new TextEncoder().encode(value);
    return window.crypto.subtle.digest("SHA-256", bytes).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function setupAccessGate() {
    var remembered = "";
    try { remembered = localStorage.getItem(ACCESS_KEY) || ""; } catch (error) {}
    if (!ACCESS_HASH || remembered === ACCESS_HASH) {
      unlockSite(false);
      return;
    }
    window.requestAnimationFrame(function () { accessPassword.focus(); });
    accessPassword.addEventListener("input", function () { accessError.textContent = ""; });
    accessForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var submitButton = accessForm.querySelector("button[type='submit']");
      submitButton.disabled = true;
      accessError.textContent = "";
      hashText(accessPassword.value).then(function (actualHash) {
        if (actualHash !== ACCESS_HASH) {
          accessError.textContent = "密码不对，再想一想吧";
          accessGate.querySelector(".access-card").classList.remove("has-error");
          void accessGate.offsetWidth;
          accessGate.querySelector(".access-card").classList.add("has-error");
          accessPassword.select();
          return;
        }
        try { localStorage.setItem(ACCESS_KEY, ACCESS_HASH); } catch (error) {}
        accessPassword.value = "";
        animateUnlock();
      }).catch(function () {
        accessError.textContent = "当前浏览器暂时无法验证密码";
      }).finally(function () { submitButton.disabled = false; });
    });
  }

  function fillStaticCopy() {
    byId("envTitle").textContent = BRAND;
    byId("envSub").textContent = SITE.subtitle || ("给" + NICKNAME + "的专属歌单");
    byId("envFrontTitle").textContent = BRAND;
    byId("envFrontSub").textContent = SITE.subtitle || ("给" + NICKNAME + "的专属歌单");
    var today = new Date();
    var dateText = byId("dateText");
    dateText.textContent = today.getFullYear() + "." + (today.getMonth() + 1) + "." + today.getDate();
    dateText.dateTime = localDateKey(today);
    var loveDays = Math.floor((startOfDay(today) - startOfDay(parseLocalDate(LOVE_START))) / 86400000) + 1;
    byId("loveDay").textContent = loveDays > 0 ? ("爱的第 " + loveDays + " 天") : "故事还未开始";
  }
  function updateWeekUrl(weekKey) {
    var next = new URLSearchParams(window.location.search);
    if (weekKey === currentWeekKey) next.delete("week");
    else next.set("week", weekKey);
    var url = window.location.pathname + (next.toString() ? "?" + next.toString() : "") + window.location.hash;
    window.history.replaceState({}, "", url);
  }
  function applyWeekTheme(data) {
    var theme = getThemeName(data);
    giftPage.classList.remove("theme-default", "theme-summer-moon", "theme-winter-watercolor");
    giftPage.classList.add("theme-" + theme);
    giftDecor.className = "gift-decor";
    if (theme === "winter-watercolor") giftDecor.classList.add("gift-decor--watercolor");
    if (theme === "summer-moon") giftDecor.classList.add("gift-decor--summer");
    if (data && data.raw.theme && data.raw.theme.accent) giftPage.style.setProperty("--week-accent", data.raw.theme.accent);
    else giftPage.style.removeProperty("--week-accent");
  }
  function setWeekLabel(weekKey) {
    byId("weekLabelFull").textContent = getWeekLabel(weekKey);
    byId("weekLabelShort").textContent = "第 " + weekOrdinal(weekKey, FIRST_WEEK) + " 周";
  }
  function setStatus(message, locked) {
    statusText.textContent = message;
    status.classList.toggle("is-locked", Boolean(locked));
    var use = status.querySelector("use");
    if (use) use.setAttribute("href", locked ? "#icon-lock" : "#icon-spark");
  }
  function hideWeekNotice() {
    weekNotice.hidden = true;
    weekNoticeBtn.dataset.action = "";
  }
  function showWeekNotice(title, text, buttonText, action) {
    weekNotice.hidden = false;
    weekNoticeTitle.textContent = title;
    weekNoticeText.textContent = text;
    weekNoticeBtn.textContent = buttonText;
    weekNoticeBtn.dataset.action = action;
  }
  function updateProgress(weekKey, total) {
    var opened = getOpenedIndices(weekKey);
    progressText.textContent = (weekKey === currentWeekKey ? "本周已拆 " : "这一周已拆 ") + opened.length + " / " + total;
    progressDots.innerHTML = "";
    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement("i");
      if (opened.indexOf(i) !== -1) dot.className = "is-done";
      progressDots.appendChild(dot);
    }
  }
  function updateCabinetPreview() {
    var received = getReceivedCount();
    var unfinished = getIncompletePastWeeks().reduce(function (sum, key) {
      return sum + (key < currentWeekKey ? getRemainingSongCount(key) : 0);
    }, 0);
    byId("cabinetPreviewText").textContent = "已经收下 " + received + " 首歌" + (unfinished ? " · 还有 " + unfinished + " 份以前的礼物" : "");
  }

  function buildBoxes(weekKey) {
    var data = getWeekData(weekKey);
    var songs = data ? data.songs : [];
    var state = getWeekState(weekKey, false);
    var opened = getOpenedIndices(weekKey);
    boxes.innerHTML = "";
    songs.forEach(function (song, index) {
      var isOpened = opened.indexOf(index) !== -1;
      var isAllowed = canOpenBox(weekKey, index);
      var openedDate = state.openedAt && state.openedAt[String(index)];
      var box = document.createElement("button");
      var color = song.color || PALETTE[index % PALETTE.length];
      box.type = "button";
      box.className = "gift-box" + (isOpened ? " opened" : "") + (!isOpened && !isAllowed ? " is-locked" : "");
      if (isOpened && openedDate === todayKey) box.classList.add("is-newly-opened");
      else if (isOpened) box.classList.add("is-history-opened");
      box.dataset.index = String(index);
      box.style.setProperty("--box-color", color);
      box.style.setProperty("--box-dark", darken(color, 28));
      box.setAttribute("aria-label", isOpened
        ? ("重听第 " + (index + 1) + " 份礼物：" + (song.title || "歌曲"))
        : (isAllowed ? ("拆开第 " + (index + 1) + " 份音乐盲盒") : ("已锁定的第 " + (index + 1) + " 份礼物，下一份礼物明天见")));
      box.innerHTML =
        '<span class="gift-box__body"></span>' +
        '<span class="gift-box__lid"></span>' +
        '<span class="gift-box__bow"></span>' +
        '<span class="gift-box__knot"></span>' +
        '<span class="gift-box__number">' + (isOpened ? "♪" : pad(index + 1)) + '</span>' +
        '<span class="gift-box__reveal-card"><span></span></span>' +
        '<span class="gift-box__song"></span>' +
        '<span class="gift-box__lock"><svg aria-hidden="true"><use href="#icon-lock"></use></svg></span>';
      box.querySelector(".gift-box__song").textContent = isOpened ? (song.title || "今天的歌") : "";
      box.querySelector(".gift-box__reveal-card span").textContent = isOpened ? (song.title || "今天的歌") : "";
      box.addEventListener("click", function () { handleBoxClick(weekKey, index, box); });
      boxes.appendChild(box);
    });
    updateProgress(weekKey, songs.length);
  }

  function refreshStatus(weekKey) {
    var data = getWeekData(weekKey);
    if (!data) return;
    var opened = getOpenedIndices(weekKey);
    var allOpened = data.songs.length > 0 && opened.length >= data.songs.length;
    if (allOpened) {
      giftHeading.textContent = "七首歌，都被你好好收下了";
      setStatus("这一周已经集齐，随时回来重听。", false);
    } else if (hasDrawnToday()) {
      giftHeading.textContent = weekKey === currentWeekKey ? "今天的歌，已经被你找到" : "以前的礼物，也一直在等你";
      setStatus("今天的歌已经被你找到，下一份礼物明天见。", true);
    } else if (weekKey < currentWeekKey) {
      giftHeading.textContent = "以前的礼物，也一直在等你";
      setStatus("什么时候回来都不算晚，今天依然可以收下一首歌。", false);
    } else {
      giftHeading.textContent = "今天的礼物，还在等你";
      setStatus("今天可以拆一份，选一个心动的盒子。", false);
    }
  }

  function renderNoCurrentWeekState() {
    boxes.hidden = true;
    boxes.innerHTML = "";
    giftFooter.hidden = true;
    giftHeading.textContent = "这周的歌，还在赶来的路上";
    var incomplete = getIncompletePastWeeks().filter(function (key) { return key < currentWeekKey; });
    var remaining = incomplete.reduce(function (sum, key) { return sum + getRemainingSongCount(key); }, 0);
    if (remaining) {
      showWeekNotice(
        "新的七份礼物还没有送达",
        "可以先继续收下以前留下的惊喜。",
        "继续收下未拆完的礼物 · " + remaining + " 首",
        "open-incomplete"
      );
    } else {
      showWeekNotice(
        "新的七份礼物还没有送达",
        "可以先看看以前收到的歌。",
        "去我们的歌柜",
        "cabinet"
      );
    }
  }
  function renderFutureState() {
    boxes.hidden = true;
    boxes.innerHTML = "";
    giftFooter.hidden = true;
    giftHeading.textContent = "这封未来的礼物，还没有到打开的时候";
    showWeekNotice(
      "月光替你守着这封信",
      "等它真正来到这一周，七份礼物才会出现。",
      "返回当前周",
      "current-week"
    );
  }
  function renderMissingHistoricalState() {
    boxes.hidden = true;
    boxes.innerHTML = "";
    giftFooter.hidden = true;
    giftHeading.textContent = "这一周的歌，没有留在这里";
    showWeekNotice("没有找到这周的礼物", "可以回到本周，或者去歌柜看看已经收到的歌。", "返回当前周", "current-week");
  }
  function renderConfiguredWeek(weekKey) {
    var data = getWeekData(weekKey);
    boxes.hidden = false;
    giftFooter.hidden = false;
    buildBoxes(weekKey);
    refreshStatus(weekKey);
    hideWeekNotice();
    if (weekKey === currentWeekKey) {
      var oldIncomplete = getIncompletePastWeeks().filter(function (key) { return key < currentWeekKey; });
      var remaining = oldIncomplete.reduce(function (sum, key) { return sum + getRemainingSongCount(key); }, 0);
      if (remaining) {
        showWeekNotice(
          "还有 " + remaining + " 份以前的礼物没有收下",
          "你可以拆本周，也可以先补拆历史周；今天仍然只会打开一份。",
          "去看看未收完的礼物",
          "open-incomplete"
        );
      }
    }
  }
  function renderWeek(weekKey, updateUrl) {
    displayedWeekKey = weekKey;
    var data = getWeekData(weekKey);
    setWeekLabel(weekKey);
    applyWeekTheme(data);
    if (weekKey > currentWeekKey) renderFutureState();
    else if (weekKey === currentWeekKey && !data) renderNoCurrentWeekState();
    else if (!data) renderMissingHistoricalState();
    else renderConfiguredWeek(weekKey);
    updateCabinetPreview();
    if (updateUrl) updateWeekUrl(weekKey);
  }

  function handleBoxClick(weekKey, index, box) {
    if (drawing) return;
    var opened = getOpenedIndices(weekKey);
    if (opened.indexOf(index) !== -1) {
      giftScrollY = window.scrollY;
      showPlayback(weekKey, index, false, "gifts");
      transitionTo(3, "songTitle");
      return;
    }
    if (!canOpenBox(weekKey, index)) {
      setStatus("今天的歌已经被你找到，下一份礼物明天见。", true);
      return;
    }
    drawSong(weekKey, index, box);
  }
  function drawSong(weekKey, index, box) {
    var data = getWeekData(weekKey);
    if (!data || !canOpenBox(weekKey, index)) return;
    drawing = true;
    setStatus("正在拆开今天的歌...", false);
    box.classList.add("shaking");
    window.setTimeout(function () {
      box.classList.remove("shaking");
      box.classList.add("opening");
      window.setTimeout(function () {
        var state = getWeekState(weekKey, true);
        if (state.openedBoxes.indexOf(index) === -1) state.openedBoxes.push(index);
        state.openedBoxes.sort(function (a, b) { return a - b; });
        state.openedAt[String(index)] = todayKey;
        store.lastDrawDate = todayKey;
        saveStore();
        box.classList.remove("opening");
        burstConfetti(box);
        renderWeek(weekKey, false);
        renderSongCabinet();
        setStatus("你找到了《" + (data.songs[index].title || "今天的歌") + "》，正在为你打开播放器。", false);
        giftScrollY = window.scrollY;
        showPlayback(weekKey, index, true, "gifts");
        drawing = false;
        transitionTo(3, "songTitle");
      }, REDUCED_MOTION ? 30 : 320);
    }, REDUCED_MOTION ? 30 : 420);
  }

  function createCabinetWeekCard(weekKey) {
    var data = getWeekData(weekKey);
    var opened = getOpenedIndices(weekKey);
    var remaining = data.songs.length - opened.length;
    var card = document.createElement("article");
    card.className = "cabinet-week-card" + (remaining === 0 ? " is-complete" : "");
    var header = document.createElement("div");
    header.className = "cabinet-week-card__header";
    var copy = document.createElement("div");
    var title = document.createElement("h3");
    title.textContent = getWeekLabel(weekKey);
    var range = document.createElement("p");
    range.textContent = weekDateRange(weekKey);
    copy.appendChild(title);
    copy.appendChild(range);
    var badge = document.createElement("span");
    badge.className = "cabinet-week-card__badge";
    badge.textContent = remaining ? ("还有 " + remaining + " 份礼物") : "已经全部收下";
    header.appendChild(copy);
    header.appendChild(badge);
    card.appendChild(header);

    var progressRow = document.createElement("div");
    progressRow.className = "cabinet-week-progress";
    var progressCopy = document.createElement("strong");
    progressCopy.textContent = "已收下 " + opened.length + " / " + data.songs.length;
    var dots = document.createElement("div");
    dots.className = "cabinet-progress-dots";
    for (var i = 0; i < data.songs.length; i += 1) {
      var dot = document.createElement("i");
      if (opened.indexOf(i) !== -1) dot.className = "is-done";
      dots.appendChild(dot);
    }
    progressRow.appendChild(progressCopy);
    progressRow.appendChild(dots);
    card.appendChild(progressRow);

    var slots = document.createElement("div");
    slots.className = "cabinet-slots";
    data.songs.forEach(function (song, index) {
      var slot = document.createElement("span");
      if (opened.indexOf(index) !== -1) {
        slot.className = "cabinet-slot is-opened";
        slot.style.setProperty("--slot-color", song.color || PALETTE[index % PALETTE.length]);
        slot.textContent = "♪";
        slot.setAttribute("aria-label", "已收下第 " + (index + 1) + " 首歌");
      } else {
        slot.className = "cabinet-slot is-locked";
        slot.appendChild(createSvgUse("#icon-lock"));
        slot.setAttribute("aria-label", "一份还没打开的礼物");
      }
      slots.appendChild(slot);
    });
    card.appendChild(slots);

    if (remaining) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "cabinet-week-card__button";
      button.dataset.action = "continue-week";
      button.dataset.week = weekKey;
      button.textContent = weekKey === currentWeekKey ? "继续拆本周礼物" : "继续拆这一周";
      card.appendChild(button);
    } else {
      var stamp = document.createElement("span");
      stamp.className = "cabinet-complete-stamp";
      stamp.textContent = "七首歌已经全部收下";
      card.appendChild(stamp);
    }
    return card;
  }

  function createReceivedWeek(weekKey) {
    var data = getWeekData(weekKey);
    var state = getWeekState(weekKey, false);
    var opened = getOpenedIndices(weekKey).sort(function (a, b) { return a - b; });
    var group = document.createElement("article");
    group.className = "received-week" + (opened.length === data.songs.length ? " is-complete" : "");
    var heading = document.createElement("div");
    heading.className = "received-week__heading";
    var title = document.createElement("h3");
    title.textContent = getWeekLabel(weekKey);
    var meta = document.createElement("span");
    meta.textContent = opened.length === data.songs.length ? "七首歌已经全部收下" : ("已收下 " + opened.length + " / " + data.songs.length);
    heading.appendChild(title);
    heading.appendChild(meta);
    group.appendChild(heading);
    var list = document.createElement("div");
    list.className = "received-songs";
    opened.forEach(function (index) {
      var song = data.songs[index];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "received-song";
      button.dataset.action = "play-song";
      button.dataset.week = weekKey;
      button.dataset.index = String(index);
      button.setAttribute("aria-label", "播放《" + (song.title || "歌曲") + "》");
      var art = document.createElement("span");
      art.className = "received-song__art";
      if (song.cover) art.style.backgroundImage = "linear-gradient(145deg, rgba(109,63,209,.2), rgba(243,111,168,.18)), url(" + JSON.stringify(song.cover) + ")";
      else art.style.background = "linear-gradient(145deg, " + darken(song.color || PALETTE[index % PALETTE.length], 28) + ", " + (song.color || PALETTE[index % PALETTE.length]) + ")";
      art.textContent = "DAY " + pad(index + 1);
      var body = document.createElement("span");
      body.className = "received-song__body";
      var songName = document.createElement("strong");
      songName.textContent = song.title || ("第 " + (index + 1) + " 首歌");
      var preview = document.createElement("span");
      preview.textContent = song.note || "今天也想把一首歌送给你。";
      var openedDate = state.openedAt && state.openedAt[String(index)];
      var date = document.createElement("small");
      date.textContent = openedDate ? ("拆开于 " + formatDisplayDate(openedDate)) : "已经好好收下";
      body.appendChild(songName);
      body.appendChild(preview);
      body.appendChild(date);
      var play = document.createElement("span");
      play.className = "received-song__play";
      play.appendChild(createSvgUse("#icon-play"));
      button.appendChild(art);
      button.appendChild(body);
      button.appendChild(play);
      list.appendChild(button);
    });
    group.appendChild(list);
    return group;
  }

  function renderSongCabinet() {
    var incomplete = getIncompletePastWeeks();
    var receivedKeys = configuredWeekKeys().filter(function (key) { return getOpenedIndices(key).length > 0; }).sort().reverse();
    var incompleteContainer = byId("cabinetIncomplete");
    var receivedContainer = byId("cabinetReceived");
    incompleteContainer.innerHTML = "";
    receivedContainer.innerHTML = "";
    incomplete.forEach(function (key) { incompleteContainer.appendChild(createCabinetWeekCard(key)); });
    receivedKeys.forEach(function (key) { receivedContainer.appendChild(createReceivedWeek(key)); });
    byId("incompleteSection").hidden = incomplete.length === 0;
    byId("receivedSection").hidden = receivedKeys.length === 0;
    var receivedCount = getReceivedCount();
    byId("cabinetTotal").textContent = "已收下 " + receivedCount + " 首";
    byId("cabinetEmpty").hidden = receivedCount > 0;
    updateCabinetPreview();
  }

  function setPlaying(playing) {
    playButton.classList.toggle("is-playing", playing);
    coverArt.classList.toggle("is-playing", playing);
    byId("player").classList.toggle("is-playing", playing);
    var label = playing ? "暂停" : (audioEnded ? "再听一遍" : "播放");
    playButton.setAttribute("aria-label", label);
    playButton.title = label;
  }
  function updatePlayerMeta(weekKey, songIndex, song) {
    var meta = byId("songMeta");
    byId("songOrdinal").textContent = "唱给你的第 " + getGlobalSongOrdinal(weekKey, songIndex) + " 首歌";
    var recorded = byId("songRecordedAt");
    var location = byId("songLocation");
    if (song.recordedAt) {
      recorded.hidden = false;
      recorded.textContent = "录于 " + formatDisplayDate(song.recordedAt);
    } else recorded.hidden = true;
    if (song.location) {
      location.hidden = false;
      location.textContent = song.location;
    } else location.hidden = true;
    meta.hidden = false;
  }
  function showPlayback(weekKey, index, autoplay, source) {
    var data = getWeekData(weekKey);
    if (!data || weekKey > currentWeekKey || getOpenedIndices(weekKey).indexOf(index) === -1) return false;
    var song = data.songs[index];
    if (!song) return false;
    currentSongWeekKey = weekKey;
    currentSongIndex = index;
    playerReturnTarget = source === "cabinet" ? "cabinet" : "gifts";
    byId("backBtnText").textContent = playerReturnTarget === "cabinet" ? "返回歌柜" : "返回盲盒";
    songTitle.textContent = song.title || ("第 " + (index + 1) + " 首歌");
    songNote.textContent = song.note || "今天没有长长的话，只想陪你听完这一首。";
    byId("coverCaption").textContent = "DAY " + pad(index + 1);
    updatePlayerMeta(weekKey, index, song);
    coverArt.classList.toggle("has-image", Boolean(song.cover));
    coverArt.style.setProperty("--moon-top", (12 + (index % 3) * 5) + "%");
    coverArt.style.setProperty("--moon-right", (11 + (index % 4) * 4) + "%");
    coverArt.style.setProperty("--disc-left", (10 + (index % 3) * 4) + "%");
    coverArt.style.setProperty("--disc-bottom", (10 + ((index + 1) % 3) * 3) + "%");
    if (song.cover) {
      coverArt.style.backgroundImage = "linear-gradient(145deg, rgba(109,63,209,.2), rgba(243,111,168,.18)), url(" + JSON.stringify(song.cover) + ")";
      coverArt.style.backgroundSize = "cover";
      coverArt.style.backgroundPosition = "center";
    } else {
      var color = song.color || PALETTE[index % PALETTE.length];
      coverArt.style.backgroundImage = "linear-gradient(145deg, " + darken(color, 42) + ", " + color + " 54%, #efb1c8)";
    }
    audio.pause();
    audioEnded = false;
    setPlaying(false);
    progress.value = "0";
    progress.style.setProperty("--range-progress", "0%");
    currentTime.textContent = "0:00";
    duration.textContent = "0:00";
    audioHint.textContent = "";
    if (!song.audio) {
      audio.removeAttribute("src");
      audio.load();
      audioHint.textContent = "这首歌的音频还没有准备好";
      return true;
    }
    audio.src = song.audio;
    audio.load();
    audio.onerror = function () {
      audioHint.textContent = "音频加载失败，请检查文件路径";
      setPlaying(false);
    };
    if (autoplay) {
      var promise = audio.play();
      if (promise && promise.catch) promise.catch(function () { audioHint.textContent = "轻点播放，开始听今天的歌"; });
    }
    return true;
  }

  playButton.addEventListener("click", function () {
    if (!audio.getAttribute("src")) return;
    if (audio.paused) {
      if (audioEnded) {
        audio.currentTime = 0;
        audioEnded = false;
      }
      var promise = audio.play();
      if (promise && promise.catch) promise.catch(function () { audioHint.textContent = "暂时无法播放这首歌"; });
    } else audio.pause();
  });
  audio.addEventListener("play", function () {
    audioEnded = false;
    setPlaying(true);
    audioHint.textContent = "";
  });
  audio.addEventListener("pause", function () { setPlaying(false); });
  audio.addEventListener("ended", function () {
    audioEnded = true;
    setPlaying(false);
    progress.value = "1000";
    progress.style.setProperty("--range-progress", "100%");
    currentTime.textContent = formatClock(audio.duration);
    audioHint.textContent = "这首歌已经好好唱给你听完了。再听一遍也可以。";
  });
  audio.addEventListener("loadedmetadata", function () { duration.textContent = formatClock(audio.duration); });
  audio.addEventListener("timeupdate", function () {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audioEnded) return;
    progress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    progress.style.setProperty("--range-progress", (Number(progress.value) / 10) + "%");
    currentTime.textContent = formatClock(audio.currentTime);
    duration.textContent = formatClock(audio.duration);
  });
  progress.addEventListener("input", function () {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audioEnded = false;
    audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
    progress.style.setProperty("--range-progress", (Number(progress.value) / 10) + "%");
    setPlaying(!audio.paused);
  });

  function burstConfetti(source) {
    if (REDUCED_MOTION) return;
    var rect = source.getBoundingClientRect();
    var layer = byId("confetti");
    var colors = ["#8b5cf6", "#f36fa8", "#f4c86a", "#7bcfbb", "#78bce7", "#fff4c9"];
    for (var i = 0; i < 34; i += 1) {
      var piece = document.createElement("i");
      var angle = (Math.PI * 2 * i / 34) + (Math.random() * .25);
      var distance = 90 + Math.random() * 150;
      piece.style.setProperty("--x", (rect.left + rect.width / 2) + "px");
      piece.style.setProperty("--y", (rect.top + rect.height / 2) + "px");
      piece.style.setProperty("--dx", Math.cos(angle) * distance + "px");
      piece.style.setProperty("--dy", (Math.sin(angle) * distance + 110) + "px");
      piece.style.setProperty("--spin", (360 + Math.random() * 620) + "deg");
      piece.style.setProperty("--color", colors[i % colors.length]);
      layer.appendChild(piece);
      window.setTimeout(function (node) { node.remove(); }, 1300, piece);
    }
  }
  function spawnAmbient() {
    if (REDUCED_MOTION) return;
    var item = document.createElement("span");
    var moon = Math.random() > .65;
    item.innerHTML = '<svg viewBox="0 0 24 24"><use href="' + (moon ? "#icon-moon" : "#icon-spark") + '"></use></svg>';
    var size = 10 + Math.round(Math.random() * 15);
    item.style.width = size + "px";
    item.style.height = size + "px";
    item.style.left = Math.random() * 100 + "vw";
    item.style.animationDuration = (13 + Math.random() * 9) + "s";
    item.style.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    byId("bgLayer").appendChild(item);
    window.setTimeout(function () { item.remove(); }, 23000);
  }

  function openCabinet() {
    cabinetScrollY = 0;
    renderSongCabinet();
    transitionTo(4, "cabinetHeading");
  }
  function returnToCurrentWeek() {
    renderWeek(currentWeekKey, true);
    transitionTo(2, "giftHeading");
  }

  envelope.addEventListener("click", function () {
    if (envelope.classList.contains("open")) return;
    envelope.classList.add("open");
    window.setTimeout(function () { transitionTo(2, "giftHeading"); }, REDUCED_MOTION ? 30 : 600);
  });
  byId("brandHome").addEventListener("click", function (event) {
    event.preventDefault();
    transitionTo(1, "envelope");
    window.setTimeout(function () { envelope.classList.remove("open"); }, REDUCED_MOTION ? 20 : 420);
  });
  byId("cabinetLink").addEventListener("click", openCabinet);
  byId("openCabinetBtn").addEventListener("click", openCabinet);
  weekNoticeBtn.addEventListener("click", function () {
    var action = weekNoticeBtn.dataset.action;
    if (action === "current-week") returnToCurrentWeek();
    else openCabinet();
  });
  byId("cabinetBackBtn").addEventListener("click", returnToCurrentWeek);
  byId("cabinetEmptyBtn").addEventListener("click", returnToCurrentWeek);
  byId("backBtn").addEventListener("click", function () {
    audio.pause();
    if (playerReturnTarget === "cabinet") {
      renderSongCabinet();
      transitionTo(4, "cabinetHeading", cabinetScrollY);
    } else {
      renderWeek(displayedWeekKey, false);
      transitionTo(2, "giftHeading", giftScrollY);
    }
  });
  byId("cabinetIncomplete").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action='continue-week']");
    if (!button) return;
    renderWeek(button.dataset.week, true);
    transitionTo(2, "giftHeading");
  });
  byId("cabinetReceived").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action='play-song']");
    if (!button) return;
    var weekKey = button.dataset.week;
    var index = Number(button.dataset.index);
    if (getOpenedIndices(weekKey).indexOf(index) === -1) return;
    cabinetScrollY = window.scrollY;
    if (showPlayback(weekKey, index, false, "cabinet")) transitionTo(3, "songTitle");
  });

  setPageState(1);
  setupAccessGate();
  fillStaticCopy();
  renderWeek(displayedWeekKey, false);
  renderSongCabinet();
  document.body.style.setProperty("--body-font", BODY_FONT);
  for (var ambientIndex = 0; ambientIndex < 5; ambientIndex += 1) window.setTimeout(spawnAmbient, ambientIndex * 900);
  if (!REDUCED_MOTION) window.setInterval(spawnAmbient, 3200);

  window.setInterval(function () {
    var now = new Date();
    var nextTodayKey = localDateKey(now);
    var nextCurrentWeek = getISOWeek(now);
    if (nextTodayKey !== todayKey || nextCurrentWeek !== currentWeekKey) {
      var wasViewingCurrent = displayedWeekKey === currentWeekKey;
      todayKey = nextTodayKey;
      currentWeekKey = nextCurrentWeek;
      fillStaticCopy();
      if (wasViewingCurrent) displayedWeekKey = currentWeekKey;
      renderWeek(displayedWeekKey, wasViewingCurrent);
      renderSongCabinet();
    }
  }, 60000);
})();
