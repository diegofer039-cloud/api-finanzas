/* ============================================
   FINANZAS — App
   API URL (cambiar en producción)
   ============================================ */
const API = '';

/* ============================================
   DOM REFS
   ============================================ */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

/* ============================================
   STATE
   ============================================ */
let state = {
    transactions: [],
    budgets: [],
    goals: [],
    categories: [],
    editingTxId: null,
    viewMode: 'year',
};

/* ============================================
   UTILS
   ============================================ */
function fmt(n) {
    return '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }
function parseDate(d) { return d ? new Date(d + 'T00:00:00') : new Date(); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function animateValue(el, from, to, suffix, duration) {
    suffix = suffix || '';
    duration = duration || 600;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const v = Math.round(from + (to - from) * ease(p));
        el.textContent = suffix + v.toLocaleString('es-CO');
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

/* ============================================
    SIDEBAR NAV
    ============================================ */
let currentTab = 'dashboard';

function switchTab(tab) {
    if (tab === currentTab) return;
    const tabs = ['dashboard', 'budgets', 'categories', 'goals'];
    const idx = tabs.indexOf(tab);
    const prevIdx = tabs.indexOf(currentTab);
    const dir = idx > prevIdx ? 8 : -8;
    currentTab = tab;

    $$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    const oldEl = $('.tab-content.active');
    if (oldEl) {
        oldEl.style.animation = 'none';
        oldEl.classList.remove('active');
    }

    const newEl = $('#tab-' + tab);
    if (newEl) {
        newEl.classList.add('active');
        newEl.style.animation = 'none';
        void newEl.offsetWidth;
        newEl.style.animation = `fade-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards`;
    }

    if (tab === 'categories') safeRender(renderCategories);
    if (tab === 'goals') safeRender(renderGoals);
    if (tab === 'dashboard') drawChart();
}
$$('.side-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ============================================
   TOGGLE (ingreso/gasto)
   ============================================ */
const toggleBtns = $$('.toggle-btn');
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('#type').value = btn.dataset.value;
    });
});

/* ============================================
   FETCH HELPERS
   ============================================ */
async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const r = await fetch(API + path, opts);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || r.statusText); }
    return r.status === 204 ? null : r.json();
}

/* ============================================
   LOAD DATA
   ============================================ */
async function loadAll() {
    const [txs, budgets, goals, cats] = await Promise.all([
        api('GET', '/transactions/?limit=500'),
        api('GET', '/budgets/'),
        api('GET', '/savings-goals/'),
        api('GET', '/categories/').catch(() => []),
    ]);
    state.transactions = (txs || []).sort((a, b) => b.date.localeCompare(a.date));
    state.budgets = budgets || [];
    state.goals = goals || [];
    state.categories = cats || [];
    renderAll();
}
/* expose for inline onclick */
window.switchTab = switchTab;

/* ============================================
   RENDER ALL
   ============================================ */
function safeRender(fn) { try { fn(); } catch (e) { console.error(e); } }

function renderAll() {
    safeRender(updateChartControls);
    safeRender(renderCatMonthOptions);
    safeRender(renderCategoryDatalist);
    safeRender(renderDashboard);
    safeRender(renderTxList);
    safeRender(renderBudgets);
    safeRender(renderCategories);
    safeRender(renderGoals);
    safeRender(renderGoalPreview);
}

/* ============================================
    DASHBOARD — STATS
    ============================================ */
let prevStats = { balance: null, income: null, expense: null };

function renderDashboard() {
    const year = state.viewMode === 'year'
        ? ($('#chart-range')?.value || String(new Date().getFullYear()))
        : String(new Date().getFullYear());
    const txs = state.transactions.filter(t => t.date && t.date.startsWith(year));
    let ing = 0, gas = 0;
    txs.forEach(t => { if (t.type === 'ingreso') ing += Number(t.amount); else gas += Number(t.amount); });
    const bal = ing - gas;

    const balEl = $('#total-balance');
    const ingEl = $('#total-ingresos');
    const gasEl = $('#total-gastos');

    const isInit = prevStats.balance === null;
    if (!isInit) {
        if (bal !== prevStats.balance) {
            const bFrom = prevStats.balance || 0;
            animateValue(balEl, bFrom, bal, '$');
        }
        if (ing !== prevStats.income) {
            animateValue(ingEl, prevStats.income || 0, ing, '$');
        }
        if (gas !== prevStats.expense) {
            animateValue(gasEl, prevStats.expense || 0, gas, '$');
        }
    } else {
        balEl.textContent = fmt(bal);
        ingEl.textContent = fmt(ing);
        gasEl.textContent = fmt(gas);
    }

    prevStats = { balance: bal, income: ing, expense: gas };

    if (bal >= 0) balEl.style.color = 'var(--green)';
    else balEl.style.color = 'var(--red)';

    drawChart();
}

/* ============================================
   CHART — LINE (animated)
   ============================================ */
let chartAnimId = null;
let chartZoom = { scale: 1 };

