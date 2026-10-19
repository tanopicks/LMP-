const API_BASE = 'https://api.lmp.mx/3.0.0/';
const STORAGE_KEY_PREFIX = 'lmp_analyzer_starter_v1_';

// Configuración de las 3 áreas según las reglas del usuario
const STARTER_METRICS = [
  { key: 'era',  label: 'ERA',  desc: 'Efectividad (Carreras limpias / 9 IP)', better: 'lower',  placeholder: '0.00' },
  { key: 'whip', label: 'WHIP', desc: '(BB + H) por entrada lanzada',         better: 'lower',  placeholder: '0.00' },
  { key: 'bb',   label: 'BB',   desc: 'Bases por bolas otorgadas',            better: 'lower',  placeholder: '0'    },
  { key: 'so',   label: 'SO',   desc: 'Ponches recetados',                    better: 'higher', placeholder: '0'    },
  { key: 'hr',   label: 'HR',   desc: 'Cuadrangulares permitidos',            better: 'lower',  placeholder: '0'    },
  { key: 'ip',   label: 'IP',   desc: 'Entradas lanzadas (ej. 5.1, 6.0)',     better: 'higher', placeholder: '0.0'  }
];

// Pitcheo Colectivo: Total = 20+20+10+10+10+10+5+5+5+5 = 100 puntos
const PITCHING_METRICS = [
  { key: 'era',  label: 'ERA',  points: 20, better: 'lower',  desc: 'Efectividad colectiva' },
  { key: 'whip', label: 'WHIP', points: 20, better: 'lower',  desc: 'Bases por bolas + Hits por IP' },
  { key: 'er',   label: 'ER',   points: 10, better: 'lower',  desc: 'Carreras limpias permitidas' },
  { key: 'hr',   label: 'HR',   points: 10, better: 'lower',  desc: 'Home runs permitidos' },
  { key: 'bb',   label: 'BB',   points: 10, better: 'lower',  desc: 'Bases por bolas otorgadas' },
  { key: 'so',   label: 'SO',   points: 10, better: 'higher', desc: 'Ponches recetados' },
  { key: 'h',    label: 'H',    points: 5,  better: 'lower',  desc: 'Hits permitidos' },
  { key: 'ip',   label: 'IP',   points: 5,  better: 'higher', desc: 'Innings lanzados' },
  { key: 'avg',  label: 'AVG',  points: 5,  better: 'lower',  desc: 'Promedio de bateo en contra' },
  { key: 'r',    label: 'R',    points: 5,  better: 'lower',  desc: 'Carreras totales permitidas' }
];

// Bateo Colectivo: Total = 20+20+15+15+10+8+7+5 = 100 puntos
const BATTING_METRICS = [
  { key: 'r',   label: 'R',   points: 20, better: 'higher', desc: 'Carreras anotadas' },
  { key: 'ops', label: 'OPS', points: 20, better: 'higher', desc: 'OBP + SLG' },
  { key: 'obp', label: 'OBP', points: 15, better: 'higher', desc: 'Porcentaje de embasarse' },
  { key: 'slg', label: 'SLG', points: 15, better: 'higher', desc: 'Porcentaje de slugging' },
  { key: 'bb',  label: 'BB',  points: 10, better: 'higher', desc: 'Bases por bolas negociadas' },
  { key: 'so',  label: 'SO',  points: 8,  better: 'lower',  desc: 'Ponches recibidos (menos es mejor)' },
  { key: 'hr',  label: 'HR',  points: 7,  better: 'higher', desc: 'Home runs conectados' },
  { key: 'avg', label: 'AVG', points: 5,  better: 'higher', desc: 'Promedio de bateo colectivo' }
];

// Catálogo base de equipos de la LMP
const LMP_TEAMS = [
  { abbr: 'MXC', shortName: 'Águilas',     name: 'Águilas de Mexicali' },
  { abbr: 'GSV', shortName: 'Algodoneros', name: 'Algodoneros de Guasave' },
  { abbr: 'MOC', shortName: 'Cañeros',     name: 'Cañeros de Los Mochis' },
  { abbr: 'JAL', shortName: 'Charros',     name: 'Charros de Jalisco' },
  { abbr: 'NAY', shortName: 'Jaguares',    name: 'Jaguares de Nayarit' },
  { abbr: 'NAV', shortName: 'Mayos',       name: 'Mayos de Navojoa' },
  { abbr: 'HER', shortName: 'Naranjeros',  name: 'Naranjeros de Hermosillo' },
  { abbr: 'CUL', shortName: 'Tomateros',   name: 'Tomateros de Culiacán' },
  { abbr: 'MAZ', shortName: 'Venados',     name: 'Venados de Mazatlán' },
  { abbr: 'OBR', shortName: 'Yaquis',      name: 'Yaquis de Obregón' }
];

