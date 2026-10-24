/* Darts Score Tracker - static, localStorage only. No build step. */
"use strict";

/* ---------- Board geometry (true proportions, double outer radius = 200 units) ---------- */
const NUM_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const CX = 220, CY = 220;
const R = { bull: 7.5, bull25: 18.7, trIn: 114.1, trOut: 125.9, dbIn: 190.6, dbOut: 200, num: 210 };
/* Forgiving tap zones: thin bands get wider effective targets than drawn. */
const TAP = { bull: 10, bull25: 22, trIn: 108, trOut: 132, dbIn: 184, dbOut: 206 };

function polar(r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}
function sectorPath(r1, r2, a0, a1) {
  const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r2, a0);
  const [x2, y2] = polar(r2, a1), [x3, y3] = polar(r1, a1);
  return `M ${x0} ${y0} L ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x0} ${y0} Z`;
}

function buildBoard() {
  const svg = document.getElementById("board");
  let s = `<circle cx="${CX}" cy="${CY}" r="220" fill="#0a0a0a"/>`;
  for (let i = 0; i < 20; i++) {
    const num = NUM_ORDER[i];
    const a0 = i * 18 - 9, a1 = i * 18 + 9;
    const single = i % 2 === 0 ? "#151515" : "#e8dcc0";
    const band = i % 2 === 0 ? "#d42b2b" : "#1d8a3c";
    s += `<path class="wedge" data-num="${num}" data-ring="single" d="${sectorPath(R.bull25, R.trIn, a0, a1)}" fill="${single}"/>`;
    s += `<path class="wedge" data-num="${num}" data-ring="treble" d="${sectorPath(R.trIn, R.trOut, a0, a1)}" fill="${band}"/>`;
    s += `<path class="wedge" data-num="${num}" data-ring="single" d="${sectorPath(R.trOut, R.dbIn, a0, a1)}" fill="${single}"/>`;
    s += `<path class="wedge" data-num="${num}" data-ring="double" d="${sectorPath(R.dbIn, R.dbOut, a0, a1)}" fill="${band}"/>`;
    const [tx, ty] = polar(R.num, i * 18);
    s += `<text x="${tx}" y="${ty}" fill="#fff" font-size="21" font-weight="700" text-anchor="middle" dominant-baseline="middle">${num}</text>`;
  }
  s += `<circle cx="${CX}" cy="${CY}" r="${R.bull25}" fill="#1d8a3c"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${R.bull}" fill="#d42b2b"/>`;
  // wires
  [R.bull25, R.trIn, R.trOut, R.dbIn, R.dbOut].forEach(r => {
    s += `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#999" stroke-width="1" opacity="0.6"/>`;
  });
  for (let i = 0; i < 20; i++) {
    const [x0, y0] = polar(R.bull25, i * 18 - 9), [x1, y1] = polar(R.dbOut, i * 18 - 9);
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#999" stroke-width="1" opacity="0.6"/>`;
  }
  s += `<g id="markers"></g>`;
  svg.innerHTML = s;
  svg.addEventListener("click", onBoardClick);
}

/* Convert a click to a scored dart. Returns {number, mult, value, label, miss, x, y}. */
function hitFromPoint(vx, vy) {
  const dx = vx - CX, dy = vy - CY;
  const r = Math.hypot(dx, dy);
  if (r <= TAP.bull) return { number: 25, mult: 2, value: 50, label: "Bull", miss: false, x: vx, y: vy };
  if (r <= TAP.bull25) return { number: 25, mult: 1, value: 25, label: "25", miss: false, x: vx, y: vy };
  const ang = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const idx = Math.floor((ang + 9) / 18) % 20;
  const num = NUM_ORDER[idx];
  if (r <= TAP.trIn) return { number: num, mult: 1, value: num, label: String(num), miss: false, x: vx, y: vy };
  if (r <= TAP.trOut) return { number: num, mult: 3, value: num * 3, label: "T" + num, miss: false, x: vx, y: vy };
  if (r <= TAP.dbIn) return { number: num, mult: 1, value: num, label: String(num), miss: false, x: vx, y: vy };
  if (r <= TAP.dbOut) return { number: num, mult: 2, value: num * 2, label: "D" + num, miss: false, x: vx, y: vy };
  return { number: 0, mult: 0, value: 0, label: "Miss", miss: true, x: vx, y: vy };
}