function updateChartControls() {
    const sel = $('#chart-range');
    if (!sel) return;
    sel.removeEventListener('change', renderDashboard);
    const dateInput = $('#chart-date');
    const title = $('#chart-title');

    if (state.viewMode === 'year') {
        if (title) title.textContent = 'Evolución anual';
        sel.style.display = '';
        dateInput.style.display = 'none';
        const years = [...new Set(state.transactions.map(t => t.date ? t.date.slice(0, 4) : null).filter(Boolean))].sort();
        const prev = sel.value;
        sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (prev && years.includes(prev)) sel.value = prev;
        else if (years.length) sel.value = years[years.length - 1];
        else sel.value = String(new Date().getFullYear());
    } else if (state.viewMode === 'month') {
        if (title) title.textContent = 'Evolución diaria';
        sel.style.display = '';
        dateInput.style.display = 'none';
        const months = [...new Set(state.transactions.filter(t => t.date).map(t => t.date.slice(0, 7)))].sort();
        const prev = sel.value;
        sel.innerHTML = months.map(m => {
            const [y, mo] = m.split('-');
            const d = new Date(y, mo - 1);
            const label = d.toLocaleDateString('es', { year: 'numeric', month: 'long' });
            return `<option value="${m}">${label}</option>`;
        }).join('');
        if (prev && months.includes(prev)) sel.value = prev;
        else if (months.length) sel.value = months[months.length - 1];
        else sel.value = thisMonth();
    } else if (state.viewMode === 'week') {
        if (title) title.textContent = 'Evolución semanal';
        sel.style.display = 'none';
        dateInput.style.display = '';
        if (!dateInput.value) dateInput.value = today();
    } else if (state.viewMode === 'day') {
        if (title) title.textContent = 'Transacciones del día';
        sel.style.display = 'none';
        dateInput.style.display = '';
        if (!dateInput.value) dateInput.value = today();
    }
    sel.addEventListener('change', renderDashboard);
}

function getMonthlySeries(year) {
    const months = [];
    for (let m = 1; m <= 12; m++) {
        const key = year + '-' + String(m).padStart(2, '0');
        let ing = 0, gas = 0;
        state.transactions.filter(t => t.date && t.date.startsWith(key)).forEach(t => {
            if (t.type === 'ingreso') ing += Number(t.amount); else gas += Number(t.amount);
        });
        months.push({ month: m, ingreso: ing, gasto: gas, balance: ing - gas });
    }
    return months;
}

function getChartData() {
    const mode = state.viewMode || 'year';
    if (mode === 'year') {
        const year = $('#chart-range').value || String(new Date().getFullYear());
        const series = getMonthlySeries(year);
        return {
            values: series.map(s => s.balance),
            volumes: series.map(s => s.ingreso + s.gasto),
            labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
        };
    }
    if (mode === 'month') {
        const monthKey = $('#chart-range').value || thisMonth();
        const [y, m] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const values = [], volumes = [], labels = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const key = monthKey + '-' + String(d).padStart(2, '0');
            let ing = 0, gas = 0;
            state.transactions.filter(t => t.date === key).forEach(t => {
                if (t.type === 'ingreso') ing += Number(t.amount); else gas += Number(t.amount);
            });
            values.push(ing - gas);
            volumes.push(ing + gas);
            labels.push(String(d));
        }
        return { values, volumes, labels };
    }
    if (mode === 'week') {
        const dateKey = $('#chart-date').value || today();
        const endD = new Date(dateKey + 'T00:00:00');
        const startD = new Date(endD);
        startD.setDate(startD.getDate() - 6);
        
        const values = [], volumes = [], labels = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startD);
            d.setDate(d.getDate() + i);
            const dKey = d.toISOString().slice(0, 10);
            
            let ing = 0, gas = 0;
            state.transactions.filter(t => t.date === dKey).forEach(t => {
                if (t.type === 'ingreso') ing += Number(t.amount); else gas += Number(t.amount);
            });
            values.push(ing - gas);
            volumes.push(ing + gas);
            const wDays = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            labels.push(wDays[d.getDay()]);
        }
        return { values, volumes, labels };
    }
    if (mode === 'day') {
        const dateKey = $('#chart-date').value || today();
        const txs = state.transactions
            .filter(t => t.date === dateKey)
            .sort((a, b) => (a.id || 0) - (b.id || 0));
        let running = 0;
        const values = [0], volumes = [0], labels = ['Inicio'];
        txs.forEach(t => {
            const amt = t.type === 'ingreso' ? Number(t.amount) : -Number(t.amount);
            running += amt;
            values.push(running);
            volumes.push(Number(t.amount));
            labels.push(t.description || t.category || 'Tx');
        });
        return { values, volumes, labels };
    }
    return { values: [], volumes: [], labels: [] };
}

/* Catmull-Rom spline — smooth curves through all data points */
function catmullRomSpline(pts, tension) {
    tension = tension || 0.35;
    const path = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        path.push({ p1, cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y }, p2 });
    }
    return path;
}

/* Event listener refs for cleanup */
let _chartMoveHandler = null;
let _chartOutHandler = null;
let _chartWheelHandler = null;
let _chartDrawing = false; /* re-entrant guard */