// Estado global de la aplicación
const state = {
  selectedDate: '',
  seasonYear: 2026,
  seasonType: 'regular',
  games: [],
  selectedGameIndex: 0,
  awayAbbr: 'OBR',
  homeAbbr: 'MXC',
  pitchingByTeam: {},
  battingByTeam: {},
  individualPitchers: [],
  lastPitchingResult: null,
  lastBattingResult: null,
  lastStarterResult: null
};

// Utilidad para obtener logo oficial de equipo LMP
function getTeamLogoUrl(abbr) {
  if (!abbr) return '';
  return `https://images.cloudgfx.com/teams/${abbr.toLowerCase()}?app=lamp&field=teamName&w=250&h=250`;
}

// Formatea fecha YYYY-MM-DD local
function getTodayFormatted() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convierte una estadística de béisbol a número real comparable
// En IP (Innings Pitched), .1 = 1/3 (0.3333) y .2 = 2/3 (0.6667)
function parseStatValue(rawVal, key) {
  if (rawVal === null || rawVal === undefined) return NaN;
  const str = String(rawVal).trim();
  if (str === '' || str === '-.--' || str === '-') return NaN;

  if (key === 'ip') {
    const num = Number(str);
    if (Number.isNaN(num)) return NaN;
    const whole = Math.trunc(num);
    const tenths = Math.round((num - whole) * 10);
    if (tenths === 1) return whole + 1 / 3;
    if (tenths === 2) return whole + 2 / 3;
    return num;
  }

  return Number(str);
}

// Formatea puntos (ej. 10 o 2.5)
function formatPoints(pts) {
  return Number.isInteger(pts) ? String(pts) : pts.toFixed(1);
}

// Clave de almacenamiento local para los datos de Abridor del duelo activo
function getStarterStorageKey() {
  const activeGame = state.games[state.selectedGameIndex];
  if (activeGame && activeGame.id) {
    return `${STORAGE_KEY_PREFIX}game_${activeGame.id}`;
  }
  return `${STORAGE_KEY_PREFIX}manual_${state.selectedDate}_${state.awayAbbr}_${state.homeAbbr}`;
}

function loadStarterDataFromStorage() {
  try {
    const raw = localStorage.getItem(getStarterStorageKey());
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('No se pudo leer localStorage:', err);
  }
  return {
    awayName: '',
    homeName: '',
    awayStats: {},
    homeStats: {}
  };
}

function saveStarterDataToStorage(data) {
  try {
    localStorage.setItem(getStarterStorageKey(), JSON.stringify(data));
  } catch (err) {
    console.warn('No se pudo guardar en localStorage:', err);
  }
}

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  fetchAllData();
});

function initControls() {
  const dateInput = document.getElementById('gameDate');
  state.selectedDate = getTodayFormatted();
  dateInput.value = state.selectedDate;

  // Poblar selectores manuales de equipos
  const manualAway = document.getElementById('manualAwaySelect');
  const manualHome = document.getElementById('manualHomeSelect');
  LMP_TEAMS.forEach(team => {
    manualAway.add(new Option(`${team.shortName} (${team.abbr})`, team.abbr));
    manualHome.add(new Option(`${team.shortName} (${team.abbr})`, team.abbr));
  });
  manualAway.value = state.awayAbbr;
  manualHome.value = state.homeAbbr;

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.selectedDate = e.target.value;
      fetchScoreboardForDate(state.selectedDate);
    }
  });

  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDateByDays(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDateByDays(1));
  document.getElementById('todayBtn').addEventListener('click', () => {
    state.selectedDate = getTodayFormatted();
    dateInput.value = state.selectedDate;
    fetchScoreboardForDate(state.selectedDate);
  });

  document.getElementById('seasonType').addEventListener('change', (e) => {
    state.seasonType = e.target.value;
    fetchTeamAndPitcherStats();
  });

  document.getElementById('refreshBtn').addEventListener('click', () => {
    fetchAllData();
  });

  manualAway.addEventListener('change', () => {
    state.selectedGameIndex = -1;
    state.awayAbbr = manualAway.value;
    highlightSelectedGameCard();
    renderActiveMatchup();
  });

  manualHome.addEventListener('change', () => {
    state.selectedGameIndex = -1;
    state.homeAbbr = manualHome.value;
    highlightSelectedGameCard();
    renderActiveMatchup();
  });

  document.getElementById('awayPitcherName').addEventListener('input', (e) => {
    const saved = loadStarterDataFromStorage();
    saved.awayName = e.target.value;
    saveStarterDataToStorage(saved);
    renderGlobalSummary();
  });

  document.getElementById('homePitcherName').addEventListener('input', (e) => {
    const saved = loadStarterDataFromStorage();
    saved.homeName = e.target.value;
    saveStarterDataToStorage(saved);
    renderGlobalSummary();
  });

  document.getElementById('autofillPitchersBtn').addEventListener('click', autofillStarterStatsFromLmp);
  document.getElementById('clearPitchersBtn').addEventListener('click', clearStarterStats);
}

function shiftDateByDays(deltaDays) {
  const parts = state.selectedDate.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  state.selectedDate = `${y}-${m}-${day}`;
  document.getElementById('gameDate').value = state.selectedDate;
  fetchScoreboardForDate(state.selectedDate);
}

