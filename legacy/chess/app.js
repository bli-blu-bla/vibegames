/* ============================================================
   app.js – UI, Spaß, KI-Anbindung
   ============================================================ */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const boardEl = $("#board");

  // Deutsche Anführungszeichen als Escapes (encoding-sicher)
  const OQ = "\u201E"; // „
  const CQ = "\u201C"; // “
  const q = s => OQ + s + CQ;

  const GLYPH = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
  };
  const NAMES = {
    p: { w: "Keks-Bauer", b: "Pinguin-Bauer" },
    n: { w: "Keks-Springer", b: "Pinguin-Springer" },
    b: { w: "Keks-Läufer", b: "Pinguin-Läufer" },
    r: { w: "Keks-Turm", b: "Pinguin-Turm" },
    q: { w: "Keks-Dame", b: "Pinguin-Dame" },
    k: { w: "Keks-König", b: "Pinguin-König" }
  };

  /* ---------- Sprüche ---------- */
  const QUOTES = [
    q("Ich hab eine Strategie. Sie heißt: Keks."),
    q("Kein Bock? Dann rutsch halt über die Straße, du Quadrat."),
    q("Der Pinguin denkt nach. Der Pinguin denkt nochmal. Der Pinguin hat Hunger."),
    q("Schach ist wie Kaffee: schwarz, stark, macht wach."),
    q("Du spielst wie ein Springer im Sack: chaotisch, aber irgendwie effektiv."),
    q("Pinguin rät: Rochade. Pinguin rät: Keks."),
    q("Wer aufgegeben hat, hat gewonnen – nur später."),
    q("Dein Bauernzug erinnert mich an meine Diätpläne."),
    q("Ich zähle meine Keksbrösel. Es sind zu viele."),
    q("Tempo, Tempo! Der Keks wird nicht jünger.")
  ];

  const AI_LINES = [
    "\uD83D\uDC27 Der Pinguin rutscht elegant eine Flosse weiter.",
    "\uD83D\uDC27 Der Pinguin hat das intern als " + q("Taktik") + " bezeichnet.",
    "\uD83D\uDC27 Pinguin verzieht den Schnabel. Das heißt: Planänderung.",
    "\uD83D\uDC27 Der Pinguin murmelt etwas Unverständliches in Antarktisch.",
    "\uD83D\uDC27 Der Pinguin nimmt Keks. Seine Strategie konzentriert sich.",
    "\uD83D\uDC27 Der Pinguin guckt kurz nach links. Das war geplant.",
    "\uD83D\uDC27 Der Pinguin hüpft. Es ist ein Würfelwurf, aber er nennt es Intuition."
  ];

  const AI_CAPTURE = [
    "\uD83D\uDC27 " + q("Der Keks war fett, der war gedacht."),
    "\uD83D\uDC27 Der Pinguin macht Junge für Junge. Er nennt das Putzen.",
    "\uD83D\uDC27 " + q("Ich rieche dein Geheimnis. Es rocht nach Keks."),
    "\uD83D\uDC27 Der Pinguin kapert dein Teil. Piratenregeln."
  ];

  const PLAYER_CAPTURE = [
    "\uD83D\uDE0E Sauber geklaut! Das nennt man Fortschritt.",
    "\uD83D\uDE0E Der Keks ist deiner. Der Pinguin leidet.",
    "\uD83D\uDE0E " + q("Danke für die Ablöse, Keks."),
    "\uD83D\uDE0E Du nimmst ihm ein Teil. Rücksichtlos, aber effektiv."
  ];

  const PLAYER_LINES = [
    "\uD83D\uDCD1 " + q("Ich hab das gerechnet."),
    "\uD83D\uDCD1 " + q("Kein Zufall. Naja, meistens."),
    "\uD83D\uDCD1 Du tippst nachdenklich auf die Stirn.",
    "\uD83D\uDCD1 " + q("Der Keks verlangt Opfer. Meins.")
  ];

  const MATTE = {
    w: ["\uD83C\uDFC6 Du gewinnst! Der Pinguin wird zur Möwe.", "\uD83C\uDF89 Pinguin besiegt! Zeit für Tee."],
    b: ["\uD83D\uDC27 Der Pinguin gewinnt! Du bekommst den trockenen Keks.", "\uD83D\uDE16 Pinguin macht fertig. Er ist geradezu beleidigend."],
    draw: ["\uD83D\uDD1D Unentschieden. Ihr seid euch zu ähnlich.", "\uD83D\uDD1D Remis. Der Keks war zu klein für zwei."]
  };

  /* ---------- Zustand ---------- */
  let state, history, undoStack, selected = -1, legal = [], flipped = false;
  let mode = "ai", difficulty = 1, soundOn = true, over = false, thinking = false;
  let audioCtx = null;

  /* ---------- Ton ---------- */
  function beep(freq, dur = 0.08, type = "square", vol = 0.05) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* egal */ }
  }
  const sfx = {
    move: () => beep(420, 0.06, "triangle", 0.04),
    capture: () => { beep(180, 0.12, "sawtooth", 0.05); setTimeout(() => beep(120, 0.12, "sawtooth", 0.05), 90); },
    check: () => { beep(700, 0.08, "square", 0.045); setTimeout(() => beep(700, 0.08, "square", 0.045), 130); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.14, "triangle", 0.06), i * 120)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.16, "sawtooth", 0.05), i * 140)); }
  };

  /* ---------- Brett zeichnen ---------- */
  function boardOrder() {
    const order = [];
    for (let dr = 0; dr < 8; dr++)
      for (let df = 0; df < 8; df++) {
        const r = flipped ? 7 - dr : dr;
        const f = flipped ? 7 - df : df;
        order.push(Chess.sq(f, r));
      }
    return order;
  }

  function render() {
    const order = boardOrder();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 64; i++) {
      const idx = order[i];
      const r = Chess.rankOf(idx), f = Chess.fileOf(idx);
      const sqEl = document.createElement("div");
      sqEl.className = "sq " + ((r + f) % 2 === 0 ? "light" : "dark");
      sqEl.dataset.i = idx;
      sqEl.dataset.file = "abcdefgh"[f];
      sqEl.dataset.rank = 8 - r;

      // Koordinaten nur am Rand
      if (8 - r === 1) {
        const cf = document.createElement("span");
        cf.className = "coord file";
        cf.textContent = "abcdefgh"[f];
        sqEl.appendChild(cf);
      }
      if (f === 0) {
        const cr = document.createElement("span");
        cr.className = "coord rank";
        cr.textContent = String(8 - r);
        sqEl.appendChild(cr);
      }

      const p = state.board[idx];
      if (p) {
        const sp = document.createElement("span");
        sp.className = "piece " + p.c;
        sp.textContent = GLYPH[p.c][p.t];
        sp.dataset.i = idx;
        sqEl.appendChild(sp);
      }

      if (state.last && (idx === state.last.from || idx === state.last.to)) sqEl.classList.add("last");
      if (p && p.t === "k" && Chess.inCheck(state, p.c)) sqEl.classList.add("check");

      if (selected >= 0) {
        if (idx === selected) sqEl.classList.add("sel");
        else {
          const mv = legal.find(m => m.to === idx);
          if (mv) sqEl.classList.add(mv.captured ? "cap" : "hint");
        }
      }
      frag.appendChild(sqEl);
    }
    boardEl.innerHTML = "";
    boardEl.appendChild(frag);
    renderSides();
  }

  function score(board, color) {
    let s = 0;
    for (const p of board) if (p && p.c === color) s += Chess.VALUE[p.t];
    return s;
  }

  function renderSides() {
    const w = score(state.board, "w"), b = score(state.board, "b");
    $("#whiteScore").textContent = "Punkte: " + (w - b > 0 ? "+" : "") + (w - b);
    $("#blackScore").textContent = "Punkte: " + (b - w > 0 ? "+" : "") + (b - w);
    $("#whiteName").textContent = mode === "ai" ? "Du" : "Du (Weiß)";
    $("#blackName").textContent = mode === "ai" ? "Pinguin (KI)" : "Du (Schwarz)";
    $("#whiteTray").innerHTML = tray(state.board, "w");
    $("#blackTray").innerHTML = tray(state.board, "b");
  }

  function tray(board, color) {
    const alive = {};
    for (const p of board) if (p) alive[p.c + p.t] = (alive[p.c + p.t] || 0) + 1;
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    let out = "";
    for (const t of ["q", "r", "b", "n", "p"]) {
      const lost = start[t] - (alive[color + t] || 0);
      for (let i = 0; i < lost; i++) out += '<span class="mini ' + color + '">' + GLYPH[color][t] + "</span>";
    }
    return out;
  }

  /* ---------- Zugliste ---------- */
  function renderMoves() {
    const ol = $("#moveList");
    ol.innerHTML = "";
    for (let i = 0; i < history.length; i += 2) {
      const li = document.createElement("li");
      const n = document.createElement("span");
      n.className = "num";
      n.textContent = i / 2 + 1 + ".";
      li.appendChild(n);
      li.appendChild(document.createTextNode(history[i] + " "));
      if (history[i + 1]) li.appendChild(document.createTextNode(history[i + 1]));
      ol.appendChild(li);
    }
    ol.scrollTop = ol.scrollHeight;
  }

  /* ---------- Status ---------- */
  function setStatus(text) { $("#status").textContent = text; }

  function updateStatus() {
    if (over) return;
    const c = state.turn;
    const inChk = Chess.inCheck(state, c);
    if (mode === "ai") {
      if (c === "w") setStatus(inChk ? "\uD83D\uDFE1 Schach! Du bist dran, rette den Keks!" : "\uD83D\uDFE2 Dein Zug!");
      else setStatus(inChk ? "\uD83D\uDFE1 Schach! Der Pinguin presst." : "\uD83D\uDD35 Pinguin ist am Zug …");
    } else {
      setStatus(inChk ? "\uD83D\uDFE1 Schach!" : "\uD83D\uDFE2 " + (c === "w" ? "Weiß" : "Schwarz") + " ist am Zug");
    }
  }

  /* ---------- Spiel starten ---------- */
  function newGame() {
    state = Chess.newState();
    history = [];
    undoStack = [];
    selected = -1; legal = []; over = false; thinking = false;
    $("#thinking").hidden = true;
    $("#overlay").hidden = true;
    $("#moveList").innerHTML = "";
    $("#quote").textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    render();
    renderMoves();
    updateStatus();
    if (mode === "ai") setTimeout(aiMove, 500);
  }

  /* ---------- Zug ausführen ---------- */
  function doMove(m) {
    const notation = Chess.san(state, m);
    const moverHuman = (mode === "hot") || (mode === "ai" && m.color === "w");
    undoStack.push({ state: Chess.cloneState(state), histLen: history.length });
    history.push(notation);
    Chess.makeMove(state, m);

    if (m.promo) {
      toast("\uD83C\uDFC8 Beförderung! Dein Bauer wird zur " + (m.promo === "q" ? "Keks-Dame" : m.promo.toUpperCase()) + ".");
      beep(900, 0.12, "triangle", 0.06);
    }

    if (m.captured) {
      const capName = NAMES[m.captured.t][m.captured.c];
      toast(moverHuman
        ? PLAYER_CAPTURE[Math.floor(Math.random() * PLAYER_CAPTURE.length)] + " (+" + capName + ")"
        : AI_CAPTURE[Math.floor(Math.random() * AI_CAPTURE.length)]);
      sfx.capture();
    } else {
      sfx.move();
      if (moverHuman) $("#quote").textContent = PLAYER_LINES[Math.floor(Math.random() * PLAYER_LINES.length)];
    }

    render();
    renderMoves();
    updateStatus();

    if (Chess.inCheck(state, state.turn)) sfx.check();

    const mate = checkEnd();
    if (!mate && mode === "ai" && state.turn === "b" && !over) {
      thinking = true;
      $("#thinking").hidden = false;
      $("#thinkText").textContent = "Der Pinguin überlegt";
      setTimeout(aiMove, 600 + Math.random() * 700);
    }
  }

  /* ---------- Endlagen ---------- */
  function checkEnd() {
    const moves = Chess.legalMoves(state);
    if (moves.length === 0) {
      const chk = Chess.inCheck(state, state.turn);
      const hotseat = mode === "hot";
      if (chk) {
        const whiteWins = state.turn === "b";
        if (hotseat) {
          finish(whiteWins ? "\uD83C\uDFC6" : "\uD83D\uDC27",
            whiteWins ? "Schach matt! Weiß gewinnt!" : "Schach matt! Schwarz gewinnt!",
            whiteWins ? "Weiß hat das Keks-Exklusivrecht." : "Schwarz hat das Keks-Exklusivrecht.");
        } else {
          finish(whiteWins ? "\uD83C\uDFC6" : "\uD83D\uDC27",
            whiteWins ? "Schach matt!" : "Schach matt! Der Pinguin rettet dich.",
            whiteWins ? MATTE.w[0] : MATTE.b[0]);
        }
        sfx.win();
      } else {
        finish("\uD83D\uDD1D", "Patt!", MATTE.draw[0]);
      }
      return true;
    }
    if (state.half >= 100) { finish("\uD83D\uDD1D", "Remis!", "\uD83D\uDD1D 50 Züge ohne Keks. Alle hungrig."); return true; }
    if (Chess.insufficientMaterial(state.board)) { finish("\uD83D\uDD1D", "Remis!", MATTE.draw[1]); return true; }
    return false;
  }

  function finish(icon, title, text) {
    over = true;
    selected = -1; legal = [];
    render();
    $("#ovIcon").textContent = icon;
    $("#ovTitle").textContent = title;
    $("#ovText").textContent = text;
    $("#overlay").hidden = false;
    $("#thinking").hidden = true;
    setStatus(icon + " " + title);
  }

  /* ---------- KI ---------- */
  function aiMove() {
    if (over || mode !== "ai" || state.turn !== "b") { $("#thinking").hidden = true; return; }
    const moves = Chess.legalMoves(state);
    if (!moves.length) { $("#thinking").hidden = true; return; }

    let m = null;
    if (difficulty === 0 && Math.random() < 0.45) {
      m = moves[Math.floor(Math.random() * moves.length)];
    } else {
      const depth = [1, 2, 3][difficulty];
      const noise = [140, 30, 6][difficulty];
      m = Chess.bestMove(state, depth, noise);
    }
    $("#thinking").hidden = true;
    thinking = false;
    if (!m) return;

    $("#quote").textContent = AI_LINES[Math.floor(Math.random() * AI_LINES.length)];
    doMove(m);
  }

  /* ---------- Auswahl & Ziehen ---------- */
  function selectSquare(i) {
    legal = Chess.legalMoves(state, state.turn).filter(mv => mv.from === i);
    if (!legal.length) { selected = -1; render(); return; }
    selected = i;
    render();
  }

  function tryMove(from, to) {
    const mv = legal.find(m => m.to === to);
    if (mv) { selected = -1; doMove(mv); return true; }
    return false;
  }

  let dragFrom = -1, ghost = null, ghostShown = false, lastX = 0, lastY = 0;

  boardEl.addEventListener("pointerdown", ev => {
    if (over) return;
    if (mode === "ai" && state.turn !== "w") return;
    const sqEl = ev.target.closest(".sq");
    if (!sqEl) return;
    const i = +sqEl.dataset.i;
    lastX = ev.clientX; lastY = ev.clientY;

    const p = state.board[i];

    // Leeres oder gegnerisches Feld: mit der Auswahl dorthin ziehen
    if (!p || p.c !== state.turn) {
      if (selected >= 0 && tryMove(selected, i)) return;
      return;
    }

    ev.preventDefault();
    dragFrom = i;
    ghostShown = false;
    if (selected === i) {
      // nochmal auf dieselbe Figur geklickt -> abwählen
      selected = -1; legal = []; render();
    } else {
      selectSquare(i);
    }
  });

  window.addEventListener("pointermove", ev => {
    if (dragFrom < 0) return;
    if (!ghostShown && (Math.abs(ev.clientX - lastX) + Math.abs(ev.clientY - lastY)) > 6) {
      ghostShown = true;
      const p = state.board[dragFrom];
      if (p) {
        const gl = $("#ghost");
        gl.hidden = false;
        gl.textContent = GLYPH[p.c][p.t];
        gl.className = "ghost " + p.c;
        ghost = gl;
      }
    }
    moveGhost(ev);
  });

  function moveGhost(ev) {
    if (!ghost) return;
    ghost.style.left = ev.clientX + "px";
    ghost.style.top = ev.clientY + "px";
  }

  window.addEventListener("pointerup", ev => {
    if (dragFrom < 0) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const sqEl = el && el.closest ? el.closest(".sq") : null;
    const to = sqEl ? +sqEl.dataset.i : -1;
    $("#ghost").hidden = true;
    ghost = null; ghostShown = false;
    const from = dragFrom;
    dragFrom = -1;
    if (to >= 0 && to !== from) {
      if (!tryMove(from, to)) {
        const p = state.board[to];
        if (p && p.c === state.turn) selectSquare(to);
        else { selected = -1; legal = []; render(); }
      }
    }
  });

  /* ---------- Buttons ---------- */
  $("#newBtn").addEventListener("click", newGame);
  $("#ovBtn").addEventListener("click", newGame);
  $("#undoBtn").addEventListener("click", () => {
    if (!undoStack.length) return;
    // Im KI-Modus den ganzen Zug zurücknehmen (KI-Antwort + Spielzug)
    const popCount = (mode === "ai" && undoStack.length >= 2) ? 2 : 1;
    for (let i = 0; i < popCount; i++) {
      if (!undoStack.length) break;
      const snap = undoStack.pop();
      state = snap.state;
      history.length = snap.histLen;
    }
    selected = -1; legal = []; over = false; thinking = false;
    $("#overlay").hidden = true;
    $("#thinking").hidden = true;
    render(); renderMoves(); updateStatus();
  });
  $("#flipBtn").addEventListener("click", () => { flipped = !flipped; render(); });
  $("#soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    $("#soundBtn").textContent = soundOn ? "\uD83D\uDD0A Ton an" : "\uD83D\uDD07 Ton aus";
  });
  $("#resignBtn").addEventListener("click", () => {
    if (over) return;
    const whiteTurn = state.turn === "w";
    finish(whiteTurn ? "\uD83D\uDC27" : "\uD83C\uDFC3", "Aufgegeben!",
      whiteTurn ? MATTE.b[1] : "\uD83C\uDFC3 Du hast aufgegeben. Der Keks ist unentschieden.");
    sfx.lose();
  });
  $("#modeSel").addEventListener("change", e => { mode = e.target.value; newGame(); });
  $("#diffSel").addEventListener("change", e => { difficulty = +e.target.value; });

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); t.hidden = true; }, 2600);
  }

  /* ---------- Spruch des Tages ---------- */
  $("#dailyQuote").textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  /* ---------- Start ---------- */
  newGame();
})();