function drawChart(animate = true) {
    if (chartAnimId) { cancelAnimationFrame(chartAnimId); chartAnimId = null; }
    const canvas = $('#line-chart');
    const empty = $('#chart-empty');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const { values: vals, volumes: vols, labels: monthLabels } = getChartData();
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;
    const maxVol = Math.max(...vols, 1);

    if (vals.every(v => v === 0) || vals.length < 2) {
        empty.style.display = 'flex';
        _chartDrawing = false;
        return;
    }
    empty.style.display = 'none';

    /* --- trading-chart layout: main area + volume zone --- */
    const pad = { top: 18, bottom: 26, left: 8, right: 52 };
    const volH = Math.min(48, Math.floor((h - pad.top - pad.bottom) * 0.22));
    const gap = 4;
    const cw = w - pad.left - pad.right;
    const chMain = h - pad.top - pad.bottom - volH - gap;
    const volTop = pad.top + chMain + gap;

    let progress = 0;
    const stepX = cw / (vals.length - 1 || 1);
    const animDuration = 1400;
    let animStart = null;
    let hoverDot = -1;

    function yPos(v) {
        const baseY = pad.top + chMain - ((v - min) / range) * chMain;
        const centerY = pad.top + chMain / 2;
        return centerY + (baseY - centerY) * chartZoom.scale;
    }
    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    const points = [];

    function buildSplinePoints(count) {
        const raw = [];
        for (let i = 0; i < count; i++) {
            raw.push({ x: pad.left + i * stepX, y: yPos(vals[i]) });
        }
        return raw;
    }

    function traceRoundedPath(ctx, pts) {
        if (pts.length < 2) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
            const dx1 = pts[i].x - pts[i-1].x;
            const dy1 = pts[i].y - pts[i-1].y;
            const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
            
            const dx2 = pts[i+1].x - pts[i].x;
            const dy2 = pts[i+1].y - pts[i].y;
            const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
            
            const r = Math.min(4, len1 / 2, len2 / 2);
            ctx.arcTo(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, r);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }

    function drawFrame(p) {
        ctx.clearRect(0, 0, w, h);

        /* ---- horizontal grid lines ---- */
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const yy = pad.top + (chMain / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, yy);
            ctx.lineTo(w - pad.right, yy);
            ctx.stroke();
        }
        ctx.restore();

        /* ---- Y-axis price labels (right side) ---- */
        ctx.font = '500 10px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i <= 4; i++) {
            const yy = pad.top + (chMain / 4) * i;
            const v = max - (range / 4) * i;
            ctx.fillText(fmt(v), w - pad.right + 4, yy);
        }

        /* ---- X-axis labels (below volume zone) ---- */
        ctx.font = '500 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        const labelStep = Math.max(1, Math.floor(monthLabels.length / 8));
        for (let i = 0; i < monthLabels.length; i += labelStep) {
            ctx.fillText(monthLabels[i], pad.left + i * stepX, volTop + volH + 6);
        }

        const count = vals.length;
        if (count < 2) return;

        const rawPts = buildSplinePoints(count);
        const lastVal = vals[count - 1];
        const isGreen = lastVal >= 0;

        const lineColor = isGreen ? '#00e676' : '#ff5252';
        const animWidth = cw * p;

        /* ---- clip: main chart area ---- */
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad.left, 0, animWidth, h);
        ctx.clip();

        /* gradient fill */
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chMain);
        if (isGreen) {
            grad.addColorStop(0, 'rgba(0,230,118,0.3)');
            grad.addColorStop(1, 'rgba(0,230,118,0.0)');
        } else {
            grad.addColorStop(0, 'rgba(255,82,82,0.3)');
            grad.addColorStop(1, 'rgba(255,82,82,0.0)');
        }
        ctx.beginPath();
        traceRoundedPath(ctx, rawPts);
        const lastX = rawPts[rawPts.length - 1].x;
        ctx.lineTo(lastX, pad.top + chMain);
        ctx.lineTo(rawPts[0].x, pad.top + chMain);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        /* main line */
        ctx.beginPath();
        traceRoundedPath(ctx, rawPts);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();

        /* ---- Current price line & label ---- */
        if (count > 0) {
            let currY = rawPts[0].y;
            let currVal = vals[0];
            const exactIdx = p * (count - 1);
            const idx = Math.floor(exactIdx);
            if (idx < count - 1) {
                const fraction = exactIdx - idx;
                currY = rawPts[idx].y + (rawPts[idx+1].y - rawPts[idx].y) * fraction;
                currVal = vals[idx] + (vals[idx+1] - vals[idx]) * fraction;
            } else {
                currY = rawPts[count-1].y;
                currVal = vals[count-1];
            }
            
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.moveTo(pad.left, currY);
            ctx.lineTo(w - pad.right, currY);
            ctx.stroke();
            
            ctx.fillStyle = lineColor;
            ctx.beginPath();
            const lblH = 20;
            const lblW = pad.right;
            const lblX = w - pad.right;
            const lblY = currY - lblH / 2;
            ctx.roundRect(lblX, lblY, lblW, lblH, 2);
            ctx.fill();
            
            ctx.font = '600 10px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isGreen ? '#000' : '#fff';
            ctx.fillText(fmt(currVal), lblX + lblW / 2, currY);
            ctx.restore();
        }

        /* ---- volume/activity bars ---- */
        const visCount = Math.floor(p * (count - 1));
        for (let i = 0; i < count; i++) {
            if (i > visCount && p < 1) continue;
            const barW = Math.max(2, stepX * 0.6);
            const barH = (vols[i] / maxVol) * (volH - 4);
            const bx = pad.left + i * stepX - barW / 2;
            const by = volTop + (volH - 2) - barH;
            const vGreen = i === 0 ? vals[i] >= 0 : vals[i] >= vals[i-1];
            ctx.fillStyle = vGreen ? 'rgba(0,230,118,0.4)' : 'rgba(255,82,82,0.4)';
            ctx.fillRect(bx, by, barW, barH);
        }

        /* volume zone divider */
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, volTop);
        ctx.lineTo(w - pad.right, volTop);
        ctx.stroke();

        /* "VOL" label */
        ctx.font = '500 7px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillText('ACT', pad.left + 2, volTop + volH - 2);

        /* ---- crosshair (extended through volume) ---- */
        if (hoverDot >= 0 && hoverDot < count && rawPts[hoverDot]) {
            const hx = rawPts[hoverDot].x;
            const hy = Math.max(pad.top, Math.min(rawPts[hoverDot].y, pad.top + chMain));

            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(hx, pad.top);
            ctx.lineTo(hx, volTop + volH);
            ctx.moveTo(pad.left, hy);
            ctx.lineTo(w - pad.right, hy);
            ctx.stroke();
            ctx.restore();

            /* value label on right Y-axis at crosshair */
            const lblH = 18;
            ctx.fillStyle = '#2a2e39';
            ctx.beginPath();
            ctx.roundRect(w - pad.right, hy - lblH/2, pad.right, lblH, 2);
            ctx.fill();
            
            ctx.font = '500 10px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(fmt(vals[hoverDot]), w - pad.right / 2, hy);
        }

        points.length = 0;
        /* ---- data dots ---- */
        const visCountDots = Math.floor(p * (count - 1));
        for (let i = 0; i < count; i++) {
            if (i > visCountDots && p < 1) break;
            
            const x = rawPts[i].x;
            const y = Math.max(pad.top, Math.min(rawPts[i].y, pad.top + chMain));
            const isHovered = i === hoverDot;
            const isLast = i === count - 1;
            
            if (isHovered) {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fillStyle = isGreen ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)';
                ctx.fill();
            }
            
            ctx.beginPath();
            ctx.arc(x, y, isHovered ? 5 : (isLast ? 3.5 : 2.5), 0, Math.PI * 2);
            ctx.fillStyle = lineColor;
            ctx.fill();
            
            if (isHovered) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.strokeStyle = '#0f0f13';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            points.push({ x, y, i, val: vals[i] });
        }

        /* ---- tooltip ---- */
        if (hoverDot >= 0 && hoverDot < count && points[hoverDot]) {
            const idx = hoverDot;
            const x = points[idx].x;
            const y = Math.max(pad.top, Math.min(points[idx].y, pad.top + chMain));
            const txt = fmt(vals[idx]);
            const volTxt = vols[idx] !== undefined ? ` · Act. ${fmt(vols[idx])}` : '';
            const fullTxt = `${monthLabels[idx]}: ${txt}${volTxt}`;

            ctx.font = '600 11px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const tm = ctx.measureText(fullTxt);
            const bw = tm.width + 20;
            const bh = 28;
            const bx = Math.max(4, Math.min(x - bw / 2, w - bw - 4));
            const by = y - 34;

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(8,8,16,0.94)';
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 8);
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 8);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.fillText(fullTxt, bx + bw / 2, by + bh - 7);

            ctx.fillStyle = 'rgba(8,8,16,0.94)';
            ctx.beginPath();
            ctx.moveTo(x - 5, by + bh);
            ctx.lineTo(x, by + bh + 5);
            ctx.lineTo(x + 5, by + bh);
            ctx.closePath();
            ctx.fill();
        }
    }

    /* ---- event listeners ---- */
    if (_chartMoveHandler) canvas.removeEventListener('mousemove', _chartMoveHandler);
    if (_chartOutHandler) canvas.removeEventListener('mouseout', _chartOutHandler);
    if (_chartWheelHandler) canvas.removeEventListener('wheel', _chartWheelHandler);

    _chartMoveHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const step = cw / (vals.length - 1 || 1);
        const i = Math.round((mx - pad.left) / step);
        const was = hoverDot;
        hoverDot = (i >= 0 && i < vals.length && points[i]) ? i : -1;
        if (hoverDot !== was) drawFrame(progress);
    };
    _chartOutHandler = () => {
        hoverDot = -1;
        drawFrame(progress);
    };
    _chartWheelHandler = (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        chartZoom.scale = Math.max(0.3, Math.min(5, chartZoom.scale * factor));
        drawFrame(progress);
    };
    canvas.addEventListener('mousemove', _chartMoveHandler);
    canvas.addEventListener('mouseout', _chartOutHandler);
    canvas.addEventListener('wheel', _chartWheelHandler, { passive: false });

    if (!animate) {
        _chartDrawing = false;
        progress = 1;
        drawFrame(1);
        return;
    }

    _chartDrawing = true;

    function animate(ts) {
        if (!animStart) animStart = ts;
        const elapsed = ts - animStart;
        const t = Math.min(elapsed / animDuration, 1);
        progress = easeOutQuart(t);
        drawFrame(progress);
        if (progress < 1) {
            chartAnimId = requestAnimationFrame(animate);
        } else {
            chartAnimId = null;
            _chartDrawing = false;
        }
    }
    chartAnimId = requestAnimationFrame(animate);
}