function setStatus(status, message) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const syncIcon = document.getElementById('syncIcon');

  dot.className = 'dot';
  if (status === 'loading') {
    syncIcon.classList.add('spinning');
  } else {
    syncIcon.classList.remove('spinning');
    if (status === 'ok') dot.classList.add('ok');
    if (status === 'error') dot.classList.add('error');
  }
  text.textContent = message;
}

async function fetchAllData() {
  setStatus('loading', 'Actualizando calendario y estadísticas colectivas desde api.lmp.mx...');
  try {
    await Promise.all([
      fetchTeamAndPitcherStats(),
      fetchScoreboardForDate(state.selectedDate)
    ]);
    const nowStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('lastUpdated').textContent = `Última actualización: hoy a las ${nowStr}`;
    setStatus('ok', `Conectado en tiempo real a api.lmp.mx • Temporada ${state.seasonYear}-${state.seasonYear + 1}`);
  } catch (err) {
    console.error(err);
    setStatus('error', 'Error al conectar con api.lmp.mx. Revisa tu conexión a internet.');
  }
}

async function fetchTeamAndPitcherStats() {
  const year = state.seasonYear;
  const type = state.seasonType;

  const [pitchRes, batRes, indPitchRes] = await Promise.all([
    fetch(`${API_BASE}teams/statistics?limit=100&year=${year}&type=${type}&mode=pitching`),
    fetch(`${API_BASE}teams/statistics?limit=100&year=${year}&type=${type}&mode=batting`),
    fetch(`${API_BASE}statistics?limit=300&year=${year}&type=${type}&mode=pitching`)
  ]);

  const pitchJson = await pitchRes.json();
  const batJson = await batRes.json();
  const indPitchJson = await indPitchRes.json();

  state.pitchingByTeam = {};
  (pitchJson.response || []).forEach(team => {
    if (team.team_abbr) {
      state.pitchingByTeam[team.team_abbr.toUpperCase()] = team;
    }
  });

  state.battingByTeam = {};
  (batJson.response || []).forEach(team => {
    if (team.team_abbr) {
      state.battingByTeam[team.team_abbr.toUpperCase()] = team;
    }
  });

  state.individualPitchers = indPitchJson.response || [];

  renderActiveMatchup();
}

async function fetchScoreboardForDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  setStatus('loading', `Consultando juegos del día ${dateStr} en lmp.mx...`);

  const res = await fetch(`${API_BASE}scoreboard/${y}/${m}/${d}`);
  const json = await res.json();
  const games = (json.response || []).filter(g => g.gameTime !== 'No Hay Juegos');

  state.games = games;
  if (games.length > 0) {
    state.selectedGameIndex = 0;
    state.awayAbbr = games[0].awayTeam;
    state.homeAbbr = games[0].homeTeam;
  } else {
    state.selectedGameIndex = -1;
  }

  renderGamesGrid();
  renderActiveMatchup();
  setStatus('ok', `Conectado en vivo a lmp.mx • ${games.length} juego(s) encontrados para el ${dateStr}`);
}

function renderGamesGrid() {
  const grid = document.getElementById('gamesGrid');
  const titleEl = document.getElementById('scheduleTitle');
  const [y, m, d] = state.selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  titleEl.textContent = `Encuentros del Día (${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)})`;

  grid.innerHTML = '';

  if (state.games.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 18px; background: #f8fafc; border-radius: 12px; text-align: center; color: #475569;">
        No hay juegos programados en <strong>lmp.mx</strong> para esta fecha (${state.selectedDate}).
        Puedes cambiar de fecha arriba o usar el <strong>Comparador Manual</strong> de equipos.
      </div>
    `;
    return;
  }

  state.games.forEach((game, idx) => {
    const card = document.createElement('div');
    card.className = `game-card ${idx === state.selectedGameIndex ? 'active' : ''}`;
    card.dataset.index = idx;

    const isLive = game.gameStatus === 1;
    const isFinal = game.gameStatus === 2;
    let statusClass = '';
    let statusLabel = game.mxTime || game.gameTime || 'Programado';
    if (isLive) {
      statusClass = 'live';
      statusLabel = `EN VIVO • ${game.inningArrow === 'top' ? 'Alta' : 'Baja'} ${game.inningCurrent}ª`;
    } else if (isFinal) {
      statusClass = 'final';
      statusLabel = 'FINAL';
    }

    const awayStarter = game.awayProbablePitcher || 'Por anunciar';
    const homeStarter = game.homeProbablePitcher || 'Por anunciar';

    card.innerHTML = `
      <div class="game-card-top">
        <span>Juego ${idx + 1}</span>
        <span class="game-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="game-teams-row">
        <div class="game-team-line">
          <div class="game-team-left">
            <img src="${getTeamLogoUrl(game.awayTeam)}" alt="${game.awayTeamShort}" class="game-team-logo" />
            <div>
              <div class="game-team-name">${game.awayTeamShort}</div>
              <div class="game-team-rec">(${game.awayTeamWins ?? 0}-${game.awayTeamLosses ?? 0}) • Visita</div>
            </div>
          </div>
          <div class="game-team-score">${isLive || isFinal ? game.awayRuns : ''}</div>
        </div>
        <div class="game-team-line">
          <div class="game-team-left">
            <img src="${getTeamLogoUrl(game.homeTeam)}" alt="${game.homeTeamShort}" class="game-team-logo" />
            <div>
              <div class="game-team-name">${game.homeTeamShort}</div>
              <div class="game-team-rec">(${game.homeTeamWins ?? 0}-${game.homeTeamLosses ?? 0}) • Local</div>
            </div>
          </div>
          <div class="game-team-score">${isLive || isFinal ? game.homeRuns : ''}</div>
        </div>
      </div>
      <div class="game-card-pitchers">
        <div><strong>V:</strong> ${awayStarter}</div>
        <div><strong>L:</strong> ${homeStarter}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      state.selectedGameIndex = idx;
      state.awayAbbr = game.awayTeam;
      state.homeAbbr = game.homeTeam;
      document.getElementById('manualAwaySelect').value = state.awayAbbr;
      document.getElementById('manualHomeSelect').value = state.homeAbbr;
      highlightSelectedGameCard();
      renderActiveMatchup();
    });

    grid.appendChild(card);
  });
}