function onBoardClick(ev) {
  const svg = document.getElementById("board");
  const rect = svg.getBoundingClientRect();
  const vx = (ev.clientX - rect.left) * 440 / rect.width;
  const vy = (ev.clientY - rect.top) * 440 / rect.height;
  throwDart(hitFromPoint(vx, vy));
}

function parseTyped(text) {
  const t = text.trim().toUpperCase();
  if (t === "MISS" || t === "0" || t === "X") return { number: 0, mult: 0, value: 0, label: "Miss", miss: true };
  if (t === "BULL" || t === "50") return { number: 25, mult: 2, value: 50, label: "Bull", miss: false };
  if (t === "25") return { number: 25, mult: 1, value: 25, label: "25", miss: false };
  const m = t.match(/^([TDS]?)(\d{1,2})$/);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (n < 1 || n > 20) return null;
  if (m[1] === "T") return { number: n, mult: 3, value: n * 3, label: "T" + n, miss: false };
  if (m[1] === "D") return { number: n, mult: 2, value: n * 2, label: "D" + n, miss: false };
  return { number: n, mult: 1, value: n, label: String(n), miss: false };
}

/* ---------- Checkout suggestions (X01, double out) ---------- */
function dartOptions() {
  const opts = [];
  for (let n = 20; n >= 1; n--) opts.push({ label: "T" + n, value: n * 3, dbl: false });
  for (let n = 20; n >= 1; n--) opts.push({ label: "D" + n, value: n * 2, dbl: true });
  for (let n = 20; n >= 1; n--) opts.push({ label: "S" + n, value: n, dbl: false });
  opts.push({ label: "Bull", value: 50, dbl: true });
  opts.push({ label: "25", value: 25, dbl: false });
  return opts;
}
function checkout(n) {
  if (n <= 0 || n > 170) return "";
  const opts = dartOptions();
  const doubles = opts.filter(o => o.dbl);
  for (const d of doubles) if (d.value === n) return d.label;
  for (const a of opts) for (const d of doubles) if (a.value + d.value === n) return a.label + " · " + d.label;
  for (const a of opts) for (const b of opts) for (const d of doubles)
    if (a.value + b.value + d.value === n) return a.label + " · " + b.label + " · " + d.label;
  return "";
}

/* ---------- Game definitions ---------- */
const GAMES = {
  "501": { name: "501", tag: "Countdown from 501, finish on a double", x01: 501, legs: true },
  "301": { name: "301", tag: "Countdown from 301, finish on a double", x01: 301, legs: true },
  "701": { name: "701", tag: "Countdown from 701, finish on a double", x01: 701, legs: true },
  "cricket": { name: "Cricket", tag: "Close 20-15 + Bull, score on closed numbers", legs: true },
  "cricket-ns": { name: "Cricket (no score)", tag: "First to close 20-15 + Bull wins", legs: true },
  "clock": { name: "Around the Clock", tag: "Hit 1 to 20 in order, then the Bull. Doubles skip 2, trebles skip 3." },
  "killer": { name: "Killer", tag: "Claim a number, double it to become Killer, take lives with opponents' doubles. 3 lives each." },
  "shanghai": { name: "Shanghai", tag: "Rounds 1-7. Score on the round's number. Single + double + treble in one turn = instant win." },
  "golf": { name: "Golf", tag: "18 holes, numbers 1-18. Fewest strokes wins. Miss all 3 darts = 5 strokes." },
  "halveit": { name: "Halve-It", tag: "20, 16, D7, 14, T10, 17, Bull. Score nothing in a round and your total halves." },
  "baseball": { name: "Baseball", tag: "9 innings, numbers 1-9. Runs = hits x multiplier. Most runs wins." },
};
const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
const HALVE_TARGETS = [
  { n: 20, ring: "any" }, { n: 16, ring: "any" }, { n: 7, ring: "double" },
  { n: 14, ring: "any" }, { n: 10, ring: "treble" }, { n: 17, ring: "any" }, { n: 25, ring: "any" },
];

/* ---------- State & storage ---------- */
let S = null;           // current match state
let undoStack = [];
let selectedGame = "501";