/* view mode toggle */
$$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.viewMode = btn.dataset.view;
        updateChartControls();
        renderDashboard();
    });
});

$('#chart-range')?.addEventListener('change', renderDashboard);
$('#chart-date')?.addEventListener('change', renderDashboard);

/* redraw on resize — sin animación */
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawChart(false), 150);
});

/* ============================================
   TRANSACTION FORM
   ============================================ */
function resetTxForm() {
    $('#transaction-form').reset();
    $('#date').valueAsDate = new Date();
    $('#type').value = 'ingreso';
    toggleBtns.forEach((b, i) => {
        b.classList.toggle('active', i === 0);
    });
    if (state.editingTxId) {
        state.editingTxId = null;
        $('#submit-btn').textContent = '+';
        $('#cancel-edit').style.display = 'none';
    }
}

$('#transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submit-btn');
    const data = {
        type: $('#type').value,
        amount: parseFloat($('#amount').value),
        category: $('#category').value.trim(),
        date: $('#date').value,
        description: $('#description').value.trim() || null,
    };
    btn.classList.add('btn-loading');
    try {
        if (state.editingTxId) {
            await api('PUT', '/transactions/' + state.editingTxId, data);
        } else {
            await api('POST', '/transactions/', data);
        }
        btn.classList.remove('btn-loading');
        const orig = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = 'var(--green)';
        btn.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)';
        await sleep(600);
        btn.textContent = orig;
        btn.style.background = '';
        btn.style.boxShadow = '';
        resetTxForm();
        await loadAll();
        drawChart();
    } catch (err) {
        btn.classList.remove('btn-loading');
        alert(err.message);
    }
});