function highlightSelectedGameCard() {
  const cards = document.querySelectorAll('.game-card');
  cards.forEach((c, idx) => {
    c.classList.toggle('active', idx === state.selectedGameIndex);
  });
}

function getTeamMeta(abbr) {
  const found = LMP_TEAMS.find(t => t.abbr === abbr);
  const pitch = state.pitchingByTeam[abbr];
  return {
    abbr,
    shortName: found ? found.shortName : (pitch ? pitch.team_short : abbr),
    name: found ? found.name : (pitch ? pitch.name : abbr),
    w: pitch ? pitch.w : 0,
    l: pitch ? pitch.l : 0
  };
}

function renderActiveMatchup() {
  const awayMeta = getTeamMeta(state.awayAbbr);
  const homeMeta = getTeamMeta(state.homeAbbr);
  const activeGame = state.selectedGameIndex >= 0 ? state.games[state.selectedGameIndex] : null;

  document.getElementById('manualAwaySelect').value = state.awayAbbr;
  document.getElementById('manualHomeSelect').value = state.homeAbbr;

  // Actualizar banner principal (Hero)
  document.getElementById('heroAwayLogo').src = getTeamLogoUrl(awayMeta.abbr);
  document.getElementById('heroAwayName').textContent = awayMeta.name;
  document.getElementById('heroAwayRecord').textContent = `Récord: ${awayMeta.w}G - ${awayMeta.l}P`;

  document.getElementById('heroHomeLogo').src = getTeamLogoUrl(homeMeta.abbr);
  document.getElementById('heroHomeName').textContent = homeMeta.name;
  document.getElementById('heroHomeRecord').textContent = `Récord: ${homeMeta.w}G - ${homeMeta.l}P`;

  if (activeGame) {
    document.getElementById('heroGameMeta').textContent = `${activeGame.stadium || 'Estadio LMP'} • ${activeGame.mxTime || activeGame.gameTime || ''}`;
  } else {
    document.getElementById('heroGameMeta').textContent = 'Comparación directa de equipos';
  }

  // Actualizar encabezados de columnas en las 3 tablas
  document.getElementById('thStarterAway').textContent = `${awayMeta.shortName} (Visita)`;
  document.getElementById('thStarterHome').textContent = `${homeMeta.shortName} (Local)`;
  document.getElementById('thPitchingAway').textContent = `${awayMeta.shortName} (Visita)`;
  document.getElementById('thPitchingHome').textContent = `${homeMeta.shortName} (Local)`;
  document.getElementById('thBattingAway').textContent = `${awayMeta.shortName} (Visita)`;
  document.getElementById('thBattingHome').textContent = `${homeMeta.shortName} (Local)`;

  renderStarterSection(awayMeta, homeMeta, activeGame);
  renderPitchingSection(awayMeta, homeMeta);
  renderBattingSection(awayMeta, homeMeta);
  renderGlobalSummary();
}