function loadStats() {
  try { return JSON.parse(localStorage.getItem("dartsStats") || '{"players":{},"results":[]}'); }
  catch (e) { return { players: {}, results: [] }; }
}
function saveStats(st) { localStorage.setItem("dartsStats", JSON.stringify(st)); }
function saveMatch() { if (S) localStorage.setItem("dartsGame", JSON.stringify(S)); else localStorage.removeItem("dartsGame"); }
function loadMatch() {
  try { return JSON.parse(localStorage.getItem("dartsGame") || "null"); }
  catch (e) { return null; }
}
function playerKey(name) { return name.trim().toLowerCase(); }

function newPlayer(name) {
  return {
    name, darts: 0, x01Points: 0, bestVisit: 0,
    remaining: 0, turnStart: 0, legs: 0,
    marks: {}, points: 0,
    next: 1, number: null, lives: 3, killer: false,
    score: 0, total: 0, runs: 0, roundScore: 0,
    hole: 1, holeDarts: 0, holeDone: false,
    turnHits: [], turnScore: 0, turnStartScore: 0,
  };
}

function newMatch(game, names, legsToWin) {
  const players = names.map(newPlayer);
  S = {
    game, legsToWin, leg: 1, round: 1, phase: game === "killer" ? "claim" : "play",
    turn: 0, dartsLeft: 3, turnDarts: [], winner: null, winnerDetail: "",
    players, matchDarts: {}, startedBy: 0,
  };
  players.forEach(p => { S.matchDarts[playerKey(p.name)] = 0; });
  if (GAMES[game].x01) players.forEach(p => { p.remaining = GAMES[game].x01; p.turnStart = p.remaining; });
  if (game === "cricket" || game === "cricket-ns")
    players.forEach(p => { CRICKET_TARGETS.forEach(t => p.marks[t] = 0); });
  undoStack = [];
  saveMatch();
}

function snapshot() {
  undoStack.push(JSON.stringify(S));
  if (undoStack.length > 300) undoStack.shift();
}
function undo() {
  if (!undoStack.length) return;
  S = JSON.parse(undoStack.pop());
  S._turnEnded = false;
  hideWinner();
  saveMatch();
  render();
}

/* ---------- Core throw flow ---------- */
function throwDart(hit) {
  if (!S || S.winner) return;
  snapshot();
  const p = S.players[S.turn];
  S.turnDarts.push(hit);
  p.darts++;
  S.matchDarts[playerKey(p.name)] = (S.matchDarts[playerKey(p.name)] || 0) + 1;
  p.turnScore += hit.value;
  if (S.game === "killer" && S.phase === "claim") { handleClaim(hit); saveMatch(); render(); return; }

  const g = S.game;
  if (GAMES[g].x01) handleX01(hit);
  else if (g === "cricket" || g === "cricket-ns") handleCricket(hit);
  else if (g === "clock") handleClock(hit);
  else if (g === "killer") handleKiller(hit);
  else if (g === "shanghai") handleShanghai(hit);
  else if (g === "golf") handleGolf(hit);
  else if (g === "halveit") handleHalveIt(hit);
  else if (g === "baseball") handleBaseball(hit);

  if (!S.winner && S._turnEnded) { S._turnEnded = false; }
  else if (!S.winner && S.game === "golf" && S.players[S.turn].holeDone) { endTurn(); }
  else if (!S.winner) {
    S.dartsLeft--;
    if (S.dartsLeft <= 0) endTurn();
  }
  if (S.winner) finishMatch();
  S._turnEnded = false;
  saveMatch();
  render();
}