$('#cancel-edit').addEventListener('click', resetTxForm);

$('#amount').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#transaction-form').dispatchEvent(new Event('submit'));
});

/* ============================================
   TRANSACTION LIST
   ============================================ */
function renderTxList() {
    const el = $('#transactions-list');
    let txs = state.transactions;
    const filtType = $('#filter-type')?.value;
    const filtCat = $('#filter-category')?.value?.toLowerCase();
    const filtFrom = $('#filter-from')?.value;
    const filtTo = $('#filter-to')?.value;
    if (filtType) txs = txs.filter(t => t.type === filtType);
    if (filtCat) txs = txs.filter(t => t.category.toLowerCase().includes(filtCat));
    if (filtFrom) txs = txs.filter(t => t.date >= filtFrom);
    if (filtTo) txs = txs.filter(t => t.date <= filtTo);

    if (!txs.length) {
        el.innerHTML = '<div class="loading-state" style="color:var(--text-tertiary);font-size:13px;padding:32px">Sin transacciones</div>';
        return;
    }
    el.innerHTML = txs.map((t, i) => `
        <div class="tx-row" style="animation-delay:${i * 0.03}s">
            <span class="tx-type ${t.type}"></span>
            <span class="tx-amount ${t.type === 'ingreso' ? 'pos' : 'neg'}">${t.type === 'ingreso' ? '+' : '-'}${fmt(t.amount)}</span>
            <span class="tx-category">${t.category}</span>
            <span class="tx-date">${t.date}</span>
            <span class="tx-desc">${t.description || ''}</span>
            <button class="tx-delete" data-id="${t.id}" title="Editar">✎</button>
            <button class="tx-delete" data-id="${t.id}" title="Eliminar">✕</button>
        </div>
    `).join('');

    el.querySelectorAll('.tx-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.id);
            if (btn.title === 'Eliminar') {
                if (!confirm('¿Eliminar esta transacción?')) return;
                await api('DELETE', '/transactions/' + id);
            } else {
                /* edit */
                const t = state.transactions.find(x => x.id === id);
                if (!t) return;
                state.editingTxId = id;
                $('#type').value = t.type;
                toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.value === t.type));
                $('#amount').value = t.amount;
                $('#category').value = t.category;
                $('#date').value = t.date;
                $('#description').value = t.description || '';
                $('#submit-btn').textContent = '✓';
                $('#cancel-edit').style.display = 'inline-block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            await loadAll();
            drawChart();
        });
    });
}

$('#apply-filters')?.addEventListener('click', renderTxList);
$('#filter-type')?.addEventListener('change', renderTxList);

/* ============================================
   BUDGETS
   ============================================ */
function spentInCategory(cat) {
    const m = $('#budget-month')?.value || thisMonth();
    return state.transactions
        .filter(t => t.type === 'gasto' && t.category === cat && t.date && t.date.startsWith(m))
        .reduce((s, t) => s + Number(t.amount), 0);
}