// ============================================================================
// ÁREA 1: ABRIDOR (Campos abiertos ERA, WHIP, BB, SO, HR, IP - Sin puntos)
// ============================================================================
function renderStarterSection(awayMeta, homeMeta, activeGame) {
  const saved = loadStarterDataFromStorage();

  const defaultAwayPitcher = activeGame && activeGame.awayProbablePitcher ? activeGame.awayProbablePitcher : '';
  const defaultHomePitcher = activeGame && activeGame.homeProbablePitcher ? activeGame.homeProbablePitcher : '';

  const awayNameInput = document.getElementById('awayPitcherName');
  const homeNameInput = document.getElementById('homePitcherName');

  awayNameInput.value = saved.awayName !== undefined && saved.awayName !== '' ? saved.awayName : defaultAwayPitcher;
  homeNameInput.value = saved.homeName !== undefined && saved.homeName !== '' ? saved.homeName : defaultHomePitcher;

  document.getElementById('awayStarterTeamLabel').textContent = awayMeta.shortName;
  document.getElementById('homeStarterTeamLabel').textContent = homeMeta.shortName;

  document.getElementById('awayStarterImg').src = (activeGame && activeGame.awayProbablePitcherImg) || getTeamLogoUrl(awayMeta.abbr);
  document.getElementById('homeStarterImg').src = (activeGame && activeGame.homeProbablePitcherImg) || getTeamLogoUrl(homeMeta.abbr);

  document.getElementById('awayPitcherSummary').textContent = activeGame && activeGame.awayProbablePitcher
    ? `Anunciado en lmp.mx: ${activeGame.awayProbablePitcherWins ?? 0}-${activeGame.awayProbablePitcherLosses ?? 0}, ERA ${activeGame.awayProbablePitcherEra || '-.--'}`
    : 'Puedes escribir o editar el nombre y sus estadísticas abajo';

  document.getElementById('homePitcherSummary').textContent = activeGame && activeGame.homeProbablePitcher
    ? `Anunciado en lmp.mx: ${activeGame.homeProbablePitcherWins ?? 0}-${activeGame.homeProbablePitcherLosses ?? 0}, ERA ${activeGame.homeProbablePitcherEra || '-.--'}`
    : 'Puedes escribir o editar el nombre y sus estadísticas abajo';

  const tbody = document.getElementById('starterTableBody');
  tbody.innerHTML = '';

  STARTER_METRICS.forEach(metric => {
    const tr = document.createElement('tr');
    const awayRaw = saved.awayStats[metric.key] ?? '';
    const homeRaw = saved.homeStats[metric.key] ?? '';

    const criteriaText = metric.better === 'lower' ? 'Menor gana ↓' : 'Mayor gana ↑';

    tr.innerHTML = `
      <td class="val-cell" id="starterCellAway_${metric.key}">
        <input
          type="number"
          step="any"
          class="starter-stat-input"
          id="starterInputAway_${metric.key}"
          placeholder="${metric.placeholder}"
          value="${awayRaw}"
          aria-label="${metric.label} Abridor Visitante"
        />
        <span id="starterBadgeAway_${metric.key}"></span>
      </td>
      <td class="stat-cell-name" title="${metric.desc}">
        ${metric.label}
      </td>
      <td class="criteria-cell">${criteriaText}</td>
      <td class="val-cell" id="starterCellHome_${metric.key}">
        <input
          type="number"
          step="any"
          class="starter-stat-input"
          id="starterInputHome_${metric.key}"
          placeholder="${metric.placeholder}"
          value="${homeRaw}"
          aria-label="${metric.label} Abridor Local"
        />
        <span id="starterBadgeHome_${metric.key}"></span>
      </td>
    `;

    tbody.appendChild(tr);

    const awayInput = tr.querySelector(`#starterInputAway_${metric.key}`);
    const homeInput = tr.querySelector(`#starterInputHome_${metric.key}`);

    const onStatInput = () => {
      const currentSaved = loadStarterDataFromStorage();
      currentSaved.awayName = awayNameInput.value;
      currentSaved.homeName = homeNameInput.value;
      currentSaved.awayStats[metric.key] = awayInput.value;
      currentSaved.homeStats[metric.key] = homeInput.value;
      saveStarterDataToStorage(currentSaved);
      evaluateStarterRowAndTotals(awayMeta, homeMeta);
    };

    awayInput.addEventListener('input', onStatInput);
    homeInput.addEventListener('input', onStatInput);
  });

  evaluateStarterRowAndTotals(awayMeta, homeMeta);
}

