/**
 * GLEIS-GAUDI 3000 – Bundesbahn-Wahnsinn im Stellwerk
 * Handcrafted Wooden Diorama & Retro Stellwerk Game Engine
 * Supports Singleplayer & Couch Co-Op (2 Players + Mouse)
 */

(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // UI Elements
  const statScore = document.getElementById('stat-score');
  const statCombo = document.getElementById('stat-combo');
  const statLives = document.getElementById('stat-lives');
  const statTime = document.getElementById('stat-time');
  const zzaTrain = document.getElementById('zza-train');
  const zzaDest = document.getElementById('zza-dest');
  const zzaDelay = document.getElementById('zza-delay');
  const trainCardsEl = document.getElementById('train-cards');
  const paToast = document.getElementById('pa-toast');
  const paText = document.getElementById('pa-text');
  const eventBanner = document.getElementById('event-banner');
  const eventIcon = document.getElementById('event-icon');
  const eventTitle = document.getElementById('event-title');
  const eventDesc = document.getElementById('event-desc');
  const coopDivider = document.getElementById('coop-divider');

  // Modals & Buttons
  const modalStart = document.getElementById('modal-start');
  const modalGameOver = document.getElementById('modal-gameover');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnRestartGame = document.getElementById('btn-restart-game');
  const btnBackMenu = document.getElementById('btn-back-menu');
  const btnExcuse = document.getElementById('btn-excuse');
  const btnCoffee = document.getElementById('btn-coffee');
  const btnMute = document.getElementById('btn-mute');
  const btnMenu = document.getElementById('btn-menu');

  // ==========================================
  // WEB AUDIO SYNTHESIZER (Retro Stellwerk & Train Sounds)
  // ==========================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    playSwitchClack() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.065);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    }

    playGong() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      // Classic 3-tone DB station chime (G4 - B4 - E5)
      const notes = [392.0, 493.88, 659.25];
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.16;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      });
    }

    playWhistle(pitch = 1.0) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [587.33 * pitch, 783.99 * pitch].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.04, now + 0.18);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      });
    }

    playSuccess() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const chords = [523.25, 659.25, 783.99, 1046.5];
      chords.forEach((freq, i) => {
        const now = this.ctx.currentTime + i * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.34);
      });
    }

    playMoo() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.linearRampToValueAtTime(175, now + 0.2);
      osc.frequency.linearRampToValueAtTime(115, now + 0.55);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.62);
    }

    playCrash() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.45);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  }

  const sfx = new SoundEngine();

  // ==========================================
  // HUMOR & GERMAN RAILWAY SATIRE DATA
  // ==========================================
  const DESTINATIONS = {
    RED: {
      id: 'RED',
      name: 'Buxtehude Hbf',
      sub: 'Rotes Backstein-Depot',
      color: '#ef233c',
      light: '#ff758f',
      roof: '#a4161a'
    },
    BLUE: {
      id: 'BLUE',
      name: 'Wanne-Eickel Nord',
      sub: 'Blauer Hafen-Kai',
      color: '#00bbf9',
      light: '#90e0ef',
      roof: '#0077b6'
    },
    YELLOW: {
      id: 'YELLOW',
      name: 'Castrop-Rauxel Süd',
      sub: 'Goldenes Post-Terminal',
      color: '#ffb703',
      light: '#ffea85',
      roof: '#d48c00'
    },
    GREEN: {
      id: 'GREEN',
      name: 'Bad Meingarten',
      sub: 'Grüner Bio-Bahnhof',
      color: '#38ef7d',
      light: '#9ef01a',
      roof: '#1b9aaa'
    }
  };

  const TRAIN_ARCHETYPES = [
    {
      prefix: 'ICE',
      nickname: 'Koffein-Express',
      speedMult: 1.28,
      wagons: 2,
      quip: 'Bordbistro meldet: Kaffeemaschine überhitzt!'
    },
    {
      prefix: 'RB',
      nickname: 'Bummel-Bock',
      speedMult: 0.88,
      wagons: 2,
      quip: 'Hält an jeder Milchkanne und grüßt die Schafe.'
    },
    {
      prefix: 'IC',
      nickname: 'Wagenreihung-Rückwärts',
      speedMult: 1.05,
      wagons: 3,
      quip: 'Wagen 7 befindet sich heute geistig in Hannover.'
    },
    {
      prefix: 'RE',
      nickname: 'Schienen-Schleicher',
      speedMult: 0.96,
      wagons: 2,
      quip: 'Lokführer sucht noch seine Mütze.'
    },
    {
      prefix: 'TGV',
      nickname: 'Croissant-Pfeil',
      speedMult: 1.35,
      wagons: 2,
      quip: 'Verirrt aus Paris – fragt nach dem Weg!'
    }
  ];

  const FUNNY_ANNOUNCEMENTS = [
    '„Information zu ICE 404: Der Zug fällt heute aus, weil der Lokführer im Bordbistro die Brezeln aufbäckt.“',
    '„Achtung an Gleis 3: Eine philosophische Kuh diskutiert mit dem Signalwärter über Löwenzahn-Preise.“',
    '„Durchsage: Wegen eines spontanen Nickerchens im Stellwerk verzögert sich die Weiterfahrt um ca. 3 Tassen Kaffee.“',
    '„Hinweis für Fahrgäste nach Castrop-Rauxel: Heute leider in umgekehrter alphabetischer Wagenreihung!“',
    '„Eilmeldung: Die vier Jahreszeiten Frühling, Sommer, Herbst und Winter wurden offiziell zu Bahn-Störfällen erklärt.“',
    '„Sonderdurchsage: Wer hat seine quietschende Holzlokomotive auf Weiche 5 geparkt?!“',
    '„Gute Nachricht: RB 815 ist heute pünktlich! Schlechte Nachricht: Es ist der Zug von gestern.“',
    '„Bitte beachten Sie: Der Schlafwagen schläft heute tatsächlich noch im Depot.“'
  ];

  const RANKS = [
    { min: 0, title: 'Praktikant der Schrankenkurbel', quote: '„Immerhin weißt du jetzt, dass Züge auf Schienen fahren!“' },
    { min: 400, title: 'Beauftragter für umgekehrte Wagenreihung', quote: '„Die Hälfte der Fahrgäste kam sogar im richtigen Bundesland an!“' },
    { min: 900, title: 'Ober-Weichenflüsterer von Wanne-Eickel', quote: '„Selbst Kuh Berta hat vor deiner Signal-Kelle Respekt!“' },
    { min: 1500, title: 'Geheimer Pünktlichkeits-Magier', quote: '„Das Verkehrsministerium hält deine Statistik für eine Fälschung!“' },
    { min: 2200, title: 'Großmeister des Bundesbahn-Stellwerks 3000', quote: '„Schweizer Uhrmacher stellen ihre Uhren nach deinem Fahrplan!“' }
  ];

  // ==========================================
  // TRACK NETWORK DEFINITION (1280 x 720 Diorama)
  // ==========================================
  // Nodes define coordinates and outgoing directed edges.
  // Switch nodes have multiple outgoing edges and a current `activeBranch` index!
  function buildTrackNetwork() {
    const nodes = {
      // 2 Western Spawn Depots (Tunnels)
      SPAWN_NORTH: { id: 'SPAWN_NORTH', x: 95, y: 205, type: 'spawn', label: 'Nord-Tunnel' },
      SPAWN_SOUTH: { id: 'SPAWN_SOUTH', x: 95, y: 515, type: 'spawn', label: 'Süd-Tunnel' },

      // West Switch 1 & Switch 2
      SW1: { id: 'SW1', x: 275, y: 205, type: 'switch', switchNum: 1, zone: 'west', activeBranch: 0 },
      SW2: { id: 'SW2', x: 275, y: 515, type: 'switch', switchNum: 2, zone: 'west', activeBranch: 0 },

      // Mid-West Junctions
      SW3: { id: 'SW3', x: 480, y: 140, type: 'switch', switchNum: 3, zone: 'west', activeBranch: 0 },
      SW4: { id: 'SW4', x: 480, y: 360, type: 'switch', switchNum: 4, zone: 'west', activeBranch: 0 },
      SW5: { id: 'SW5', x: 480, y: 580, type: 'switch', switchNum: 5, zone: 'west', activeBranch: 0 },

      // Mid-East Junctions (P2 Zone in Co-Op)
      SW6: { id: 'SW6', x: 760, y: 230, type: 'switch', switchNum: 6, zone: 'east', activeBranch: 0 },
      SW7: { id: 'SW7', x: 760, y: 490, type: 'switch', switchNum: 7, zone: 'east', activeBranch: 0 },

      // Final Approach Switches
      SW8: { id: 'SW8', x: 980, y: 175, type: 'switch', switchNum: 8, zone: 'east', activeBranch: 0 },
      SW9: { id: 'SW9', x: 980, y: 545, type: 'switch', switchNum: 9, zone: 'east', activeBranch: 0 },

      // Scenic Loop Return Waypoints (if players route trains onto the Panorama-Schleife)
      LOOP_TOP: { id: 'LOOP_TOP', x: 620, y: 65, type: 'waypoint' },
      LOOP_BOT: { id: 'LOOP_BOT', x: 620, y: 655, type: 'waypoint' },

      // 4 Destination Stations on the East Side
      ST_RED: { id: 'ST_RED', x: 1175, y: 105, type: 'station', stationKey: 'RED' },
      ST_BLUE: { id: 'ST_BLUE', x: 1175, y: 265, type: 'station', stationKey: 'BLUE' },
      ST_YELLOW: { id: 'ST_YELLOW', x: 1175, y: 455, type: 'station', stationKey: 'YELLOW' },
      ST_GREEN: { id: 'ST_GREEN', x: 1175, y: 615, type: 'station', stationKey: 'GREEN' }
    };

    // Directed Edges with smooth cubic/quadratic control points for authentic wooden tracks
    const edges = [
      // From Spawns to SW1 & SW2
      { from: 'SPAWN_NORTH', to: 'SW1', cp: { x: 185, y: 205 } },
      { from: 'SPAWN_SOUTH', to: 'SW2', cp: { x: 185, y: 515 } },

      // SW1 branches: [0] -> SW3 (up-left), [1] -> SW4 (center cross)
      { from: 'SW1', to: 'SW3', cp: { x: 375, y: 140 } },
      { from: 'SW1', to: 'SW4', cp: { x: 380, y: 290 } },

      // SW2 branches: [0] -> SW5 (down-right), [1] -> SW4 (center cross)
      { from: 'SW2', to: 'SW5', cp: { x: 375, y: 580 } },
      { from: 'SW2', to: 'SW4', cp: { x: 380, y: 430 } },

      // SW3 branches: [0] -> SW6 (main upper), [1] -> LOOP_TOP (express bypass to SW8)
      { from: 'SW3', to: 'SW6', cp: { x: 620, y: 180 } },
      { from: 'SW3', to: 'LOOP_TOP', cp: { x: 540, y: 65 } },
      { from: 'LOOP_TOP', to: 'SW8', cp: { x: 820, y: 65 } },

      // SW4 (Central Hub) branches: [0] -> SW6 (upper east), [1] -> SW7 (lower east)
      { from: 'SW4', to: 'SW6', cp: { x: 620, y: 295 } },
      { from: 'SW4', to: 'SW7', cp: { x: 620, y: 425 } },

      // SW5 branches: [0] -> SW7 (main lower), [1] -> LOOP_BOT (express bypass to SW9)
      { from: 'SW5', to: 'SW7', cp: { x: 620, y: 540 } },
      { from: 'SW5', to: 'LOOP_BOT', cp: { x: 540, y: 655 } },
      { from: 'LOOP_BOT', to: 'SW9', cp: { x: 820, y: 655 } },

      // SW6 branches: [0] -> SW8 (North Stations), [1] -> SW9 (Cross to South Stations)
      { from: 'SW6', to: 'SW8', cp: { x: 870, y: 175 } },
      { from: 'SW6', to: 'SW9', cp: { x: 870, y: 390 } },

      // SW7 branches: [0] -> SW9 (South Stations), [1] -> SW8 (Cross to North Stations)
      { from: 'SW7', to: 'SW9', cp: { x: 870, y: 545 } },
      { from: 'SW7', to: 'SW8', cp: { x: 870, y: 330 } },

      // SW8 branches: [0] -> ST_RED, [1] -> ST_BLUE
      { from: 'SW8', to: 'ST_RED', cp: { x: 1075, y: 105 } },
      { from: 'SW8', to: 'ST_BLUE', cp: { x: 1075, y: 265 } },

      // SW9 branches: [0] -> ST_YELLOW, [1] -> ST_GREEN
      { from: 'SW9', to: 'ST_YELLOW', cp: { x: 1075, y: 455 } },
      { from: 'SW9', to: 'ST_GREEN', cp: { x: 1075, y: 615 } }
    ];

    // Attach outgoing edge lists to nodes
    Object.values(nodes).forEach((n) => {
      n.outEdges = [];
    });
    edges.forEach((edge) => {
      edge.fromNode = nodes[edge.from];
      edge.toNode = nodes[edge.to];
      // Precalculate approximate curve length
      edge.length = estimateQuadLength(edge.fromNode, edge.cp, edge.toNode);
      nodes[edge.from].outEdges.push(edge);
    });

    return { nodes, edges };
  }

  function estimateQuadLength(p0, cp, p1) {
    let len = 0;
    let prev = p0;
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = getQuadPoint(p0, cp, p1, t);
      len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
    }
    return len;
  }

  function getQuadPoint(p0, cp, p1, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * p0.x + 2 * inv * t * cp.x + t * t * p1.x,
      y: inv * inv * p0.y + 2 * inv * t * cp.y + t * t * p1.y
    };
  }

  function getQuadTangentAngle(p0, cp, p1, t) {
    const dx = 2 * (1 - t) * (cp.x - p0.x) + 2 * t * (p1.x - cp.x);
    const dy = 2 * (1 - t) * (cp.y - p0.y) + 2 * t * (p1.y - cp.y);
    return Math.atan2(dy, dx);
  }

  // ==========================================
  // SCENERY DECORATIONS (Trees, Clouds, Mini Houses, Sheep)
  // ==========================================
  const SCENERY = {
    trees: [
      { x: 165, y: 80, r: 24, shade: '#2d6a4f' },
      { x: 210, y: 95, r: 18, shade: '#40916c' },
      { x: 150, y: 350, r: 26, shade: '#2d6a4f' },
      { x: 205, y: 375, r: 20, shade: '#52b788' },
      { x: 165, y: 640, r: 25, shade: '#2d6a4f' },
      { x: 370, y: 65, r: 22, shade: '#40916c' },
      { x: 350, y: 655, r: 24, shade: '#2d6a4f' },
      { x: 740, y: 115, r: 20, shade: '#52b788' },
      { x: 755, y: 615, r: 22, shade: '#2d6a4f' },
      { x: 1045, y: 360, r: 25, shade: '#40916c' }
    ],
    sheep: [
      { x: 255, y: 345, dir: 1, wobble: 0 },
      { x: 285, y: 365, dir: -1, wobble: 1.5 },
      { x: 640, y: 120, dir: 1, wobble: 2.3 },
      { x: 920, y: 640, dir: -1, wobble: 0.7 }
    ],
    houses: [
      { x: 340, y: 245, w: 36, h: 26, roof: '#d62828', angle: -0.1 },
      { x: 615, y: 355, w: 42, h: 30, roof: '#f77f00', angle: 0.06, label: 'Kiosk' },
      { x: 865, y: 85, w: 38, h: 26, roof: '#4361ee', angle: 0.12 }
    ]
  };

  // ==========================================
  // GAME STATE
  // ==========================================
  const state = {
    running: false,
    mode: 'single', // 'single' | 'coop'
    difficulty: 'relaxed', // 'relaxed' | 'rushhour' | 'hardcore'
    network: buildTrackNetwork(),
    trains: [],
    particles: [],
    floatingTexts: [],
    hazards: [], // Cows on track or golden coffee cups
    score: 0,
    combo: 1,
    maxCombo: 1,
    deliveredCount: 0,
    WrongCount: 0,
    cowsCleared: 0,
    lives: 3,
    timeLeft: 180, // 3 minutes shift
    spawnTimer: 1.5,
    hazardTimer: 9.0,
    coffeeBoostTimer: 0,
    coffeeCooldown: 0,
    trainCounter: 101,
    screenShake: 0,

    // Player Cursors (for Keyboard / Gamepad-like Switch & Hazard control)
    players: [
      {
        id: 1,
        name: 'P1 (West)',
        color: '#00bbf9',
        selectedSwitch: 1,
        x: 275,
        y: 205
      },
      {
        id: 2,
        name: 'P2 (Ost)',
        color: '#f77f00',
        selectedSwitch: 6,
        x: 760,
        y: 230
      }
    ]
  };

  // Helper to get Switch node by switchNum (1..9)
  function getSwitchByNumber(num) {
    return Object.values(state.network.nodes).find((n) => n.switchNum === num);
  }

  // ==========================================
  // GAME INITIALIZATION & RESET
  // ==========================================
  function startNewGame() {
    state.network = buildTrackNetwork();
    state.trains = [];
    state.particles = [];
    state.floatingTexts = [];
    state.hazards = [];
    state.score = 0;
    state.combo = 1;
    state.maxCombo = 1;
    state.deliveredCount = 0;
    state.cowsCleared = 0;
    state.lives = 3;
    state.timeLeft = 180;
    state.spawnTimer = 1.0;
    state.hazardTimer = 8.0;
    state.coffeeBoostTimer = 0;
    state.coffeeCooldown = 0;
    state.screenShake = 0;
    state.running = true;

    // Position P1 and P2 cursors
    const sw1 = getSwitchByNumber(1);
    const sw6 = getSwitchByNumber(6);
    state.players[0].selectedSwitch = 1;
    state.players[0].x = sw1.x;
    state.players[0].y = sw1.y;
    state.players[1].selectedSwitch = 6;
    state.players[1].x = sw6.x;
    state.players[1].y = sw6.y;

    coopDivider.classList.toggle('hidden', state.mode !== 'coop');
    eventBanner.classList.add('hidden');
    modalStart.classList.add('hidden');
    modalGameOver.classList.add('hidden');

    updateHUD();
    sfx.playGong();
    triggerAnnouncement('„Schichtbeginn im Stellwerk 3000! Mögen die Weichen mit euch sein!“');
  }

  // ==========================================
  // SPAWNING TRAINS & CHAOS HAZARDS
  // ==========================================
  function getDifficultyParams() {
    if (state.difficulty === 'relaxed') {
      return { spawnInterval: 7.5, maxTrains: 4, baseSpeed: 88, hazardInterval: 16 };
    }
    if (state.difficulty === 'rushhour') {
      return { spawnInterval: 5.5, maxTrains: 6, baseSpeed: 108, hazardInterval: 12 };
    }
    return { spawnInterval: 4.2, maxTrains: 8, baseSpeed: 125, hazardInterval: 9.5 };
  }

  function spawnTrain() {
    const params = getDifficultyParams();
    if (state.trains.length >= params.maxTrains) return;

    const spawns = ['SPAWN_NORTH', 'SPAWN_SOUTH'];
    // Pick a spawn tunnel that does not have a train right at the entrance
    const availableSpawns = spawns.filter((spId) => {
      const spNode = state.network.nodes[spId];
      return !state.trains.some((tr) => Math.hypot(tr.x - spNode.x, tr.y - spNode.y) < 110);
    });

    if (availableSpawns.length === 0) return;

    const spawnId = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
    const spawnNode = state.network.nodes[spawnId];
    const firstEdge = spawnNode.outEdges[0];

    const destKeys = Object.keys(DESTINATIONS);
    const destKey = destKeys[Math.floor(Math.random() * destKeys.length)];
    const destInfo = DESTINATIONS[destKey];

    const arch = TRAIN_ARCHETYPES[Math.floor(Math.random() * TRAIN_ARCHETYPES.length)];
    const trainNum = state.trainCounter++;
    const code = `${arch.prefix} ${trainNum}`;

    const train = {
      id: trainNum,
      code,
      nickname: arch.nickname,
      quip: arch.quip,
      destKey,
      destInfo,
      edge: firstEdge,
      distOnEdge: 0,
      speed: params.baseSpeed * arch.speedMult,
      wagons: arch.wagons,
      x: spawnNode.x,
      y: spawnNode.y,
      angle: 0,
      brakingTimer: 0, // When clicked by player, stops for 3 seconds
      cowBlocked: false,
      history: [], // stores recent positions for following wagons
      smokeTimer: 0,
      delayMins: Math.floor(Math.random() * 45) + 2
    };

    // Pre-populate history trail at spawn so wagons sit neatly behind locomotive
    for (let i = 0; i < 120; i++) {
      train.history.push({ x: spawnNode.x - i * 1.5, y: spawnNode.y, angle: 0 });
    }

    state.trains.push(train);
    sfx.playWhistle(0.9 + Math.random() * 0.25);

    // Update Flip-Board ZZA with latest train
    updateZZABoard(train);
    renderTrainCards();
  }

  function spawnHazard() {
    if (state.hazards.length >= 2) return;

    // Pick a midpoint on one of the central edges
    const candidateEdges = state.network.edges.filter(
      (e) => e.from !== 'SPAWN_NORTH' && e.from !== 'SPAWN_SOUTH'
    );
    const edge = candidateEdges[Math.floor(Math.random() * candidateEdges.length)];
    const pt = getQuadPoint(edge.fromNode, edge.cp, edge.toNode, 0.5);

    // Avoid spawning on top of another hazard
    if (state.hazards.some((h) => Math.hypot(h.x - pt.x, h.y - pt.y) < 80)) return;

    const isCow = Math.random() < 0.68;
    if (isCow) {
      const cowNames = ['Kuh Berta', 'Alpakaherde Horst', 'Biber mit Bauhelm', 'Schaf Wolle'];
      const name = cowNames[Math.floor(Math.random() * cowNames.length)];
      state.hazards.push({
        id: Date.now() + Math.random(),
        type: 'cow',
        name,
        edge,
        x: pt.x,
        y: pt.y,
        timer: 18,
        wobble: 0
      });
      sfx.playMoo();
      showEventBanner('🐄', `${name.toUpperCase()} AUF DEM GLEIS!`, 'Klicke aufs Hindernis (oder schalte die nächste Weiche), um es wegzulocken!');
    } else {
      state.hazards.push({
        id: Date.now() + Math.random(),
        type: 'coffee',
        name: 'Goldener Stellwerk-Espresso',
        edge,
        x: pt.x,
        y: pt.y,
        timer: 14,
        wobble: 0
      });
    }
  }

  function showEventBanner(icon, title, desc) {
    eventIcon.textContent = icon;
    eventTitle.textContent = title;
    eventDesc.textContent = desc;
    eventBanner.classList.remove('hidden');
  }

  function refreshEventBanner() {
    const activeCow = state.hazards.find((h) => h.type === 'cow');
    if (!activeCow) {
      eventBanner.classList.add('hidden');
    }
  }

  // ==========================================
  // INTERACTIONS: SWITCHES, BRAKES & HAZARDS
  // ==========================================
  function toggleSwitch(switchNode, playerTag = null) {
    if (!switchNode || switchNode.type !== 'switch') return;
    switchNode.activeBranch = (switchNode.activeBranch + 1) % switchNode.outEdges.length;
    sfx.playSwitchClack();

    // Small brass spark burst
    for (let i = 0; i < 7; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 60;
      state.particles.push({
        x: switchNode.x,
        y: switchNode.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: 3 + Math.random() * 2,
        color: playerTag === 1 ? '#00bbf9' : playerTag === 2 ? '#f77f00' : '#ffd166',
        alpha: 1,
        life: 0.35
      });
    }

    // Also clear any cow directly adjacent to this switch for effortless keyboard play!
    for (let i = state.hazards.length - 1; i >= 0; i--) {
      const h = state.hazards[i];
      if (Math.hypot(h.x - switchNode.x, h.y - switchNode.y) < 155) {
        resolveHazard(i);
      }
    }
  }

  function resolveHazard(index) {
    const h = state.hazards[index];
    if (!h) return;

    if (h.type === 'cow') {
      state.cowsCleared++;
      state.score += 50 * state.combo;
      addFloatingText(h.x, h.y - 18, `🐄 ${h.name} umgeleitet! +${50 * state.combo}`, '#ffea85');
      sfx.playMoo();
    } else if (h.type === 'coffee') {
      state.score += 75 * state.combo;
      state.coffeeBoostTimer = 6.0;
      addFloatingText(h.x, h.y - 18, `☕ KOFFEIN-BOOST! +${75 * state.combo}`, '#00f5d4');
      sfx.playSuccess();
    }

    // Confetti burst
    spawnConfetti(h.x, h.y, '#ffd166', 14);
    state.hazards.splice(index, 1);
    refreshEventBanner();
    updateHUD();
  }

  function toggleTrainBrake(train) {
    if (train.brakingTimer > 0) {
      train.brakingTimer = 0;
      addFloatingText(train.x, train.y - 24, `🚦 ${train.code}: Freie Fahrt!`, '#38ef7d');
      sfx.playWhistle(1.15);
    } else {
      train.brakingTimer = 3.5;
      addFloatingText(train.x, train.y - 24, `🛑 ${train.code}: Nothalt (3.5s)`, '#ff758f');
      sfx.playSwitchClack();
    }
    renderTrainCards();
  }

  // ==========================================
  // PLAYER INPUTS (MOUSE + 2 KEYBOARD CONTROLLERS)
  // ==========================================
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.running) return;
    // 1. Convert Mouse Coordinates accurately even when Canvas uses CSS `object-fit: contain`
    const rect = canvas.getBoundingClientRect();
    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;

    let renderW = rect.width;
    let renderH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > canvasAspect) {
      renderW = rect.height * canvasAspect;
      offsetX = (rect.width - renderW) / 2;
    } else {
      renderH = rect.width / canvasAspect;
      offsetY = (rect.height - renderH) / 2;
    }

    const mx = ((e.clientX - rect.left - offsetX) / renderW) * canvas.width;
    const my = ((e.clientY - rect.top - offsetY) / renderH) * canvas.height;

    // 2. Check Hazards first (Cows / Golden Coffee)
    for (let i = state.hazards.length - 1; i >= 0; i--) {
      const h = state.hazards[i];
      if (Math.hypot(mx - h.x, my - h.y) < 42) {
        resolveHazard(i);
        return;
      }
    }

    // 3. Check Switches BEFORE Trains (so a train rolling over a switch never blocks clicking the switch!)
    let closestSw = null;
    let bestDist = 52;
    Object.values(state.network.nodes).forEach((node) => {
      if (node.type === 'switch') {
        // Check distance to switch center OR the number badge right above it
        const dCenter = Math.hypot(mx - node.x, my - node.y);
        const dBadge = Math.hypot(mx - node.x, my - (node.y - 25));
        const d = Math.min(dCenter, dBadge);
        if (d < bestDist) {
          bestDist = d;
          closestSw = node;
        }
      }
    });

    if (closestSw) {
      state.players[0].selectedSwitch = closestSw.switchNum;
      toggleSwitch(closestSw);
      return;
    }

    // 4. Check Trains (Click on locomotive to toggle emergency brake / release)
    for (const tr of state.trains) {
      if (Math.hypot(mx - tr.x, my - tr.y) < 34) {
        toggleTrainBrake(tr);
        return;
      }
    }
  });

  // Spatial navigation helper for P1 (WASD) and P2 (Arrows)
  function movePlayerSelection(playerIndex, dx, dy) {
    const player = state.players[playerIndex];
    const currentSw = getSwitchByNumber(player.selectedSwitch);
    if (!currentSw) return;

    let bestSw = null;
    let bestScore = Infinity;

    Object.values(state.network.nodes).forEach((node) => {
      if (node.type !== 'switch' || node.switchNum === player.selectedSwitch) return;
      const vx = node.x - currentSw.x;
      const vy = node.y - currentSw.y;
      const dist = Math.hypot(vx, vy);
      const dot = (vx * dx + vy * dy) / dist;
      // Allow wider angle (dot > 0.12) so diagonal switches like SW1->SW3 or SW3->SW6 are always reachable
      if (dot > 0.12) {
        const score = dist / Math.pow(dot, 1.5);
        if (score < bestScore) {
          bestScore = score;
          bestSw = node;
        }
      }
    });

    if (bestSw) {
      player.selectedSwitch = bestSw.switchNum;
      player.x = bestSw.x;
      player.y = bestSw.y;
      sfx.playSwitchClack();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.running) {
        state.running = false;
        modalStart.classList.remove('hidden');
      }
      return;
    }

    if (e.key.toLowerCase() === 'm') {
      const muted = sfx.toggleMute();
      btnMute.textContent = muted ? '🔇' : '🔊';
      return;
    }

    if (!state.running) return;

    if (e.code && e.code.startsWith('Numpad')) {
      const numStr = e.code.replace('Numpad', '');
      if (numStr >= '1' && numStr <= '9') {
        const num = parseInt(numStr, 10);
        const sw = getSwitchByNumber(num);
        if (sw) {
          state.players[0].selectedSwitch = num;
          toggleSwitch(sw, 1);
        }
        return;
      }
    }

    // Number keys 1-9 directly toggle switch 1-9
    if (e.key >= '1' && e.key <= '9') {
      const num = parseInt(e.key, 10);
      const sw = getSwitchByNumber(num);
      if (sw) {
        state.players[0].selectedSwitch = num;
        toggleSwitch(sw, 1);
      }
      return;
    }

    // Excuse Generator (E) & Turbo Coffee (C)
    if (e.key.toLowerCase() === 'e') {
      triggerRandomExcuse();
      return;
    }
    if (e.key.toLowerCase() === 'c') {
      activateGlobalCoffee();
      return;
    }

    // Player 1: WASD + Space
    switch (e.key.toLowerCase()) {
      case 'w':
        movePlayerSelection(0, 0, -1);
        break;
      case 's':
        movePlayerSelection(0, 0, 1);
        break;
      case 'a':
        movePlayerSelection(0, -1, 0);
        break;
      case 'd':
        movePlayerSelection(0, 1, 0);
        break;
      case ' ':
        e.preventDefault();
        toggleSwitch(getSwitchByNumber(state.players[0].selectedSwitch), 1);
        break;
    }

    // Player 2 (or Singleplayer Alternative): Arrow Keys + Enter
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        movePlayerSelection(state.mode === 'coop' ? 1 : 0, 0, -1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        movePlayerSelection(state.mode === 'coop' ? 1 : 0, 0, 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        movePlayerSelection(state.mode === 'coop' ? 1 : 0, -1, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        movePlayerSelection(state.mode === 'coop' ? 1 : 0, 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        const pIdx = state.mode === 'coop' ? 1 : 0;
        toggleSwitch(getSwitchByNumber(state.players[pIdx].selectedSwitch), pIdx + 1);
        break;
    }
  });

  // ==========================================
  // SPECIAL GADGETS: EXCUSE GENERATOR & TURBO COFFEE
  // ==========================================
  let paTimeout = null;
  function triggerAnnouncement(text) {
    paText.textContent = text;
    paToast.classList.remove('hidden');
    if (paTimeout) clearTimeout(paTimeout);
    paTimeout = setTimeout(() => {
      paToast.classList.add('hidden');
    }, 5200);
  }

  function triggerRandomExcuse() {
    sfx.playGong();
    const quote = FUNNY_ANNOUNCEMENTS[Math.floor(Math.random() * FUNNY_ANNOUNCEMENTS.length)];
    triggerAnnouncement(quote);

    // Fun gameplay effect: Calms passengers & briefly slows all trains by 20% for 3s
    state.trains.forEach((tr) => {
      addFloatingText(tr.x, tr.y - 28, '📢 Fahrgäste schmunzeln!', '#9dc0f5');
    });
  }

  function activateGlobalCoffee() {
    if (state.coffeeCooldown > 0) {
      addFloatingText(640, 80, `☕ Kaffeemaschine brüht noch (${ Math.ceil(state.coffeeCooldown) }s)`, '#ffb703');
      return;
    }
    state.coffeeBoostTimer = 5.0;
    state.coffeeCooldown = 18.0;
    sfx.playWhistle(1.3);
    triggerAnnouncement('„SONDERMELDUNG: Doppelter Espresso für alle Lokführer! Alle Züge im Turbo-Takt!“');
    spawnConfetti(640, 360, '#00f5d4', 25);
  }

  // ==========================================
  // UPDATE LOOP (PHYSICS, TRAINS, COLLISIONS)
  // ==========================================
  function update(dt) {
    if (!state.running) return;

    // Shift timer
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endShift('TIME_UP');
      return;
    }

    if (state.coffeeBoostTimer > 0) state.coffeeBoostTimer = Math.max(0, state.coffeeBoostTimer - dt);
    if (state.coffeeCooldown > 0) state.coffeeCooldown = Math.max(0, state.coffeeCooldown - dt);
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 25);

    // Spawners
    const params = getDifficultyParams();
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnTrain();
      state.spawnTimer = params.spawnInterval * (0.85 + Math.random() * 0.3);
    }

    state.hazardTimer -= dt;
    if (state.hazardTimer <= 0) {
      spawnHazard();
      state.hazardTimer = params.hazardInterval;
    }

    // Update Hazards
    for (let i = state.hazards.length - 1; i >= 0; i--) {
      const h = state.hazards[i];
      h.wobble += dt * 5;
      h.timer -= dt;
      if (h.timer <= 0) {
        state.hazards.splice(i, 1);
        refreshEventBanner();
      }
    }

    // Update Sheep subtle animation
    SCENERY.sheep.forEach((s) => {
      s.wobble += dt * 2.5;
    });

    // Update Trains
    for (let i = state.trains.length - 1; i >= 0; i--) {
      const tr = state.trains[i];

      // Check if blocked by a cow on the same edge
      let blockedByCow = false;
      for (let hIdx = state.hazards.length - 1; hIdx >= 0; hIdx--) {
        const h = state.hazards[hIdx];
        if (Math.hypot(tr.x - h.x, tr.y - h.y) < 34) {
          if (h.type === 'cow') {
            blockedByCow = true;
            if (!tr.cowBlocked) {
              tr.cowBlocked = true;
              sfx.playMoo();
              addFloatingText(tr.x, tr.y - 30, '🐄 MUH! Gleis blockiert!', '#ffba08');
            }
          } else if (h.type === 'coffee') {
            resolveHazard(hIdx);
          }
        }
      }
      if (!blockedByCow) tr.cowBlocked = false;

      if (tr.brakingTimer > 0) {
        tr.brakingTimer = Math.max(0, tr.brakingTimer - dt);
        if (tr.brakingTimer === 0) renderTrainCards();
      }

      const isStopped = tr.brakingTimer > 0 || tr.cowBlocked;
      const boostMult = state.coffeeBoostTimer > 0 ? 1.45 : 1.0;
      const currentSpeed = isStopped ? 0 : tr.speed * boostMult;

      // Advance along current edge
      tr.distOnEdge += currentSpeed * dt;

      // Steam puff particles
      tr.smokeTimer -= dt;
      if (tr.smokeTimer <= 0) {
        tr.smokeTimer = isStopped ? 0.35 : 0.11;
        state.particles.push({
          x: tr.x + Math.cos(tr.angle) * 10,
          y: tr.y + Math.sin(tr.angle) * 10 - 6,
          vx: (Math.random() - 0.5) * 14,
          vy: -15 - Math.random() * 15,
          r: 5 + Math.random() * 4,
          color: state.coffeeBoostTimer > 0 ? '#90e0ef' : '#f8f9fa',
          alpha: 0.75,
          life: 0.75,
          grow: true
        });
      }

      // Transition across nodes if reached end of edge
      while (tr.distOnEdge >= tr.edge.length) {
        tr.distOnEdge -= tr.edge.length;
        const reachedNode = tr.edge.toNode;

        if (reachedNode.type === 'station') {
          handleTrainArrival(tr, reachedNode);
          state.trains.splice(i, 1);
          renderTrainCards();
          tr.arrived = true;
          break;
        } else if (reachedNode.outEdges.length > 0) {
          const branchIdx = reachedNode.type === 'switch' ? reachedNode.activeBranch : 0;
          tr.edge = reachedNode.outEdges[branchIdx] || reachedNode.outEdges[0];
        }
      }

      if (tr.arrived) continue;

      // Compute exact position & tangent on curve
      const t = Math.min(1, Math.max(0, tr.distOnEdge / tr.edge.length));
      const pos = getQuadPoint(tr.edge.fromNode, tr.edge.cp, tr.edge.toNode, t);
      const ang = getQuadTangentAngle(tr.edge.fromNode, tr.edge.cp, tr.edge.toNode, t);

      const movedDist = Math.hypot(pos.x - tr.x, pos.y - tr.y);
      tr.x = pos.x;
      tr.y = pos.y;
      tr.angle = ang;

      if (movedDist > 0.5) {
        tr.history.unshift({ x: tr.x, y: tr.y, angle: tr.angle });
        if (tr.history.length > 180) tr.history.pop();
      }
    }

    // Check Train-to-Train Collisions!
    for (let i = 0; i < state.trains.length; i++) {
      for (let j = i + 1; j < state.trains.length; j++) {
        const a = state.trains[i];
        const b = state.trains[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 30) {
          handleTrainCollision(a, b, i, j);
          break;
        }
      }
    }

    // Update Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.grow) p.r += dt * 10;
      p.alpha = Math.max(0, p.life * 1.2);
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y -= 28 * dt;
      ft.life -= dt;
      if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }

    updateHUD();
  }

  function handleTrainArrival(train, stationNode) {
    const isCorrect = train.destKey === stationNode.stationKey;

    if (isCorrect) {
      const pts = 120 * state.combo;
      state.score += pts;
      state.deliveredCount++;
      state.combo = Math.min(8, state.combo + 1);
      state.maxCombo = Math.max(state.maxCombo, state.combo);

      sfx.playSuccess();
      spawnConfetti(stationNode.x - 20, stationNode.y, train.destInfo.color, 22);
      addFloatingText(
        stationNode.x - 110,
        stationNode.y - 25,
        `🎉 PÜNKTLICH! +${pts} (${state.combo}x)`,
        '#38ef7d'
      );
    } else {
      // Wrong station! Funny satire penalty
      state.combo = 1;
      state.lives = Math.max(0, state.lives - 1);
      state.screenShake = 8;
      sfx.playCrash();

      const wrongStationName = DESTINATIONS[stationNode.stationKey].name;
      addFloatingText(
        stationNode.x - 140,
        stationNode.y - 25,
        `😱 IRRFAHRT nach ${wrongStationName}! (-1 ☕)`,
        '#ef233c'
      );
      triggerAnnouncement(
        `„Ups! ${train.code} wollte nach ${train.destInfo.name}, steht aber jetzt verwirrt in ${wrongStationName}!“`
      );

      if (state.lives <= 0) {
        endShift('NO_PATIENCE');
      }
    }
  }

  function handleTrainCollision(a, b, idxA, idxB) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;

    sfx.playCrash();
    state.screenShake = 14;
    state.combo = 1;
    state.lives = Math.max(0, state.lives - 1);

    spawnConfetti(cx, cy, '#ef233c', 30);
    addFloatingText(cx, cy - 20, `💥 KUSCHEL-KURS! ${a.code} & ${b.code}! (-1 ☕)`, '#ffba08');
    triggerAnnouncement(
      `„Achtung: ${a.code} und ${b.code} wollten gleichzeitig dieselbe Schiene benutzen. Das Bordbistro serviert jetzt Rührei!“`
    );

    // Remove both collided trains
    state.trains.splice(idxB, 1);
    state.trains.splice(idxA, 1);
    renderTrainCards();

    if (state.lives <= 0) {
      endShift('NO_PATIENCE');
    }
  }

  function endShift(reason) {
    state.running = false;
    sfx.playGong();

    const repTitle = document.getElementById('report-title');
    const repSubtitle = document.getElementById('report-subtitle');
    const repDelivered = document.getElementById('rep-delivered');
    const repScore = document.getElementById('rep-score');
    const repCombo = document.getElementById('rep-combo');
    const repCows = document.getElementById('rep-cows');
    const repRank = document.getElementById('rep-rank');
    const repQuote = document.getElementById('rep-quote');

    if (reason === 'TIME_UP') {
      repTitle.textContent = '🎉 SCHICHT ERFOLGREICH BEENDET!';
      repSubtitle.textContent = 'Die Stechuhr klingelt! Hier ist deine offizielle Stellwerk-Bilanz:';
    } else {
      repTitle.textContent = '☕ VORSTAND HAT KEINEN KAFFEE MEHR!';
      repSubtitle.textContent = 'Nach drei Irrfahrten wurde das Stellwerk vorübergehend in den Pausenmodus versetzt:';
    }

    repDelivered.textContent = state.deliveredCount;
    repScore.textContent = state.score;
    repCombo.textContent = `x${state.maxCombo}`;
    repCows.textContent = state.cowsCleared;

    // Pick rank
    let rankObj = RANKS[0];
    for (const r of RANKS) {
      if (state.score >= r.min) rankObj = r;
    }
    repRank.textContent = rankObj.title;
    repQuote.textContent = rankObj.quote;

    modalGameOver.classList.remove('hidden');
  }

  // ==========================================
  // UI & HUD HELPERS
  // ==========================================
  function updateHUD() {
    statScore.textContent = String(state.score).padStart(3, '0');
    statCombo.textContent = `x${state.combo}`;

    // Format MM:SS
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    statTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Update coffee hearts
    const hearts = statLives.querySelectorAll('.heart');
    hearts.forEach((h, idx) => {
      h.classList.toggle('active', idx < state.lives);
    });
  }

  function updateZZABoard(train) {
    zzaTrain.textContent = train.code;
    zzaDest.textContent = `Nach ${train.destInfo.name} (${train.nickname})`;
    zzaDelay.textContent = `+${train.delayMins} Min`;
  }

  function renderTrainCards() {
    trainCardsEl.innerHTML = '';
    if (state.trains.length === 0) {
      const empty = document.createElement('div');
      empty.style.fontSize = '0.75rem';
      empty.style.color = '#7c8796';
      empty.textContent = 'Keine Züge im Sektor – nächster Zug rollt gleich aus dem Tunnel...';
      trainCardsEl.appendChild(empty);
      return;
    }

    state.trains.forEach((tr) => {
      const pill = document.createElement('div');
      pill.className = 'train-pill';
      pill.title = 'Klicken für Notbremse / Weiterfahrt';
      const isBraking = tr.brakingTimer > 0;
      pill.innerHTML = `
        <span class="train-dot" style="background:${tr.destInfo.color}"></span>
        <span>${tr.code} → ${tr.destInfo.name.split(' ')[0]}</span>
        <span class="train-state-badge ${isBraking ? 'braking' : ''}">
          ${isBraking ? '🛑 HALT' : '🟢 FAHRT'}
        </span>
      `;
      pill.addEventListener('click', () => toggleTrainBrake(tr));
      trainCardsEl.appendChild(pill);
    });
  }

  function spawnConfetti(x, y, mainColor, count = 16) {
    const palette = [mainColor, '#ffd166', '#ffffff', '#00f5d4'];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      state.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        r: 3 + Math.random() * 3,
        color: palette[i % palette.length],
        alpha: 1,
        life: 0.65 + Math.random() * 0.35
      });
    }
  }

  function addFloatingText(x, y, text, color = '#ffffff') {
    state.floatingTexts.push({
      x: Math.max(110, Math.min(1150, x)),
      y: Math.max(50, Math.min(670, y)),
      text,
      color,
      life: 1.65
    });
  }

  // ==========================================
  // RENDERING: WOODEN DIORAMA & TRAINS
  // ==========================================
  function render() {
    ctx.save();

    // Screen shake effect on crash/wrong station
    if (state.screenShake > 0) {
      const sx = (Math.random() - 0.5) * state.screenShake;
      const sy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Lush Tabletop Meadow Background
    drawDioramaBackground();

    // 2. Co-Op Zone Midline on the Tabletop
    if (state.mode === 'coop') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(620, 20);
      ctx.lineTo(620, 700);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw All Wooden Railway Tracks (Sleeper ties + Grooved Beechwood + Metallic Rails)
    state.network.edges.forEach((edge) => {
      drawWoodenTrack(edge, false);
    });

    // 4. Highlight Active Switch Branches so players immediately see where trains will go!
    Object.values(state.network.nodes).forEach((node) => {
      if (node.type === 'switch') {
        const activeEdge = node.outEdges[node.activeBranch];
        if (activeEdge) {
          drawActiveBranchHighlight(activeEdge);
        }
      }
    });

    // 5. Draw Western Tunnels & Eastern Colorful Stations
    Object.values(state.network.nodes).forEach((node) => {
      if (node.type === 'spawn') drawTunnelPortal(node);
      if (node.type === 'station') drawStationBuilding(node);
    });

    // 6. Draw Switch Boxes & Levers
    Object.values(state.network.nodes).forEach((node) => {
      if (node.type === 'switch') drawSwitchLever(node);
    });

    // 7. Draw Scenery (Miniature Houses, Sheep, Trees)
    drawScenery();

    // 8. Draw Hazards (Cows & Golden Espresso Cups)
    state.hazards.forEach((h) => drawHazard(h));

    // 9. Draw Trains (Wagons first, then Locomotive on top)
    state.trains.forEach((tr) => drawTrain(tr));

    // 10. Draw Particles & Steam Puffs
    state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 11. Draw Floating Score/Comedy Popups
    state.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life * 1.2);
      ctx.font = '800 17px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0d131a';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }

  function drawDioramaBackground() {
    // Rich green felt tabletop with soft vignette
    const grad = ctx.createRadialGradient(640, 360, 120, 640, 360, 760);
    grad.addColorStop(0, '#3b6e4c');
    grad.addColorStop(1, '#264a32');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle decorative meadow patches
    ctx.fillStyle = 'rgba(82, 183, 136, 0.11)';
    ctx.beginPath();
    ctx.ellipse(320, 360, 180, 110, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(880, 350, 210, 130, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Scenic river running vertically under the central bridges
    ctx.save();
    ctx.strokeStyle = '#218380';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(615, -20);
    ctx.bezierCurveTo(585, 220, 655, 500, 610, 740);
    ctx.stroke();

    ctx.strokeStyle = '#4ea8de';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(615, -20);
    ctx.bezierCurveTo(585, 220, 655, 500, 610, 740);
    ctx.stroke();
    ctx.restore();
  }

  function drawWoodenTrack(edge) {
    const p0 = edge.fromNode;
    const cp = edge.cp;
    const p1 = edge.toNode;

    ctx.save();
    ctx.lineCap = 'round';

    // Gravel roadbed shadow
    ctx.strokeStyle = 'rgba(18, 28, 20, 0.45)';
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y + 3);
    ctx.quadraticCurveTo(cp.x, cp.y + 3, p1.x, p1.y + 3);
    ctx.stroke();

    // Beechwood base plank (Brio style)
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
    ctx.stroke();

    // Wooden sleepers / ties along curve
    const steps = Math.max(6, Math.floor(edge.length / 22));
    ctx.strokeStyle = '#9c6644';
    ctx.lineWidth = 3;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const pt = getQuadPoint(p0, cp, p1, t);
      const ang = getQuadTangentAngle(p0, cp, p1, t) + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(pt.x - Math.cos(ang) * 9, pt.y - Math.sin(ang) * 9);
      ctx.lineTo(pt.x + Math.cos(ang) * 9, pt.y + Math.sin(ang) * 9);
      ctx.stroke();
    }

    // Inner track groove
    ctx.strokeStyle = '#7f5539';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
    ctx.stroke();

    ctx.restore();
  }

  function drawActiveBranchHighlight(edge) {
    const p0 = edge.fromNode;
    const cp = edge.cp;
    const p1 = edge.toNode;

    ctx.save();
    ctx.strokeStyle = '#38ef7d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
    ctx.stroke();

    // Direction chevron halfway on active branch
    const mid = getQuadPoint(p0, cp, p1, 0.32);
    const ang = getQuadTangentAngle(p0, cp, p1, 0.32);
    ctx.translate(mid.x, mid.y);
    ctx.rotate(ang);
    ctx.fillStyle = '#38ef7d';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSwitchLever(node) {
    const isP1 = state.players[0].selectedSwitch === node.switchNum;
    const isP2 = state.mode === 'coop' && state.players[1].selectedSwitch === node.switchNum;

    ctx.save();
    ctx.translate(node.x, node.y);

    // Selection Halo for Keyboard Players
    if (isP1 || isP2) {
      ctx.strokeStyle = isP1 ? '#00bbf9' : '#f77f00';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Brass Switch Housing Circle
    ctx.fillStyle = '#232830';
    ctx.strokeStyle = '#e5a93b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Direction Arrow pointing along active outgoing edge
    const activeEdge = node.outEdges[node.activeBranch];
    if (activeEdge) {
      const ang = getQuadTangentAngle(node, activeEdge.cp, activeEdge.toNode, 0.08);
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = '#38ef7d';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Key Number Badge (1..9)
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-11, -33, 22, 16, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#14181f';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(node.switchNum), 0, -25);

    ctx.restore();
  }

  function drawTunnelPortal(node) {
    ctx.save();
    ctx.translate(node.x, node.y);

    // Stone mountain mound
    ctx.fillStyle = '#495057';
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-48, -36, 62, 72, 18);
    ctx.fill();
    ctx.stroke();

    // Dark tunnel arch
    ctx.fillStyle = '#121417';
    ctx.beginPath();
    ctx.arc(4, 0, 20, -Math.PI / 2, Math.PI / 2, true);
    ctx.fill();

    // Label plaque
    ctx.fillStyle = '#dee2e6';
    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, -16, -42);

    ctx.restore();
  }

  function drawStationBuilding(node) {
    const info = DESTINATIONS[node.stationKey];
    ctx.save();
    ctx.translate(node.x, node.y);

    // Platform base
    ctx.fillStyle = '#ced4da';
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-34, -40, 88, 80, 12);
    ctx.fill();
    ctx.stroke();

    // Colored Station Roof
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.roundRect(-24, -32, 70, 64, 10);
    ctx.fill();
    ctx.stroke();

    // Roof ridge detail
    ctx.fillStyle = info.roof;
    ctx.fillRect(-16, -24, 54, 48);

    // Destination Color Beacon Circle
    ctx.fillStyle = info.light;
    ctx.beginPath();
    ctx.arc(11, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Station Name Banner (German DB style dark blue sign)
    ctx.fillStyle = '#0f2547';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-80, -56, 146, 22, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.name, -7, -45);

    ctx.restore();
  }

  function drawScenery() {
    // Miniature Houses
    SCENERY.houses.forEach((h) => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      ctx.fillStyle = '#f8f9fa';
      ctx.strokeStyle = '#2b2d42';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-h.w / 2, -h.h / 2, h.w, h.h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.roundRect(-h.w / 2 + 3, -h.h / 2 + 3, h.w - 6, h.h - 6, 3);
      ctx.fill();
      ctx.restore();
    });

    // Cute Grazing Sheep
    SCENERY.sheep.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(s.wobble) * 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#343a40';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.arc(s.dir * 6, -1, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Wooden Toy Trees
    SCENERY.trees.forEach((t) => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(4, 5, t.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = t.shade;
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(-t.r * 0.28, -t.r * 0.28, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHazard(h) {
    ctx.save();
    ctx.translate(h.x, h.y + Math.sin(h.wobble) * 3);

    // Pulsing warning ring
    ctx.strokeStyle = h.type === 'cow' ? '#ffba08' : '#00f5d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(h.wobble * 1.5) * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#14181f';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.type === 'cow' ? '🐄' : '☕', 0, 1);

    ctx.restore();
  }

  function drawTrain(tr) {
    // 1. Draw trailing wagons using history trail
    for (let w = tr.wagons; w >= 1; w--) {
      const histIdx = Math.min(tr.history.length - 1, w * 22);
      const pt = tr.history[histIdx] || { x: tr.x, y: tr.y, angle: tr.angle };

      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.angle);

      // Brass coupling bar
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();

      // Wagon Body
      ctx.fillStyle = tr.destInfo.color;
      ctx.strokeStyle = '#14181f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-15, -10, 30, 20, 6);
      ctx.fill();
      ctx.stroke();

      // Wagon roof stripe
      ctx.fillStyle = tr.destInfo.light;
      ctx.fillRect(-10, -5, 20, 10);

      ctx.restore();
    }

    // 2. Draw Locomotive Engine
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(tr.angle);

    // Headlight beam
    const beamGrad = ctx.createLinearGradient(16, 0, 68, 0);
    beamGrad.addColorStop(0, 'rgba(255, 234, 133, 0.55)');
    beamGrad.addColorStop(1, 'rgba(255, 234, 133, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(16, -5);
    ctx.lineTo(68, -22);
    ctx.lineTo(68, 22);
    ctx.lineTo(16, 5);
    ctx.closePath();
    ctx.fill();

    // Locomotive Body
    ctx.fillStyle = tr.destInfo.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-18, -12, 36, 24, 8);
    ctx.fill();
    ctx.stroke();

    // Cab Roof
    ctx.fillStyle = '#1d2229';
    ctx.beginPath();
    ctx.roundRect(-14, -9, 16, 18, 4);
    ctx.fill();

    // Smokestack Chimney
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(9, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // 3. Floating Train Tag & Destination Badge above Locomotive
    ctx.save();
    ctx.translate(tr.x, tr.y - 26);

    const labelText = tr.brakingTimer > 0 ? `🛑 ${tr.code}` : tr.code;
    ctx.font = '800 11px "JetBrains Mono", monospace';
    const w = ctx.measureText(labelText).width + 14;

    ctx.fillStyle = tr.brakingTimer > 0 ? '#d90429' : '#14181f';
    ctx.strokeStyle = tr.destInfo.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -10, w, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 0, -1);

    ctx.restore();
  }

  // ==========================================
  // UI EVENT LISTENERS
  // ==========================================
  document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      state.mode = card.dataset.mode;
    });
  });

  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.diff;
    });
  });

  btnStartGame.addEventListener('click', startNewGame);
  btnRestartGame.addEventListener('click', startNewGame);
  btnBackMenu.addEventListener('click', () => {
    modalGameOver.classList.add('hidden');
    modalStart.classList.remove('hidden');
  });

  btnExcuse.addEventListener('click', () => {
    if (state.running) triggerRandomExcuse();
  });

  btnCoffee.addEventListener('click', () => {
    if (state.running) activateGlobalCoffee();
  });

  btnMute.addEventListener('click', () => {
    const muted = sfx.toggleMute();
    btnMute.textContent = muted ? '🔇' : '🔊';
  });

  btnMenu.addEventListener('click', () => {
    state.running = false;
    modalStart.classList.remove('hidden');
  });

  // ==========================================
  // MAIN ANIMATION LOOP
  // ==========================================
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