function endTurn() {
  S._turnEnded = true;
  const p = S.players[S.turn];
  // best visit (X01): total of the 3 darts just thrown
  if (GAMES[S.game].x01) p.bestVisit = Math.max(p.bestVisit, p.turnScore);
  p.turnScore = 0; p.turnHits = []; p.roundScore = 0;
  S.turnDarts = []; S.dartsLeft = 3;
  const prev = S.turn;
  S.turn = (S.turn + 1) % S.players.length;
  // round-based games: a full rotation ends the round
  if (["shanghai", "halveit", "baseball"].includes(S.game) && S.turn === 0) {
    S.round++;
    if (S.game === "shanghai" && S.round > 7) finishByScore("score", true);
    if (S.game === "halveit" && S.round > 7) finishByScore("total", true);
    if (S.game === "baseball" && S.round > 9) finishByScore("runs", true);
  }
  if (S.game === "golf" && S.turn === 0) {
    S.players.forEach(q => { q.holeDone = false; q.holeDarts = 0; });
    S.round++;
    if (S.round > 18) finishByScore("total", false);
    else S.players.forEach(q => q.hole = S.round);
  }
  if (S.game === "killer" && S.phase === "play") {
    // skip eliminated players
    let guard = 0;
    while (S.players[S.turn].lives <= 0 && guard++ < 10) S.turn = (S.turn + 1) % S.players.length;
  }
  void prev;
}

function finishByScore(field, highWins) {
  const sorted = [...S.players].sort((a, b) => highWins ? b[field] - a[field] : a[field] - b[field]);
  const best = sorted[0][field];
  const winners = sorted.filter(p => p[field] === best);
  if (winners.length === 1) {
    S.winner = winners[0].name;
    S.winnerDetail = `${GAMES[S.game].name} - final: ${S.players.map(p => `${p.name} ${p[field]}`).join(" · ")}`;
  } else {
    S.winner = "Tie";
    S.winnerDetail = `${GAMES[S.game].name} - tied at ${best}: ${winners.map(p => p.name).join(", ")}`;
  }
  finishMatch();
}

function finishMatch() {
  if (!S.winner || S._statsSaved) return;
  S._statsSaved = true;
  const st = loadStats();
  S.players.forEach(p => {
    const k = playerKey(p.name);
    const rec = st.players[k] || { name: p.name, wins: 0, matches: 0, darts: 0, x01Points: 0, bestVisit: 0 };
    rec.matches++;
    rec.darts += S.matchDarts[k] || 0;
    rec.x01Points += p.x01Points || 0;
    rec.bestVisit = Math.max(rec.bestVisit, p.bestVisit || 0);
    if (S.winner === p.name) rec.wins++;
    st.players[k] = rec;
  });
  st.results.unshift({ game: GAMES[S.game].name, winner: S.winner, players: S.players.map(p => p.name), date: new Date().toISOString().slice(0, 10) });
  st.results = st.results.slice(0, 30);
  saveStats(st);
  saveMatch();
}

/* ---------- Per-game rules ---------- */
function handleX01(hit) {
  const p = S.players[S.turn];
  p.remaining -= hit.value;
  p.x01Points += hit.value;
  const isDouble = hit.mult === 2;
  if (p.remaining === 0 && isDouble) { winLeg(p); return; }
  if (p.remaining < 0 || p.remaining === 1 || (p.remaining === 0 && !isDouble)) {
    // bust: whole turn voided
    p.remaining = p.turnStart;
    p.x01Points -= p.turnScore;
    p.turnScore = 0;
    S.turnDarts = [];
    endTurn();
    S.dartsLeft = 3;
  }
}
function winLeg(p) {
  p.legs++;
  if (p.legs >= S.legsToWin) {
    S.winner = p.name;
    S.winnerDetail = `${GAMES[S.game].name} - ${p.legs} leg${p.legs > 1 ? "s" : ""} to ${S.players.filter(q => q !== p).map(q => q.legs).join(", ")}`;
  } else {
    S.leg++;
    S.players.forEach(q => { q.remaining = GAMES[S.game].x01; q.turnStart = q.remaining; });
    S.turnDarts = []; S.dartsLeft = 3;
    S.turn = (S.startedBy + S.leg - 1) % S.players.length;
    S.startedBy = S.turn;
  }
}