function renderBudgets() {
    const el = $('#budgets-list');
    if (!el) return;
    if (!state.budgets.length) {
        el.innerHTML = '<div class="loading-state" style="color:var(--text-tertiary);font-size:13px;padding:32px">Sin presupuestos</div>';
        return;
    }
    el.innerHTML = state.budgets.map(b => {
        const sp = spentInCategory(b.category);
        const pct = Math.min((sp / b.amount) * 100, 100);
        const over = sp > b.amount;
        return `
            <div class="budget-card">
                <h4>${b.category}</h4>
                <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${over ? 'var(--red)' : pct > 80 ? '#f59e0b' : 'var(--accent)'}"></div></div>
                <div class="budget-meta"><span>${fmt(sp)}</span><span>${fmt(b.amount)}</span></div>
                <div class="budget-month">${b.month}</div>
                <div class="budget-actions">
                    <button data-id="${b.id}" class="edit-budget">Editar</button>
                    <button data-id="${b.id}" class="danger del-budget">Eliminar</button>
                </div>
            </div>
        `;
    }).join('');

    el.querySelectorAll('.del-budget').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar presupuesto?')) return;
            await api('DELETE', '/budgets/' + btn.dataset.id);
            await loadAll();
        });
    });
    el.querySelectorAll('.edit-budget').forEach(btn => {
        btn.addEventListener('click', () => {
            const b = state.budgets.find(x => x.id === Number(btn.dataset.id));
            if (!b) return;
            $('#add-budget-btn').click();
            $('#budget-category').value = b.category;
            $('#budget-amount').value = b.amount;
            $('#budget-month').value = b.month;
            $('#budget-form').dataset.editId = b.id;
        });
    });
}

/* budget form */
$('#add-budget-btn')?.addEventListener('click', () => {
    const f = $('#budget-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
    if (f.style.display === 'block') {
        $('#budget-category').value = '';
        $('#budget-amount').value = '';
        $('#budget-month').value = thisMonth();
        delete f.dataset.editId;
    }
});
$('#cancel-budget')?.addEventListener('click', () => { $('#budget-form').style.display = 'none'; });
$('#budget-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        category: $('#budget-category').value.trim(),
        amount: parseFloat($('#budget-amount').value),
        month: $('#budget-month').value,
    };
    const id = e.target.dataset.editId;
    try {
        if (id) {
            await api('PUT', '/budgets/' + id, data);
        } else {
            await api('POST', '/budgets/', data);
        }
        $('#budget-form').style.display = 'none';
        delete e.target.dataset.editId;
        await loadAll();
    } catch (err) { alert(err.message); }
});

/* ============================================
   CATEGORIES
   ============================================ */
function renderCatMonthOptions() {
    const sel = $('#cat-month-filter');
    if (!sel) return;
    const months = [...new Set(state.transactions.filter(t => t.date).map(t => t.date.slice(0, 7)))].sort().reverse();
    months.forEach(m => {
        if (![...sel.options].some(o => o.value === m)) {
            const o = document.createElement('option');
            o.value = m; o.textContent = m;
            sel.appendChild(o);
        }
    });
}

function renderCategories() {
    const el = $('#categories-list');
    if (!el) return;
    const filter = $('#cat-month-filter')?.value || null;
    let txs = state.transactions.filter(t => t.type === 'gasto');
    if (filter) txs = txs.filter(t => t.date && t.date.startsWith(filter));
    const map = {};
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
        el.innerHTML = '<div class="loading-state" style="color:var(--text-tertiary);font-size:13px;padding:32px">Sin gastos</div>';
        drawPieChart([]);
        return;
    }
    el.innerHTML = sorted.map(([cat, amt]) => `
        <div class="cat-item"><span class="cat-name">${cat}</span><span class="cat-amount">${fmt(amt)}</span></div>
    `).join('');
    drawPieChart(sorted);
}

$('#cat-month-filter')?.addEventListener('change', renderCategories);

/* PIE / DONUT CHART — fixed lifecycle */
let pieHover = -1;
let _pieAnimId = null;
let _pieMoveHandler = null;
let _pieOutHandler = null;

function adjustBrightness(hex, amount) {
    hex = hex.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    return `rgb(${r},${g},${b})`;
}

