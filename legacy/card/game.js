(() => {
  const SUITS = [
    { key: 'hearts', symbol: '♥', name: 'Herz', color: 'red' },
    { key: 'diamonds', symbol: '♦', name: 'Karo', color: 'red' },
    { key: 'clubs', symbol: '♣', name: 'Kreuz', color: 'black' },
    { key: 'spades', symbol: '♠', name: 'Pik', color: 'black' }
  ];
  const RANKS = [
    { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' },
    { value: 5, label: '5' }, { value: 6, label: '6' }, { value: 7, label: '7' },
    { value: 8, label: '8' }, { value: 9, label: '9' }, { value: 10, label: '10' },
    { value: 11, label: 'J' }, { value: 12, label: 'Q' }, { value: 13, label: 'K' },
    { value: 14, label: 'A' }
  ];
  const ENEMIES = [
    { name: 'Graf Quakula', emoji: '🦆', hp: 24, damage: 6, quip: '„Quak. Das war eine Drohung.“' },
    { name: 'Baronin von Biss', emoji: '🦇', hp: 30, damage: 8, quip: '„Dein Pokerface ist… niedlich.“' },
    { name: 'Der Keks-Koloss', emoji: '🍪', hp: 38, damage: 10, quip: '„Krümel? Das sind meine Kinder!“' },
    { name: 'DJ Knochenbrecher', emoji: '💀', hp: 44, damage: 11, quip: '„Ich leg gleich auf. Dich.“' },
    { name: 'König Krawallo', emoji: '🤡', hp: 52, damage: 13, quip: '„Der Hofstaat ist übrigens auch bewaffnet.“' }
  ];
  const QUIPS = [
    '„Reine Strategie. Fast.“', '„Das war Absicht. Vermutlich.“', '„Mama sagt, ich bin gut.“',
    '„Ich hab noch drei Asse. Irgendwo.“', '„Schiri? Der spielt auf meiner Seite.“'
  ];
  const $ = (id) => document.getElementById(id);
  const ui = {
    hand: $('hand'), selectionCount: $('selection-count'), comboName: $('combo-name'),
    play: $('play-cards'), playerHealth: $('player-health'), playerHp: $('player-hp-label'),
    playerBlock: $('player-block'), enemyHealth: $('enemy-health'), enemyHp: $('enemy-hp-label'),
    enemyName: $('enemy-name'), enemyEmoji: $('enemy-emoji'), enemyRank: $('enemy-rank'),
    intent: $('intent-label'), message: $('battle-message'), round: $('round-label'),
    handCount: $('hand-count'), overlay: $('result-overlay'), toast: $('toast')
  };
  const state = {
    playerHp: 30, maxPlayerHp: 30, block: 0, enemyIndex: 0, enemyHp: 24,
    enemyMaxHp: 24, hand: [], selected: new Set(), deck: [], turn: 1, busy: false,
    sound: true, run: 1, gameOver: false
  };

  function makeDeck() {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({
      id: `${suit.key}-${rank.value}-${Math.random().toString(36).slice(2, 7)}`,
      suit: suit.key, symbol: suit.symbol, color: suit.color, suitName: suit.name,
      value: rank.value, label: rank.label
    })));
  }
  function shuffle(cards) {
    const copy = [...cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function drawOne() {
    if (!state.deck.length) state.deck = shuffle(makeDeck());
    return state.deck.pop();
  }
  function drawToFive() {
    while (state.hand.length < 5) state.hand.push(drawOne());
    renderHand();
  }
  function currentEnemy() { return ENEMIES[state.enemyIndex]; }

  function setMessage(text, icon = '🎴') {
    ui.message.innerHTML = `<span class="message-icon">${icon}</span><span>${text}</span>`;
  }
  function renderHand() {
    ui.hand.innerHTML = '';
    state.hand.forEach((card, index) => {
      const selected = state.selected.has(card.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `playing-card ${card.color}${selected ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${card.label} ${card.suitName}${selected ? ', ausgewählt' : ''}`);
      button.style.animationDelay = `${index * 45}ms`;
      button.innerHTML = `<span class="card-glint"></span><span class="card-corner">${card.label}<small>${card.symbol}</small></span><span class="card-center">${card.symbol}</span><span class="card-value">${card.suitName.toUpperCase()}</span><span class="card-corner card-bottom">${card.label}<small>${card.symbol}</small></span>`;
      button.addEventListener('click', () => toggleCard(card.id));
      button.disabled = state.busy || state.gameOver;
      ui.hand.append(button);
    });
    ui.selectionCount.textContent = state.selected.size;
    ui.handCount.textContent = `${state.hand.length} KARTEN`;
    ui.play.disabled = state.selected.size !== 3 || state.busy || state.gameOver;
    const combo = state.selected.size === 3 ? evaluate([...state.selected].map((id) => state.hand.find((card) => card.id === id))) : null;
    ui.comboName.textContent = combo ? combo.name : 'Noch keine';
  }
  function toggleCard(id) {
    if (state.busy || state.gameOver) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else if (state.selected.size < 3) state.selected.add(id);
    else showToast('Drei Karten reichen selbst für den größten Ärger.');
    renderHand();
  }

  function evaluate(cards) {
    const values = cards.map((card) => card.value).sort((a, b) => a - b);
    const counts = new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    const sameSuit = cards.every((card) => card.suit === cards[0].suit);
    const straight = values[1] === values[0] + 1 && values[2] === values[1] + 1;
    let name = 'Hohe Karte', multiplier = 1, bonus = 0;
    if (straight && sameSuit) [name, multiplier, bonus] = ['Straight Flush', 2.3, 9];
    else if ([...counts.values()].includes(3)) [name, multiplier, bonus] = ['Drilling', 1.9, 7];
    else if (straight) [name, multiplier, bonus] = ['Straße', 1.7, 5];
    else if (sameSuit) [name, multiplier, bonus] = ['Flush', 1.55, 4];
    else if ([...counts.values()].includes(2)) [name, multiplier, bonus] = ['Paar', 1.35, 3];
    const rankPoints = cards.reduce((sum, card) => sum + Math.max(1, card.value - 1), 0);
    const spades = cards.filter((card) => card.suit === 'spades').length;
    const hearts = cards.filter((card) => card.suit === 'hearts').length;
    const diamonds = cards.filter((card) => card.suit === 'diamonds').length;
    const clubs = cards.filter((card) => card.suit === 'clubs').length;
    const damage = Math.round(rankPoints * 0.55 * multiplier + bonus + spades * 2 + diamonds * 2);
    const shield = clubs * 3;
    const heal = hearts * 2;
    return { name, damage, shield, heal, hearts, spades, diamonds, clubs };
  }

  function updateHud() {
    const enemy = currentEnemy();
    ui.playerHp.textContent = `${state.playerHp} / ${state.maxPlayerHp}`;
    ui.playerHealth.style.width = `${Math.max(0, state.playerHp / state.maxPlayerHp * 100)}%`;
    ui.playerBlock.textContent = state.block;
    ui.enemyHp.textContent = `${state.enemyHp} / ${state.enemyMaxHp}`;
    ui.enemyHealth.style.width = `${Math.max(0, state.enemyHp / state.enemyMaxHp * 100)}%`;
    ui.enemyName.textContent = enemy.name;
    ui.enemyEmoji.textContent = enemy.emoji;
    ui.enemyRank.textContent = `#${String(state.enemyIndex + 1).padStart(2, '0')}`;
    ui.intent.textContent = `${enemy.damage} Schaden`;
    $('arena-number').textContent = String(state.enemyIndex + 1).padStart(2, '0');
    $('player-quip').textContent = QUIPS[(state.turn - 1) % QUIPS.length];
    $('enemy-quip').textContent = enemy.quip;
    ui.round.textContent = state.busy ? 'KAMPF LÄUFT' : 'DEIN ZUG';
  }
  function animateHit(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 300);
  }
  function playSound(kind) {
    if (!state.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'hit' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'hit' ? 145 : 420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 65 : 780, ctx.currentTime + .12);
      gain.gain.setValueAtTime(.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .14);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .15);
      osc.onended = () => ctx.close();
    } catch (_) { /* Sound is optional; keep the game playable everywhere. */ }
  }
  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function playTurn() {
    if (state.selected.size !== 3 || state.busy || state.gameOver) return;
    state.busy = true;
    const cards = [...state.selected].map((id) => state.hand.find((card) => card.id === id));
    const combo = evaluate(cards);
    state.hand = state.hand.filter((card) => !state.selected.has(card.id));
    state.selected.clear();
    renderHand();
    state.enemyHp = Math.max(0, state.enemyHp - combo.damage);
    state.block += combo.shield;
    state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + combo.heal);
    updateHud();
    animateHit($('enemy-panel'), 'enemy-hit');
    playSound('hit');

    let extra = [];
    if (combo.heal) extra.push(`❤️ +${combo.heal} Heilung`);
    if (combo.shield) extra.push(`🛡️ +${combo.shield} Block`);
    setMessage(`<b>${combo.name}!</b> ${combo.damage} Schaden${extra.length ? ` · ${extra.join(' · ')}` : ''}`, '⚔️');
    await wait(650);

    if (state.enemyHp <= 0) {
      await winEnemy();
      return;
    }
    const incoming = currentEnemy().damage;
    const blocked = Math.min(state.block, incoming);
    state.block -= blocked;
    const damageTaken = incoming - blocked;
    state.playerHp = Math.max(0, state.playerHp - damageTaken);
    state.turn++;
    updateHud();
    if (damageTaken > 0) {
      animateHit(document.querySelector('.player-fighter'), 'player-hit');
      playSound('hit');
    }
    setMessage(blocked ? `Der Gegner haut zurück! 🛡️ ${blocked} geblockt, <b>${damageTaken} Schaden</b> kassiert.` : `Der Gegner haut zurück. <b>${damageTaken} Schaden</b>! Autsch.`, blocked ? '🛡️' : '💥');
    await wait(550);
    if (state.playerHp <= 0) {
      state.busy = false;
      state.gameOver = true;
      renderHand();
      showResult(false);
      return;
    }
    drawToFive();
    state.busy = false;
    updateHud();
    renderHand();
    setMessage('Dein Zug! Sammle ein gutes Blatt und hau zurück.', '🎴');
  }

  async function winEnemy() {
    const defeated = currentEnemy();
    state.busy = false;
    updateHud();
    setMessage(`<b>${defeated.name}</b> ist K.O.! Nicht sicher, ob das regelkonform war.`, '🏆');
    await wait(550);
    if (state.enemyIndex === ENEMIES.length - 1) {
      state.gameOver = true;
      renderHand();
      showResult(true);
      return;
    }
    showResult(true, false);
  }
  function showResult(won, final = false) {
    $('result-spark').textContent = won ? (final ? '👑' : '🏆') : '🩹';
    $('result-eyebrow').textContent = won ? (final ? 'ARENA-MEISTER' : 'GEGNER BESIEGT') : 'RUN BEENDET';
    $('result-title').textContent = won ? (final ? 'Du bist der Champion!' : `${currentEnemy().name} ist raus!`) : 'Der Tiger braucht ein Pflaster.';
    $('result-copy').textContent = won ? (final ? 'Alle Gegner besiegt! Die Arena wird deine Versicherungsprämie erhöhen.' : `Du hast noch ${state.playerHp} Ausdauer. Auf in die nächste Runde!`) : 'Die Karten waren gegen dich. Na ja, technisch gesehen hattest du sie in der Hand.';
    $('continue-run').innerHTML = won ? (final ? 'NOCH EINEN RUN <span>↻</span>' : 'NÄCHSTE ARENA <span>→</span>') : 'NOCH EINEN RUN <span>↻</span>';
    ui.overlay.classList.remove('hidden');
  }
  function continueRun() {
    ui.overlay.classList.add('hidden');
    if (state.gameOver) {
      startRun();
      return;
    }
    state.enemyIndex++;
    const enemy = currentEnemy();
    state.enemyHp = enemy.hp;
    state.enemyMaxHp = enemy.hp;
    state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + 5);
    state.block = 0;
    state.turn = 1;
    state.deck = shuffle(makeDeck());
    state.hand = [];
    drawToFive();
    updateHud();
    setMessage(`Zwischenrunde! +5 Ausdauer. ${enemy.name} betritt die Arena.`, '✨');
  }
  function startRun() {
    state.playerHp = state.maxPlayerHp;
    state.block = 0;
    state.enemyIndex = 0;
    state.enemyHp = ENEMIES[0].hp;
    state.enemyMaxHp = ENEMIES[0].hp;
    state.turn = 1;
    state.busy = false;
    state.gameOver = false;
    state.deck = shuffle(makeDeck());
    state.hand = [];
    state.selected.clear();
    state.run++;
    $('run-number').textContent = String(state.run).padStart(2, '0');
    drawToFive();
    updateHud();
    setMessage('Such dir <b>3 Karten</b> aus. Mal sehen, was du auf der Hand hast.', '🎴');
  }
  let toastTimeout;
  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => ui.toast.classList.remove('show'), 1800);
  }

  ui.play.addEventListener('click', playTurn);
  $('continue-run').addEventListener('click', continueRun);
  $('new-run').addEventListener('click', () => {
    ui.overlay.classList.add('hidden');
    startRun();
    showToast('Frische Karten. Frische Fäuste.');
  });
  $('sound-toggle').addEventListener('click', (event) => {
    state.sound = !state.sound;
    event.currentTarget.textContent = state.sound ? '🔊' : '🔇';
    event.currentTarget.setAttribute('aria-label', state.sound ? 'Sound ausschalten' : 'Sound einschalten');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !ui.play.disabled && ui.overlay.classList.contains('hidden')) playTurn();
    if (event.key === 'Escape') ui.overlay.classList.add('hidden');
  });

  // First run starts with an inviting hand, ready to play.
  state.run = 0;
  startRun();
})();