function cricketClosed(p, t) { return p.marks[t] >= 3; }
function handleCricket(hit) {
  const p = S.players[S.turn];
  if (hit.miss || !CRICKET_TARGETS.includes(hit.number)) return;
  const t = hit.number;
  const before = p.marks[t];
  p.marks[t] = Math.min(3, before + hit.mult);
  if (S.game === "cricket" && before + hit.mult > 3) {
    const excess = before + hit.mult - 3;
    const open = S.players.some(q => q !== p && !cricketClosed(q, t));
    if (open) p.points += excess * t;
  }
  const allClosed = CRICKET_TARGETS.every(x => cricketClosed(p, x));
  if (allClosed) {
    if (S.game === "cricket-ns") { winCricketLeg(p); return; }
    const leads = S.players.every(q => q === p || p.points >= q.points);
    if (leads) winCricketLeg(p);
  }
}
function winCricketLeg(p) {
  p.legs++;
  if (p.legs >= S.legsToWin) {
    S.winner = p.name;
    S.winnerDetail = `Cricket - ${p.legs} leg${p.legs > 1 ? "s" : ""}`;
  } else {
    S.leg++;
    S.players.forEach(q => { CRICKET_TARGETS.forEach(t => q.marks[t] = 0); q.points = 0; });
    S.turnDarts = []; S.dartsLeft = 3;
    S.turn = (S.startedBy + S.leg - 1) % S.players.length;
    S.startedBy = S.turn;
  }
}

function handleClock(hit) {
  const p = S.players[S.turn];
  if (hit.miss) return;
  if (p.next === 25) {
    if (hit.number === 25) { S.winner = p.name; S.winnerDetail = "Around the Clock - finished on the Bull"; }
    return;
  }
  if (hit.number === p.next) {
    p.next += hit.mult;
    if (p.next > 20) p.next = 25;
  }
}

function handleClaim(hit) {
  const p = S.players[S.turn];
  if (hit.miss || hit.number === 25) return; // throw again
  if (S.players.some(q => q.number === hit.number)) return; // taken, throw again
  p.number = hit.number;
  S.turnDarts = []; S.dartsLeft = 3;
  const next = S.players.findIndex(q => q.number === null);
  if (next === -1) {
    S.phase = "play";
    S.players.forEach(q => { q.lives = 3; q.killer = false; });
    S.turn = 0;
  } else {
    S.turn = next;
  }
}
function handleKiller(hit) {
  const p = S.players[S.turn];
  if (hit.miss || hit.mult !== 2 || hit.number === 25) return;
  if (!p.killer && hit.number === p.number) { p.killer = true; return; }
  if (p.killer) {
    const victim = S.players.find(q => q !== p && q.number === hit.number && q.lives > 0);
    if (victim) {
      victim.lives--;
      if (victim.lives <= 0) {
        const alive = S.players.filter(q => q.lives > 0);
        if (alive.length === 1) { S.winner = alive[0].name; S.winnerDetail = "Killer - last player standing"; }
      }
    }
  }
}

function handleShanghai(hit) {
  const p = S.players[S.turn];
  if (!hit.miss && hit.number === S.round) {
    p.score += hit.value;
    p.turnHits.push(hit.mult);
    const has = m => p.turnHits.includes(m);
    if (has(1) && has(2) && has(3)) {
      S.winner = p.name;
      S.winnerDetail = `Shanghai! Single + double + treble ${S.round} in one turn`;
    }
  }
}

function handleGolf(hit) {
  const p = S.players[S.turn];
  p.holeDarts++;
  if (!hit.miss && hit.number === p.hole) {
    p.total += p.holeDarts;
    p.holeDone = true; p.holeDarts = 0;
  } else if (p.holeDarts >= 3) {
    p.total += 5;
    p.holeDone = true; p.holeDarts = 0;
  }
}

function handleHalveIt(hit) {
  const p = S.players[S.turn];
  const t = HALVE_TARGETS[S.round - 1];
  if (!t) return;
  if (!hit.miss && hit.number === t.n) {
    if (t.ring === "any") p.roundScore += hit.value;
    else if (t.ring === "double" && hit.mult === 2) p.roundScore += hit.value;
    else if (t.ring === "treble" && hit.mult === 3) p.roundScore += hit.value;
  }
  // apply round score at end of turn
  if (S.dartsLeft === 1) {
    if (p.roundScore === 0) p.total = Math.floor(p.total / 2);
    else p.total += p.roundScore;
  }
}

function handleBaseball(hit) {
  const p = S.players[S.turn];
  if (!hit.miss && hit.number === S.round) p.runs += hit.mult;
}

/* ---------- Rendering ---------- */
const PLAYER_COLORS = ["#ffc845", "#4da6ff", "#ff6fa5", "#7dd87d", "#c792ff", "#ff8c42", "#4dd0c4", "#e8e8e8"];
const $ = id => document.getElementById(id);