function evaluateStarterRowAndTotals(awayMeta, homeMeta) {
  let awayWins = 0;
  let homeWins = 0;
  let ties = 0;
  let comparedCount = 0;

  STARTER_METRICS.forEach(metric => {
    const awayInput = document.getElementById(`starterInputAway_${metric.key}`);
    const homeInput = document.getElementById(`starterInputHome_${metric.key}`);
    const awayCell = document.getElementById(`starterCellAway_${metric.key}`);
    const homeCell = document.getElementById(`starterCellHome_${metric.key}`);
    const awayBadge = document.getElementById(`starterBadgeAway_${metric.key}`);
    const homeBadge = document.getElementById(`starterBadgeHome_${metric.key}`);

    awayCell.classList.remove('cell-winner', 'cell-tie');
    homeCell.classList.remove('cell-winner', 'cell-tie');
    awayBadge.innerHTML = '';
    homeBadge.innerHTML = '';

    const valAway = parseStatValue(awayInput.value, metric.key);
    const valHome = parseStatValue(homeInput.value, metric.key);

    if (!Number.isNaN(valAway) && !Number.isNaN(valHome)) {
      comparedCount++;
      const diff = Math.abs(valAway - valHome);
      if (diff < 1e-6) {
        awayCell.classList.add('cell-tie');
        homeCell.classList.add('cell-tie');
        awayBadge.innerHTML = '<span class="tie-tag">Empate</span>';
        homeBadge.innerHTML = '<span class="tie-tag">Empate</span>';
        ties++;
      } else {
        const awayIsBetter = metric.better === 'lower' ? valAway < valHome : valAway > valHome;
        if (awayIsBetter) {
          awayCell.classList.add('cell-winner');
          awayBadge.innerHTML = '<span class="winner-tag">✓ Gana</span>';
          awayWins++;
        } else {
          homeCell.classList.add('cell-winner');
          homeBadge.innerHTML = '<span class="winner-tag">✓ Gana</span>';
          homeWins++;
        }
      }
    }
  });

  state.lastStarterResult = { awayWins, homeWins, ties, comparedCount };

  const resultBox = document.getElementById('starterResultBox');
  const awayPitcher = document.getElementById('awayPitcherName').value || awayMeta.shortName;
  const homePitcher = document.getElementById('homePitcherName').value || homeMeta.shortName;

  if (comparedCount === 0) {
    resultBox.innerHTML = `
      <div class="result-verdict" style="color: #cbd5e1;">
        Ingresa los datos de <strong>ERA, WHIP, BB, SO, HR, IP</strong> arriba para que se pinten con color las casillas ganadoras.
      </div>
    `;
  } else {
    let verdictText = 'Empate en estadísticas ganadas de abridores';
    if (awayWins > homeWins) {
      verdictText = `Ventaja en Abridor: ${awayMeta.shortName} (${awayPitcher}) gana ${awayWins} de ${comparedCount} estadísticas`;
    } else if (homeWins > awayWins) {
      verdictText = `Ventaja en Abridor: ${homeMeta.shortName} (${homePitcher}) gana ${homeWins} de ${comparedCount} estadísticas`;
    }

    resultBox.innerHTML = `
      <div class="result-scores-row">
        <div class="result-team-score">
          <span class="result-team-name">${awayMeta.shortName} (${awayPitcher})</span>
          <span class="result-points-badge ${awayWins > homeWins ? 'winner-score' : ''}">${awayWins} ganadas</span>
        </div>
        <div class="result-verdict">${verdictText}</div>
        <div class="result-team-score">
          <span class="result-points-badge ${homeWins > awayWins ? 'winner-score' : ''}">${homeWins} ganadas</span>
          <span class="result-team-name">${homeMeta.shortName} (${homePitcher})</span>
        </div>
      </div>
    `;
  }

  renderGlobalSummary();
}

function findPitcherSeasonStats(mlbid, nameStr) {
  if (mlbid) {
    const byId = state.individualPitchers.find(p => Number(p.milb_id) === Number(mlbid));
    if (byId) return byId;
  }
  if (nameStr) {
    const clean = nameStr.trim().toLowerCase();
    return state.individualPitchers.find(p => (p.name || '').trim().toLowerCase() === clean);
  }
  return null;
}

function autofillStarterStatsFromLmp() {
  const activeGame = state.selectedGameIndex >= 0 ? state.games[state.selectedGameIndex] : null;
  const awayName = document.getElementById('awayPitcherName').value;
  const homeName = document.getElementById('homePitcherName').value;

  const awayPitcherObj = findPitcherSeasonStats(activeGame ? activeGame.awayProbablePitcherMlbid : null, awayName);
  const homePitcherObj = findPitcherSeasonStats(activeGame ? activeGame.homeProbablePitcherMlbid : null, homeName);

  const saved = loadStarterDataFromStorage();
  saved.awayName = awayName;
  saved.homeName = homeName;

  STARTER_METRICS.forEach(m => {
    if (awayPitcherObj && awayPitcherObj[m.key] !== undefined) {
      saved.awayStats[m.key] = awayPitcherObj[m.key];
    } else if (m.key === 'era' && activeGame && activeGame.awayProbablePitcherEra && activeGame.awayProbablePitcherEra !== '-.--') {
      saved.awayStats.era = activeGame.awayProbablePitcherEra;
    }

    if (homePitcherObj && homePitcherObj[m.key] !== undefined) {
      saved.homeStats[m.key] = homePitcherObj[m.key];
    } else if (m.key === 'era' && activeGame && activeGame.homeProbablePitcherEra && activeGame.homeProbablePitcherEra !== '-.--') {
      saved.homeStats.era = activeGame.homeProbablePitcherEra;
    }
  });

  saveStarterDataToStorage(saved);
  renderActiveMatchup();
}

function clearStarterStats() {
  const saved = {
    awayName: document.getElementById('awayPitcherName').value,
    homeName: document.getElementById('homePitcherName').value,
    awayStats: {},
    homeStats: {}
  };
  saveStarterDataToStorage(saved);
  renderActiveMatchup();
}