function drawPieChart(data) {
    const canvas = $('#pie-chart');
    const empty = $('#pie-empty');
    if (!canvas) return;
    const wrap = canvas.parentElement;

    if (_pieAnimId) { cancelAnimationFrame(_pieAnimId); _pieAnimId = null; }

    if (!data || !data.length) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = w / 2, cy = h / 2, outerR = Math.min(w, h) / 2 - 24;
    if (outerR <= 0) { empty.style.display = 'flex'; return; }

    const innerR = outerR * 0.58;
    const total = data.reduce((s, d) => s + d[1], 0);

    const colors = [
        { fill: '#22c55e', glow: 'rgba(34,197,94,0.35)' },
        { fill: '#3b82f6', glow: 'rgba(59,130,246,0.35)' },
        { fill: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
        { fill: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
        { fill: '#06b6d4', glow: 'rgba(6,182,212,0.35)' },
        { fill: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' },
        { fill: '#f97316', glow: 'rgba(249,115,22,0.35)' },
        { fill: '#10b981', glow: 'rgba(16,185,129,0.35)' },
        { fill: '#6366f1', glow: 'rgba(99,102,241,0.35)' },
        { fill: '#eab308', glow: 'rgba(234,179,8,0.35)' },
    ];

    const segs = [];
    const segGap = data.length > 1 ? 0.025 : 0;
    const animDuration = 800;
    let animStart = null;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function renderFrame(ts) {
        if (!animStart) animStart = ts;
        const elapsed = ts - animStart;
        const t = Math.min(elapsed / animDuration, 1);
        const progress = easeOutCubic(t);

        ctx.clearRect(0, 0, w, h);

        /* Ambient glow */
        const ambient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR * 1.3);
        ambient.addColorStop(0, 'rgba(34,197,94,0.04)');
        ambient.addColorStop(1, 'rgba(34,197,94,0)');
        ctx.fillStyle = ambient;
        ctx.fillRect(0, 0, w, h);

        let start = -Math.PI / 2;
        segs.length = 0;

        data.forEach((d, i) => {
            const angle = (d[1] / total) * Math.PI * 2 * progress;
            const gapAngle = data.length > 1 ? segGap : 0;
            const drawStart = start + gapAngle;
            const drawAngle = Math.max(angle - gapAngle * 2, 0.001);
            const midAngle = drawStart + drawAngle / 2;
            const c = colors[i % colors.length];
            const isHovered = i === pieHover;

            const explode = isHovered ? 8 : 0;
            const ex = Math.cos(midAngle) * explode;
            const ey = Math.sin(midAngle) * explode;

            segs.push({ start: drawStart, angle: drawAngle, midAngle, idx: i });

            ctx.save();
            ctx.translate(ex, ey);

            if (isHovered) {
                ctx.shadowColor = c.glow;
                ctx.shadowBlur = 20;
            }

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, drawStart, drawStart + drawAngle);
            ctx.arc(cx, cy, innerR, drawStart + drawAngle, drawStart, true);
            ctx.closePath();

            const segGrad = ctx.createLinearGradient(
                cx + Math.cos(midAngle - 0.5) * outerR,
                cy + Math.sin(midAngle - 0.5) * outerR,
                cx + Math.cos(midAngle + 0.5) * outerR,
                cy + Math.sin(midAngle + 0.5) * outerR
            );
            segGrad.addColorStop(0, c.fill);
            segGrad.addColorStop(1, adjustBrightness(c.fill, isHovered ? 30 : -15));
            ctx.fillStyle = segGrad;
            ctx.globalAlpha = isHovered ? 1 : 0.88;
            ctx.fill();
            ctx.globalAlpha = 1;

            const gloss = ctx.createRadialGradient(
                cx + Math.cos(midAngle) * (innerR + (outerR - innerR) * 0.3),
                cy + Math.sin(midAngle) * (innerR + (outerR - innerR) * 0.3),
                0, cx, cy, outerR
            );
            gloss.addColorStop(0, 'rgba(255,255,255,0.12)');
            gloss.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gloss;
            ctx.fill();

            ctx.restore();
            ctx.shadowBlur = 0;
            start += angle;
        });

        /* Center hole — glass effect */
        ctx.beginPath();
        ctx.arc(cx, cy, innerR + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const holeGrad = ctx.createRadialGradient(cx, cy - innerR * 0.2, 0, cx, cy, innerR);
        holeGrad.addColorStop(0, '#161624');
        holeGrad.addColorStop(1, '#0c0c14');
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fillStyle = holeGrad;
        ctx.fill();

        const shine = ctx.createLinearGradient(cx - innerR, cy - innerR, cx + innerR, cy + innerR);
        shine.addColorStop(0, 'rgba(255,255,255,0.04)');
        shine.addColorStop(0.5, 'rgba(255,255,255,0)');
        shine.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = shine;
        ctx.fill();

        /* Center text */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (pieHover >= 0 && data[pieHover]) {
            const hd = data[pieHover];
            const pct = ((hd[1] / total) * 100).toFixed(1);
            ctx.font = '700 16px "Fira Code", monospace';
            ctx.fillStyle = colors[pieHover % colors.length].fill;
            ctx.fillText(fmt(hd[1]), cx, cy - 10);
            ctx.font = '500 11px "Fira Sans", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(hd[0], cx, cy + 10);
            ctx.font = '600 10px "Fira Code", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(pct + '%', cx, cy + 26);
        } else {
            ctx.font = '300 10px "Fira Sans", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText('TOTAL', cx, cy - 14);
            ctx.font = '700 17px "Fira Code", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.93)';
            ctx.fillText(fmt(total), cx, cy + 6);
        }

        if (progress < 1) {
            _pieAnimId = requestAnimationFrame(renderFrame);
        } else {
            _pieAnimId = null;
        }
    }

    _pieAnimId = requestAnimationFrame(renderFrame);

    /* Event listeners with cleanup */
    if (_pieMoveHandler) canvas.removeEventListener('mousemove', _pieMoveHandler);
    if (_pieOutHandler) canvas.removeEventListener('mouseout', _pieOutHandler);

    _pieMoveHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width) / dpr;
        const my = (e.clientY - rect.top) * (canvas.height / rect.height) / dpr;
        const dx = mx - cx, dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let hit = -1;
        if (dist >= innerR && dist <= outerR) {
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += Math.PI * 2;
            for (let i = 0; i < segs.length; i++) {
                let sa = segs[i].start;
                let ea = sa + segs[i].angle;
                let a = angle;
                if (a < sa) a += Math.PI * 2;
                if (a >= sa && a <= ea) { hit = i; break; }
            }
        }

        if (hit !== pieHover) {
            pieHover = hit;
            canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
            if (!_pieAnimId) {
                animStart = performance.now() - animDuration - 100;
                _pieAnimId = requestAnimationFrame(renderFrame);
            }
        }
    };

    _pieOutHandler = () => {
        if (pieHover !== -1) {
            pieHover = -1;
            canvas.style.cursor = 'default';
            if (!_pieAnimId) {
                animStart = performance.now() - animDuration - 100;
                _pieAnimId = requestAnimationFrame(renderFrame);
            }
        }
    };

    canvas.addEventListener('mousemove', _pieMoveHandler);
    canvas.addEventListener('mouseout', _pieOutHandler);
}