function showView(which) {
  $("lobby").hidden = which !== "lobby";
  $("gameView").hidden = which !== "game";
  if (which === "lobby") { document.getElementById("gameView").classList.remove("fs"); syncFsButtons(); }
}
function syncFsButtons() {
  const fs = $("gameView").classList.contains("fs");
  $("btnFullscreen").textContent = fs ? "Exit full screen" : "Full screen";
  $("btnFullscreenTop").textContent = fs ? "Exit full screen" : "Full screen";
  $("fsControls").hidden = !fs;
}
function toggleFullscreen() {
  if ($("gameView").hidden) return;
  $("gameView").classList.toggle("fs");
  syncFsButtons();
  renderFsScore();
}
function renderFsScore() {
  const el = $("fsScore");
  if (!$("gameView").classList.contains("fs") || !S) { el.hidden = true; return; }
  el.hidden = false;
  const p = S.players[S.turn];
  el.textContent = `${p.name} to throw · ${scoreLine(p)}`;
}
function scoreLine(p) {
  const g = S.game;
  if (GAMES[g].x01) return `${p.remaining} left`;
  if (g === "cricket") return `${p.points} pts · ${CRICKET_TARGETS.filter(t => cricketClosed(p, t)).length}/7 closed`;
  if (g === "cricket-ns") return `${CRICKET_TARGETS.filter(t => cricketClosed(p, t)).length}/7 closed`;
  if (g === "clock") return p.next === 25 ? "Aim: Bull" : `Aim: ${p.next}`;
  if (g === "killer") return S.phase === "claim" ? "Claim a number" : (p.number ? `No. ${p.number} · ${p.lives} lives${p.killer ? " · KILLER" : ""}` : "No number");
  if (g === "shanghai") return `${p.score} pts · Round ${S.round}/7`;
  if (g === "golf") return `${p.total} strokes · Hole ${p.hole}/18`;
  if (g === "halveit") return `${p.total} pts · Round ${S.round}/7`;
  if (g === "baseball") return `${p.runs} runs · Inning ${S.round}/9`;
  return "";
}