// ============================================================================
// ÁREA 2 Y 3: PITCHEO COLECTIVO (100 PTS) Y BATEO COLECTIVO (100 PTS)
// ============================================================================
function renderCollectiveTable({ metrics, awayStatsObj, homeStatsObj, tbodyId, resultBoxId, sectionTitle, awayMeta, homeMeta }) {
  const tbody = document.getElementById(tbodyId);
  const resultBox = document.getElementById(resultBoxId);
  tbody.innerHTML = '';

  let awayTotalPts = 0;
  let homeTotalPts = 0;

  metrics.forEach(metric => {
    const rawAway = awayStatsObj ? awayStatsObj[metric.key] : '-';
    const rawHome = homeStatsObj ? homeStatsObj[metric.key] : '-';

    const valAway = parseStatValue(rawAway, metric.key);
    const valHome = parseStatValue(rawHome, metric.key);

    let awayCellClass = 'val-cell';
    let homeCellClass = 'val-cell';
    let awayPtsClass = 'pts-cell';
    let homePtsClass = 'pts-cell';
    let awayBadge = '';
    let homeBadge = '';
    let awayEarned = 0;
    let homeEarned = 0;

    if (!Number.isNaN(valAway) && !Number.isNaN(valHome)) {
      const diff = Math.abs(valAway - valHome);
      if (diff < 1e-6) {
        // Empate: se dividen los puntos a la mitad
        awayEarned = metric.points / 2;
        homeEarned = metric.points / 2;
        awayCellClass += ' cell-tie';
        homeCellClass += ' cell-tie';
        awayPtsClass += ' pts-split';
        homePtsClass += ' pts-split';
        awayBadge = '<span class="tie-tag">Empate</span>';
        homeBadge = '<span class="tie-tag">Empate</span>';
      } else {
        const awayWins = metric.better === 'lower' ? valAway < valHome : valAway > valHome;
        if (awayWins) {
          awayEarned = metric.points;
          awayCellClass += ' cell-winner';
          awayPtsClass += ' pts-earned';
          awayBadge = '<span class="winner-tag">✓ Gana</span>';
        } else {
          homeEarned = metric.points;
          homeCellClass += ' cell-winner';
          homePtsClass += ' pts-earned';
          homeBadge = '<span class="winner-tag">✓ Gana</span>';
        }
      }
    }

    awayTotalPts += awayEarned;
    homeTotalPts += homeEarned;

    const criteriaLabel = metric.better === 'lower' ? 'Menor ↓' : 'Mayor ↑';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${awayCellClass}">
        <span>${rawAway ?? '-'}</span>
        ${awayBadge}
      </td>
      <td class="${awayPtsClass}">+${formatPoints(awayEarned)}</td>
      <td class="stat-cell-name" title="${metric.desc}">
        ${metric.label}
        <span class="stat-weight-badge">(${metric.points})</span>
      </td>
      <td class="criteria-cell">${criteriaLabel}</td>
      <td class="${homePtsClass}">+${formatPoints(homeEarned)}</td>
      <td class="${homeCellClass}">
        <span>${rawHome ?? '-'}</span>
        ${homeBadge}
      </td>
    `;
    tbody.appendChild(tr);
  });

  let verdict = `Empate en ${sectionTitle}: ${formatPoints(awayTotalPts)} a ${formatPoints(homeTotalPts)} puntos`;
  if (awayTotalPts > homeTotalPts) {
    verdict = `Ganador ${sectionTitle}: ${awayMeta.name} (${formatPoints(awayTotalPts)} pts vs ${formatPoints(homeTotalPts)} pts)`;
  } else if (homeTotalPts > awayTotalPts) {
    verdict = `Ganador ${sectionTitle}: ${homeMeta.name} (${formatPoints(homeTotalPts)} pts vs ${formatPoints(awayTotalPts)} pts)`;
  }

  resultBox.innerHTML = `
    <div class="result-scores-row">
      <div class="result-team-score">
        <span class="result-team-name">${awayMeta.shortName}:</span>
        <span class="result-points-badge ${awayTotalPts > homeTotalPts ? 'winner-score' : ''}">${formatPoints(awayTotalPts)} pts</span>
      </div>
      <div class="result-verdict">${verdict}</div>
      <div class="result-team-score">
        <span class="result-points-badge ${homeTotalPts > awayTotalPts ? 'winner-score' : ''}">${formatPoints(homeTotalPts)} pts</span>
        <span class="result-team-name">:${homeMeta.shortName}</span>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-fill-away" style="width: ${awayTotalPts}%"></div>
      <div class="progress-fill-home" style="width: ${homeTotalPts}%"></div>
    </div>
  `;

  return { awayTotalPts, homeTotalPts };
}

function renderPitchingSection(awayMeta, homeMeta) {
  const awayPitching = state.pitchingByTeam[awayMeta.abbr];
  const homePitching = state.pitchingByTeam[homeMeta.abbr];

  state.lastPitchingResult = renderCollectiveTable({
    metrics: PITCHING_METRICS,
    awayStatsObj: awayPitching,
    homeStatsObj: homePitching,
    tbodyId: 'pitchingTableBody',
    resultBoxId: 'pitchingResultBox',
    sectionTitle: 'Pitcheo Colectivo',
    awayMeta,
    homeMeta
  });
}

function renderBattingSection(awayMeta, homeMeta) {
  const awayBatting = state.battingByTeam[awayMeta.abbr];
  const homeBatting = state.battingByTeam[homeMeta.abbr];

  state.lastBattingResult = renderCollectiveTable({
    metrics: BATTING_METRICS,
    awayStatsObj: awayBatting,
    homeStatsObj: homeBatting,
    tbodyId: 'battingTableBody',
    resultBoxId: 'battingResultBox',
    sectionTitle: 'Bateo Colectivo',
    awayMeta,
    homeMeta
  });
}

function renderGlobalSummary() {
  const container = document.getElementById('globalSummaryContent');
  if (!container || !state.lastPitchingResult || !state.lastBattingResult) return;

  const awayMeta = getTeamMeta(state.awayAbbr);
  const homeMeta = getTeamMeta(state.homeAbbr);

  const pitchAway = state.lastPitchingResult.awayTotalPts;
  const pitchHome = state.lastPitchingResult.homeTotalPts;

  const batAway = state.lastBattingResult.awayTotalPts;
  const batHome = state.lastBattingResult.homeTotalPts;

  const totalAway = pitchAway + batAway;
  const totalHome = pitchHome + batHome;

  const starter = state.lastStarterResult || { awayWins: 0, homeWins: 0, comparedCount: 0 };
  const awayPitcherName = document.getElementById('awayPitcherName')?.value || awayMeta.shortName;
  const homePitcherName = document.getElementById('homePitcherName')?.value || homeMeta.shortName;

  let starterWinnerText = 'Pendiente de ingresar datos';
  if (starter.comparedCount > 0) {
    if (starter.awayWins > starter.homeWins) starterWinnerText = `Gana ${awayMeta.shortName} (${awayPitcherName})`;
    else if (starter.homeWins > starter.awayWins) starterWinnerText = `Gana ${homeMeta.shortName} (${homePitcherName})`;
    else starterWinnerText = 'Empate en estadísticas';
  }

  const pitchWinnerText = pitchAway > pitchHome
    ? `Gana ${awayMeta.shortName} (+${formatPoints(pitchAway - pitchHome)} pts)`
    : pitchHome > pitchAway
      ? `Gana ${homeMeta.shortName} (+${formatPoints(pitchHome - pitchAway)} pts)`
      : 'Empate exacto (50 - 50)';

  const batWinnerText = batAway > batHome
    ? `Gana ${awayMeta.shortName} (+${formatPoints(batAway - batHome)} pts)`
    : batHome > batAway
      ? `Gana ${homeMeta.shortName} (+${formatPoints(batHome - batAway)} pts)`
      : 'Empate exacto (50 - 50)';

  const totalWinnerText = totalAway > totalHome
    ? `Favorito Colectivo: ${awayMeta.name}`
    : totalHome > totalAway
      ? `Favorito Colectivo: ${homeMeta.name}`
      : 'Empate en Total Colectivo (100 - 100)';

  container.innerHTML = `
    <div class="summary-box">
      <div class="summary-box-title">1. Abridor (Categorías Ganadas)</div>
      <div class="summary-box-Numbers">
        <span>${awayMeta.shortName}: ${starter.awayWins}</span>
        <span>${homeMeta.shortName}: ${starter.homeWins}</span>
      </div>
      <div class="summary-box-winner">${starterWinnerText}</div>
    </div>

    <div class="summary-box">
      <div class="summary-box-title">2. Pitcheo Colectivo (100 Pts)</div>
      <div class="summary-box-Numbers">
        <span>${awayMeta.shortName}: ${formatPoints(pitchAway)} pts</span>
        <span>${homeMeta.shortName}: ${formatPoints(pitchHome)} pts</span>
      </div>
      <div class="summary-box-winner">${pitchWinnerText}</div>
    </div>

    <div class="summary-box">
      <div class="summary-box-title">3. Bateo Colectivo (100 Pts)</div>
      <div class="summary-box-Numbers">
        <span>${awayMeta.shortName}: ${formatPoints(batAway)} pts</span>
        <span>${homeMeta.shortName}: ${formatPoints(batHome)} pts</span>
      </div>
      <div class="summary-box-winner">${batWinnerText}</div>
    </div>

    <div class="summary-box highlight-total">
      <div class="summary-box-title">Suma Colectiva (Pitcheo + Bateo = 200 Pts)</div>
      <div class="summary-box-Numbers">
        <span>${awayMeta.shortName}: ${formatPoints(totalAway)} pts</span>
        <span>${homeMeta.shortName}: ${formatPoints(totalHome)} pts</span>
      </div>
      <div class="summary-box-winner">${totalWinnerText}</div>
    </div>
  `;
}