/* ============================================
   GOALS
   ============================================ */
function renderGoalPreview() {
    const el = $('#savings-preview-body');
    if (!el) return;
    if (!state.goals.length) {
        el.innerHTML = '<div style="color:var(--text-tertiary);font-size:13px;padding:8px 0">Crea una meta de ahorro para verla aquí</div>';
        return;
    }
    const g = state.goals[0];
    const pct = Math.min((g.current_amount / g.target_amount) * 100, 100);
    el.innerHTML = `
        <div class="savings-preview-card">
            <div class="savings-preview-info">
                <div class="savings-preview-name">${g.name}</div>
                <div class="savings-preview-detail">${fmt(g.current_amount)} de ${fmt(g.target_amount)}</div>
            </div>
            <div class="savings-preview-progress">
                <span class="pct" style="color:${pct >= 100 ? 'var(--green)' : 'var(--accent)'}">${pct.toFixed(1)}%</span>
                <span class="sub">completado</span>
            </div>
        </div>
    `;
}

function renderGoals() {
    const el = $('#goals-list');
    if (!el) return;
    if (!state.goals.length) {
        el.innerHTML = '<div class="loading-state" style="color:var(--text-tertiary);font-size:13px;padding:32px">Sin metas de ahorro</div>';
        return;
    }

    Promise.all(state.goals.map(g =>
        api('GET', `/savings-goals/${g.id}/projection`).catch(() => null)
    )).then(projections => {
        el.innerHTML = state.goals.map((g, i) => {
            const p = projections[i];
            const pct = Math.min((g.current_amount / g.target_amount) * 100, 100);
            const projHtml = p ? `
                <div class="goal-projection">
                    <strong>${fmt(p.remaining)}</strong> restantes &middot;
                    ~${p.estimated_months} meses
                    ${p.estimated_date ? '(&le; ' + p.estimated_date + ')' : ''}
                    <div class="${p.on_track ? 'on-track' : 'off-track'}">${p.on_track ? '✓ En camino' : '✗ Ajusta la meta'}</div>
                </div>
            ` : '';
            return `
                <div class="goal-card">
                    <div class="goal-name">${g.name}</div>
                    <div class="goal-meta">
                        <span>Meta: ${fmt(g.target_amount)}</span>
                        <span>Restante: ${fmt(g.target_amount - g.current_amount)}</span>
                        ${g.deadline ? '<span>Límite: ' + g.deadline + '</span>' : ''}
                    </div>
                    <div class="goal-pct" style="color:${pct >= 100 ? 'var(--green)' : 'var(--accent)'}">${pct.toFixed(1)}%</div>
                    <div class="goal-bar-wrap"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
                    ${projHtml}
                    <div class="goal-actions">
                        <button data-id="${g.id}" class="danger del-goal">Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');

        el.querySelectorAll('.del-goal').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar esta meta?')) return;
                await api('DELETE', '/savings-goals/' + btn.dataset.id);
                await loadAll();
            });
        });
    });
}

/* goal form */
$('#add-goal-btn')?.addEventListener('click', () => {
    const f = $('#goal-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
    if (f.style.display === 'block') {
        $('#goal-name').value = '';
        $('#goal-target').value = '';
        $('#goal-current').value = '0';
        $('#goal-deadline').value = '';
    }
});
$('#cancel-goal')?.addEventListener('click', () => { $('#goal-form').style.display = 'none'; });
$('#goal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: $('#goal-name').value.trim(),
        target_amount: parseFloat($('#goal-target').value),
        current_amount: parseFloat($('#goal-current').value) || 0,
        deadline: $('#goal-deadline').value || null,
    };
    try {
        await api('POST', '/savings-goals/', data);
        $('#goal-form').style.display = 'none';
        await loadAll();
    } catch (err) { alert(err.message); }
});

function renderCategoryDatalist() {
    const dl = $('#category-list');
    if (!dl) return;
    const cats = [...new Set(state.transactions.map(t => t.category))].sort();
    dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

/* ============================================
   EXPORT CSV
   ============================================ */
$('#export-btn')?.addEventListener('click', () => {
    window.open(API + '/transactions/export/csv', '_blank');
});

/* ============================================
   INIT
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
    $('#date').valueAsDate = new Date();
    if (!$('#budget-month').value) $('#budget-month').value = thisMonth();
    await loadAll();
});