function render() {
  if (!S) { renderLobby(); return; }
  renderScoreboard();
  renderTurnInfo();
  renderHint();
  renderExtra();
  renderMarkers();
  renderFsScore();
  if (S.winner) showWinner();
}
function renderScoreboard() {
  const sb = $("scoreboard");
  sb.innerHTML = S.players.map((p, i) => {
    const big = scoreBig(p);
    return `<div class="player-card ${i === S.turn && !S.winner ? "active" : ""}">
      <div class="pname">${escapeHtml(p.name)}</div>
      <div class="pscore">${big}</div>
      <div class="psub">${escapeHtml(scoreLine(p))}</div>
    </div>`;
  }).join("");
}
function scoreBig(p) {
  const g = S.game;
  if (GAMES[g].x01) return p.remaining;
  if (g === "cricket") return p.points;
  if (g === "cricket-ns") return CRICKET_TARGETS.filter(t => cricketClosed(p, t)).length + "/7";
  if (g === "clock") return p.next === 25 ? "Bull" : p.next;
  if (g === "killer") return p.number === null ? "?" : p.number;
  if (g === "shanghai") return p.score;
  if (g === "golf") return p.total;
  if (g === "halveit") return p.total;
  if (g === "baseball") return p.runs;
  return "";
}
function renderTurnInfo() {
  const p = S.players[S.turn];
  const dots = [0, 1, 2].map(i => {
    const d = S.turnDarts[i];
    return `<span class="dart-dot ${d ? "hit" : ""}">${d ? escapeHtml(d.label) : ""}</span>`;
  }).join("");
  $("turnInfo").innerHTML = S.winner
    ? `${escapeHtml(S.winner)} wins!`
    : `${escapeHtml(p.name)} to throw ${dots}`;
}
function renderHint() {
  let h = "";
  const p = S.players[S.turn];
  if (S.winner) h = "";
  else if (GAMES[S.game].x01) {
    const c = p.remaining > 1 ? checkout(p.remaining) : "";
    h = c ? `Finish: ${c}` : (p.remaining === 1 ? "Busted on 1 - you cannot finish" : "");
    if (S.dartsLeft < 3 && p.turnScore > 0) h = `This turn: ${p.turnScore} · ` + h;
  }
  else if (S.game === "clock") h = p.next === 25 ? "Aim at the Bull to win" : `Aim at ${p.next} (double skips 2, treble skips 3)`;
  else if (S.game === "killer") h = S.phase === "claim" ? `${p.name}, throw to claim your number` : (p.killer ? `${p.name} is a KILLER - hit an opponent's double` : `${p.name}, double your ${p.number} to become Killer`);
  else if (S.game === "shanghai") h = `Round ${S.round}: aim at ${S.round}. Single + double + treble = Shanghai win!`;
  else if (S.game === "golf") h = `Hole ${p.hole}: aim at ${p.hole}`;
  else if (S.game === "halveit") {
    const t = HALVE_TARGETS[S.round - 1];
    h = t ? `Round ${S.round}: aim at ${t.ring === "any" ? t.n : (t.ring === "double" ? "Double " + t.n : "Treble " + t.n)} - blank the round and your total halves` : "";
  }
  else if (S.game === "baseball") h = `Inning ${S.round}: aim at ${S.round}`;
  $("hint").textContent = h;
}
function renderExtra() {
  const el = $("extraPanel");
  if (S.game === "cricket" || S.game === "cricket-ns") {
    const mark = m => m === 0 ? "·" : m === 1 ? "╱" : m === 2 ? "✕" : "⊗";
    let html = `<table class="cricket-table"><tr><th></th>${S.players.map(p => `<th>${escapeHtml(p.name)}</th>`).join("")}</tr>`;
    CRICKET_TARGETS.forEach(t => {
      html += `<tr><td><b>${t === 25 ? "Bull" : t}</b></td>${S.players.map(p => `<td>${mark(p.marks[t])}</td>`).join("")}</tr>`;
    });
    html += `<tr><td>Points</td>${S.players.map(p => `<td>${p.points}</td>`).join("")}</tr></table>`;
    el.innerHTML = html;
  } else if (S.game === "killer") {
    el.innerHTML = S.players.map(p =>
      `<div>${escapeHtml(p.name)}: ${p.number === null ? "no number yet" : "No. " + p.number} · ${"♥".repeat(Math.max(0, p.lives))}${p.killer ? " · <b>KILLER</b>" : ""}</div>`
    ).join("");
  } else {
    el.innerHTML = "";
  }
}
function renderMarkers() {
  const g = document.getElementById("markers");
  if (!g) return;
  const col = PLAYER_COLORS[S.turn % PLAYER_COLORS.length];
  g.innerHTML = S.turnDarts.map(d => {
    const fill = d.miss ? "#888" : col;
    const x = Math.max(4, Math.min(436, d.x || CX));
    const y = Math.max(4, Math.min(436, d.y || CY));
    return `<circle cx="${x}" cy="${y}" r="9" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
  }).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Lobby & stats ---------- */
function renderLobby() {
  const grid = $("gameGrid");
  grid.innerHTML = Object.entries(GAMES).map(([key, g]) =>
    `<button class="btn ${key === selectedGame ? "selected" : ""}" data-game="${key}">${g.name}</button>`
  ).join("");
  grid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    selectedGame = b.dataset.game;
    renderLobby();
  }));
  $("gameDesc").textContent = GAMES[selectedGame].tag;
  $("legsWrap").style.display = GAMES[selectedGame].legs ? "" : "none";
  renderNameInputs();
  const saved = loadMatch();
  $("btnResume").hidden = !(saved && !saved.winner);
  renderStatsBox();
}
function renderNameInputs() {
  const n = parseInt($("playerCount").value, 10);
  const wrap = $("nameInputs");
  const existing = [...wrap.querySelectorAll("input")].map(i => i.value);
  wrap.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = `Player ${i + 1}`;
    inp.value = existing[i] || "";
    inp.maxLength = 20;
    wrap.appendChild(inp);
  }
}
function renderStatsBox() {
  const st = loadStats();
  const box = $("statsBox");
  const names = Object.values(st.players);
  if (!names.length && !st.results.length) {
    box.innerHTML = `<p class="muted">No games played yet on this device.</p>`;
    return;
  }
  let html = "";
  if (names.length) {
    html += `<table class="cricket-table"><tr><th>Player</th><th>W</th><th>Played</th><th>3-dart avg</th><th>Best visit</th></tr>`;
    names.sort((a, b) => b.wins - a.wins).forEach(p => {
      const avg = p.darts > 0 ? (p.x01Points / p.darts * 3).toFixed(1) : "-";
      html += `<tr><td>${escapeHtml(p.name)}</td><td>${p.wins}</td><td>${p.matches}</td><td>${avg}</td><td>${p.bestVisit || "-"}</td></tr>`;
    });
    html += `</table>`;
  }
  if (st.results.length) {
    html += `<p style="margin:12px 0 4px"><b>Recent results</b></p>`;
    html += st.results.slice(0, 10).map(r =>
      `<div>${r.date} · ${escapeHtml(r.game)} · ${escapeHtml(r.winner)} beat ${r.players.filter(x => x !== r.winner).map(escapeHtml).join(", ") || "the field"}</div>`
    ).join("");
  }
  box.innerHTML = html;
}

/* ---------- Winner overlay ---------- */
function showWinner() {
  $("winnerText").textContent = S.winner === "Tie" ? "It's a tie!" : `${S.winner} wins!`;
  $("winnerDetail").textContent = S.winnerDetail || "";
  $("winnerOverlay").hidden = false;
}
function hideWinner() { $("winnerOverlay").hidden = true; }

/* ---------- Events ---------- */
function startFromLobby() {
  const names = [...$("nameInputs").querySelectorAll("input")].map((inp, i) => inp.value.trim() || `Player ${i + 1}`);
  const legs = parseInt($("legsSelect").value, 10);
  newMatch(selectedGame, names, legs);
  showView("game");
  render();
}
function backToLobby() {
  S = null; saveMatch(); hideWinner();
  showView("lobby"); renderLobby();
}
function init() {
  buildBoard();
  $("playerCount").addEventListener("change", renderNameInputs);
  $("gameGrid").addEventListener("click", () => {});
  $("btnStart").addEventListener("click", startFromLobby);
  $("btnResume").addEventListener("click", () => {
    const saved = loadMatch();
    if (!saved) return;
    S = saved; undoStack = [];
    showView("game"); render();
  });
  $("btnMiss").addEventListener("click", () => throwDart({ number: 0, mult: 0, value: 0, label: "Miss", miss: true }));
  $("btnMissFs").addEventListener("click", () => throwDart({ number: 0, mult: 0, value: 0, label: "Miss", miss: true }));
  $("btnUndo").addEventListener("click", undo);
  $("btnUndoFs").addEventListener("click", undo);
  $("btnFullscreen").addEventListener("click", toggleFullscreen);
  $("btnFullscreenTop").addEventListener("click", toggleFullscreen);
  $("btnExitFs").addEventListener("click", toggleFullscreen);
  $("btnQuit").addEventListener("click", () => { if (confirm("End this game without a winner?")) backToLobby(); });
  $("btnStats").addEventListener("click", () => { showView("lobby"); renderStatsBox(); document.getElementById("statsBox").scrollIntoView(); });
  $("btnClearStats").addEventListener("click", () => {
    if (confirm("Clear all saved stats and results on this device?")) { localStorage.removeItem("dartsStats"); renderStatsBox(); }
  });
  $("btnTyped").addEventListener("click", submitTyped);
  $("typedInput").addEventListener("keydown", e => { if (e.key === "Enter") submitTyped(); });
  $("btnRematch").addEventListener("click", () => {
    const names = S.players.map(p => p.name);
    const game = S.game, legs = S.legsToWin;
    hideWinner();
    newMatch(game, names, legs);
    showView("game"); render();
  });
  $("btnNewGame").addEventListener("click", backToLobby);
  showView("lobby");
  renderLobby();
  // QA hook (read-only state access for automated checks)
  window.__darts = { getState: () => S, hitFromPoint, checkout, parseTyped };
}
function submitTyped() {
  const hit = parseTyped($("typedInput").value);
  if (!hit) { $("typedInput").select(); return; }
  $("typedInput").value = "";
  throwDart(hit);
}
document.addEventListener("DOMContentLoaded", init);
