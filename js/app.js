(function () {
  "use strict";

  var CONFIG = window.BLINDBOX_CONFIG || {};
  var SITE = CONFIG.SITE || {};
  var WEEKS = Object.assign({}, CONFIG.WEEKS || {}, window.BLINDBOX_AUTO_WEEKS || {});
  var BRAND = SITE.title || "Kismet Songs";
  var NICKNAME = SITE.nickname || "小月亮";
  var LOVE_START = SITE.loveStart || "2026-06-24";
  var FIRST_WEEK = SITE.firstWeek || "2026-W29";
  var PALETTE = ["#ec7fac", "#a98aeb", "#73b8df", "#e9b85b", "#70c4ad", "#e58ca6", "#8f86d8"];
  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  function getISOWeek(date) {
    var utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    var week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return utc.getUTCFullYear() + "-W" + pad(week);
  }
  function weekOrdinal(weekKey, baseKey) {
    function monday(key) {
      var parts = key.split("-W").map(Number);
      var simple = new Date(Date.UTC(parts[0], 0, 4));
      var day = simple.getUTCDay() || 7;
      simple.setUTCDate(simple.getUTCDate() - day + 1 + (parts[1] - 1) * 7);
      return simple;
    }
    var ordinal = Math.floor((monday(weekKey) - monday(baseKey)) / 604800000) + 1;
    return Math.max(1, ordinal);
  }
  function darken(hex, amount) {
    var clean = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(clean)) return "#b65d88";
    var number = parseInt(clean, 16);
    var r = Math.max(0, (number >> 16) - amount);
    var g = Math.max(0, ((number >> 8) & 255) - amount);
    var b = Math.max(0, (number & 255) - amount);
    return "#" + [r, g, b].map(function (part) { return pad(part.toString(16)); }).join("");
  }

  var params = new URLSearchParams(window.location.search);
  var overrideWeek = params.get("week");
  var currentWeekKey = getISOWeek(new Date());
  function selectWeek() {
    if (overrideWeek && WEEKS[overrideWeek]) return overrideWeek;
    if (WEEKS[currentWeekKey]) return currentWeekKey;
    var keys = Object.keys(WEEKS).sort();
    var past = keys.filter(function (key) { return key <= currentWeekKey; });
    return past.length ? past[past.length - 1] : (keys[0] || null);
  }

  var weekKey = selectWeek();
  var weekData = weekKey ? WEEKS[weekKey] : null;
  var songs = weekData && Array.isArray(weekData.songs) ? weekData.songs.slice(0, 7) : [];
  var total = songs.length;

  var STORE_KEY = "kismet_songs_state_v2";
  function loadStore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.weeks) return saved;
    } catch (error) {}
    return { weeks: {} };
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) {}
  }
  var store = loadStore();
  if (!store.weeks[weekKey]) store.weeks[weekKey] = { openedBoxes: [], lastDrawDate: null };
  var state = store.weeks[weekKey];
  if (!Array.isArray(state.openedBoxes)) state.openedBoxes = [];
  state.openedBoxes = state.openedBoxes.filter(function (index) {
    return Number.isInteger(index) && index >= 0 && index < total;
  });
  if (params.get("reset") === "1") {
    state = { openedBoxes: [], lastDrawDate: null };
    store.weeks[weekKey] = state;
    saveStore();
    params.delete("reset");
    var cleaned = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
    window.history.replaceState({}, "", cleaned);
  }

  var todayKey = localDateKey(new Date());
  var drawnToday = state.lastDrawDate === todayKey;
  var allOpened = total > 0 && state.openedBoxes.length >= total;
  var canOpenNew = !drawnToday && !allOpened;
  var drawing = false;
  var currentSongIndex = -1;
  var activePage = 1;
  var transitionBusy = false;

  var pages = [byId("page1"), byId("page2"), byId("page3")];
  var veil = byId("veil");
  var envelope = byId("envelope");
  var boxes = byId("boxes");
  var status = byId("status");
  var statusText = byId("statusText");
  var progressText = byId("progressText");
  var progressDots = byId("progressDots");
  var giftHeading = byId("giftHeading");
  var audio = byId("audio");
  var playButton = byId("playBtn");
  var progress = byId("progress");
  var currentTime = byId("currentTime");
  var duration = byId("duration");
  var audioHint = byId("audioHint");
  var coverArt = byId("coverArt");
  var songTitle = byId("songTitle");
  var songNote = byId("songNote");

  function transitionTo(pageNumber) {
    if (pageNumber === activePage || transitionBusy) return;
    transitionBusy = true;
    veil.classList.remove("exit");
    veil.classList.add("show");
    window.setTimeout(function () {
      pages.forEach(function (page) { page.classList.remove("is-active"); });
      pages[pageNumber - 1].classList.add("is-active");
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
      }, REDUCED_MOTION ? 20 : 430);
    }, REDUCED_MOTION ? 20 : 410);
  }

  function fillPageCopy() {
    byId("envTitle").textContent = BRAND;
    byId("envSub").textContent = SITE.subtitle || ("给" + NICKNAME + "的专属歌单");
    var label = weekData && weekData.label;
    byId("weekLabel").textContent = label || (weekKey ? ("我们的第 " + weekOrdinal(weekKey, FIRST_WEEK) + " 周") : "本周歌单");

    var today = new Date();
    var dateText = byId("dateText");
    var displayDate = today.getFullYear() + "." + (today.getMonth() + 1) + "." + today.getDate();
    dateText.textContent = displayDate;
    dateText.dateTime = localDateKey(today);

    var loveDays = Math.floor((startOfDay(today) - startOfDay(parseLocalDate(LOVE_START))) / 86400000) + 1;
    byId("loveDay").textContent = loveDays > 0 ? ("爱的第 " + loveDays + " 天") : "故事还未开始";
  }

  function updateProgress() {
    progressText.textContent = "本周已拆 " + state.openedBoxes.length + " / " + total;
    progressDots.innerHTML = "";
    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement("i");
      if (i < state.openedBoxes.length) dot.className = "is-done";
      progressDots.appendChild(dot);
    }
  }

  function setStatus(message, locked) {
    statusText.textContent = message;
    status.classList.toggle("is-locked", Boolean(locked));
    var use = status.querySelector("use");
    use.setAttribute("href", locked ? "#icon-lock" : "#icon-spark");
  }

  function refreshStatus() {
    allOpened = total > 0 && state.openedBoxes.length >= total;
    drawnToday = state.lastDrawDate === todayKey;
    canOpenNew = !drawnToday && !allOpened;
    if (!total) {
      giftHeading.textContent = "这一周的歌还在路上";
      setStatus("歌单还没有准备好", true);
    } else if (allOpened) {
      giftHeading.textContent = "七首歌，都被你好好收下了";
      setStatus("这一周已经集齐，随时回来重听", false);
    } else if (drawnToday) {
      giftHeading.textContent = "今天的歌，已经被你找到";
      setStatus("今天的盲盒已拆，下一份明天见", true);
    } else {
      giftHeading.textContent = "今天的礼物，还在等你";
      setStatus("今天可以拆一份，选一个心动的盒子", false);
    }
  }

  function buildBoxes() {
    boxes.innerHTML = "";
    songs.forEach(function (song, index) {
      var opened = state.openedBoxes.indexOf(index) !== -1;
      var box = document.createElement("button");
      var color = song.color || PALETTE[index % PALETTE.length];
      box.type = "button";
      box.className = "gift-box" + (opened ? " opened" : "") + (!canOpenNew && !opened ? " is-locked" : "");
      box.dataset.index = String(index);
      box.style.setProperty("--box-color", color);
      box.style.setProperty("--box-dark", darken(color, 28));
      box.setAttribute("aria-label", opened
        ? ("重听第 " + (index + 1) + " 份礼物：" + (song.title || "歌曲"))
        : ((!canOpenNew ? "明天可拆的" : "拆开") + "第 " + (index + 1) + " 份音乐盲盒"));
      box.innerHTML =
        '<span class="gift-box__body"></span>' +
        '<span class="gift-box__lid"></span>' +
        '<span class="gift-box__bow"></span>' +
        '<span class="gift-box__knot"></span>' +
        '<span class="gift-box__number">' + (opened ? "♪" : pad(index + 1)) + "</span>" +
        '<span class="gift-box__song"></span>';
      box.querySelector(".gift-box__song").textContent = opened ? (song.title || "今天的歌") : "";
      box.addEventListener("click", function () { handleBoxClick(index, box); });
      boxes.appendChild(box);
    });
    updateProgress();
  }

  function handleBoxClick(index, box) {
    if (drawing) return;
    if (state.openedBoxes.indexOf(index) !== -1) {
      showPlayback(index, false);
      transitionTo(3);
      return;
    }
    if (!canOpenNew) {
      setStatus(allOpened ? "这一周已经集齐，点开任意一首重听" : "今天已经拆过一份，新的惊喜留到明天", true);
      return;
    }
    drawSong(index, box);
  }

  function drawSong(index, box) {
    drawing = true;
    setStatus("正在拆开今天的歌...", false);
    box.classList.add("shaking");
    window.setTimeout(function () {
      box.classList.remove("shaking");
      box.classList.add("opening");
      window.setTimeout(function () {
        state.openedBoxes.push(index);
        state.lastDrawDate = todayKey;
        saveStore();
        drawnToday = true;
        canOpenNew = false;
        box.classList.remove("opening");
        box.classList.add("opened");
        box.querySelector(".gift-box__number").textContent = "♪";
        box.querySelector(".gift-box__song").textContent = songs[index].title || "今天的歌";
        box.setAttribute("aria-label", "重听第 " + (index + 1) + " 份礼物：" + (songs[index].title || "歌曲"));
        boxes.querySelectorAll(".gift-box:not(.opened)").forEach(function (item) {
          var lockedIndex = Number(item.dataset.index);
          item.classList.add("is-locked");
          item.setAttribute("aria-label", "明天可拆的第 " + (lockedIndex + 1) + " 份音乐盲盒");
        });
        updateProgress();
        refreshStatus();
        burstConfetti(box);
        showPlayback(index, true);
        drawing = false;
        transitionTo(3);
      }, REDUCED_MOTION ? 30 : 360);
    }, REDUCED_MOTION ? 30 : 500);
  }

  function setPlaying(playing) {
    playButton.classList.toggle("is-playing", playing);
    playButton.setAttribute("aria-label", playing ? "暂停" : "播放");
    playButton.title = playing ? "暂停" : "播放";
  }

  function showPlayback(index, autoplay) {
    currentSongIndex = index;
    var song = songs[index];
    songTitle.textContent = song.title || ("第 " + (index + 1) + " 首歌");
    songNote.textContent = song.note || "今天没有长长的话，只想陪你听完这一首。";
    byId("coverCaption").textContent = "DAY " + pad(index + 1);
    coverArt.classList.toggle("has-image", Boolean(song.cover));
    if (song.cover) {
      coverArt.style.backgroundImage = "url(" + JSON.stringify(song.cover) + ")";
    } else {
      var color = song.color || PALETTE[index % PALETTE.length];
      coverArt.style.backgroundImage = "linear-gradient(145deg, " + darken(color, 42) + ", " + color + " 54%, #efb1c8)";
    }
    audio.pause();
    setPlaying(false);
    progress.value = "0";
    currentTime.textContent = "0:00";
    duration.textContent = "0:00";
    audioHint.textContent = "";
    if (!song.audio) {
      audio.removeAttribute("src");
      audio.load();
      audioHint.textContent = "这首歌的音频还没有准备好";
      return;
    }
    audio.src = song.audio;
    audio.load();
    audio.onerror = function () {
      audioHint.textContent = "音频加载失败，请检查文件路径";
      setPlaying(false);
    };
    if (autoplay) {
      var promise = audio.play();
      if (promise && promise.catch) {
        promise.catch(function () { audioHint.textContent = "轻点播放，开始听今天的歌"; });
      }
    }
  }

  playButton.addEventListener("click", function () {
    if (!audio.getAttribute("src")) return;
    if (audio.paused) {
      var promise = audio.play();
      if (promise && promise.catch) promise.catch(function () { audioHint.textContent = "暂时无法播放这首歌"; });
    } else {
      audio.pause();
    }
  });
  audio.addEventListener("play", function () { setPlaying(true); audioHint.textContent = ""; });
  audio.addEventListener("pause", function () { setPlaying(false); });
  audio.addEventListener("ended", function () { setPlaying(false); progress.value = "0"; });
  audio.addEventListener("loadedmetadata", function () { duration.textContent = formatClock(audio.duration); });
  audio.addEventListener("timeupdate", function () {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    progress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    currentTime.textContent = formatClock(audio.currentTime);
    duration.textContent = formatClock(audio.duration);
  });
  progress.addEventListener("input", function () {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
  });

  function burstConfetti(source) {
    if (REDUCED_MOTION) return;
    var rect = source.getBoundingClientRect();
    var layer = byId("confetti");
    var colors = ["#8b5cf6", "#f36fa8", "#f4c86a", "#7bcfbb", "#78bce7", "#fff4c9"];
    for (var i = 0; i < 34; i += 1) {
      var piece = document.createElement("i");
      var angle = (Math.PI * 2 * i / 34) + (Math.random() * 0.25);
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
    var moon = Math.random() > 0.65;
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

  envelope.addEventListener("click", function () {
    if (envelope.classList.contains("open")) return;
    envelope.classList.add("open");
    window.setTimeout(function () { transitionTo(2); }, REDUCED_MOTION ? 30 : 700);
  });
  byId("brandHome").addEventListener("click", function (event) {
    event.preventDefault();
    transitionTo(1);
    window.setTimeout(function () { envelope.classList.remove("open"); }, 500);
  });
  byId("backBtn").addEventListener("click", function () {
    audio.pause();
    transitionTo(2);
  });

  fillPageCopy();
  refreshStatus();
  buildBoxes();
  for (var ambientIndex = 0; ambientIndex < 5; ambientIndex += 1) {
    window.setTimeout(spawnAmbient, ambientIndex * 900);
  }
  if (!REDUCED_MOTION) window.setInterval(spawnAmbient, 3200);

  window.setInterval(function () {
    var now = new Date();
    var nextTodayKey = localDateKey(now);
    if (!overrideWeek && getISOWeek(now) !== currentWeekKey) {
      window.location.reload();
      return;
    }
    if (nextTodayKey !== todayKey) {
      todayKey = nextTodayKey;
      drawnToday = state.lastDrawDate === todayKey;
      canOpenNew = !drawnToday && !allOpened;
      fillPageCopy();
      refreshStatus();
      buildBoxes();
    }
  }, 60000);
})();
