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

/* ============================================
   SIDEBAR NAV
   ============================================ */
function switchTab(tab) {
    $$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-content').forEach(el => el.classList.toggle('active', el.id === 'tab-' + tab));
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
function renderAll() {
    renderDashboard();
    renderTxList();
    renderBudgets();
    renderCategories();
    renderGoals();
    renderGoalPreview();
    renderChartYearOptions();
    renderCatMonthOptions();
    renderCategoryDatalist();
}

/* ============================================
   DASHBOARD — STATS
   ============================================ */
function renderDashboard() {
    const year = $('#chart-year').value || String(new Date().getFullYear());
    const txs = state.transactions.filter(t => t.date && t.date.startsWith(year));
    let ing = 0, gas = 0;
    txs.forEach(t => { if (t.type === 'ingreso') ing += Number(t.amount); else gas += Number(t.amount); });
    const bal = ing - gas;
    $('#total-balance').textContent = fmt(bal);
    $('#total-ingresos').textContent = fmt(ing);
    $('#total-gastos').textContent = fmt(gas);
    if (bal >= 0) $('#total-balance').style.color = 'var(--green)';
    else $('#total-balance').style.color = 'var(--red)';
}

/* ============================================
   CHART — LINE (animated)
   ============================================ */
let chartAnimId = null;

function renderChartYearOptions() {
    const sel = $('#chart-year');
    if (!sel) return;
    const years = [...new Set(state.transactions.map(t => t.date ? t.date.slice(0, 4) : null).filter(Boolean))].sort();
    years.forEach(y => {
        if (![...sel.options].some(o => o.value === y)) {
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            sel.appendChild(o);
        }
    });
    if (!sel.value && years.length) sel.value = years[years.length - 1];
    if (!sel.value) sel.value = String(new Date().getFullYear());
}

$('#chart-year')?.addEventListener('change', () => { renderAll(); drawChart(); });

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

function drawChart() {
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

    const year = $('#chart-year')?.value || String(new Date().getFullYear());
    const series = getMonthlySeries(year);
    const vals = series.map(s => s.balance);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;

    if (vals.every(v => v === 0)) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const pad = { top: 20, bottom: 20, left: 10, right: 10 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    /* draw progressively */
    let progress = 0;
    const stepX = cw / (vals.length - 1 || 1);

    function yPos(v) { return pad.top + ch - ((v - min) / range) * ch; }

    function drawFrame(p) {
        ctx.clearRect(0, 0, w, h);
        const count = Math.floor(p * vals.length);

        /* grid lines */
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const yy = pad.top + (ch / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, yy);
            ctx.lineTo(w - pad.right, yy);
            ctx.stroke();
        }

        if (count < 2) return;

        /* gradient fill */
        const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        const lastVal = vals[Math.min(count - 1, vals.length - 1)];
        if (lastVal >= 0) {
            grad.addColorStop(0, 'rgba(34,197,94,0.25)');
            grad.addColorStop(1, 'rgba(34,197,94,0.01)');
        } else {
            grad.addColorStop(0, 'rgba(239,68,68,0.25)');
            grad.addColorStop(1, 'rgba(239,68,68,0.01)');
        }

        ctx.beginPath();
        ctx.moveTo(pad.left + 0 * stepX, yPos(vals[0]));
        for (let i = 1; i < count; i++) {
            const x = pad.left + i * stepX;
            ctx.lineTo(x, yPos(vals[i]));
        }
        const lastX = pad.left + (count - 1) * stepX;
        ctx.lineTo(lastX, yPos(0));
        ctx.lineTo(pad.left + 0 * stepX, yPos(0));
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        /* line */
        const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
        if (lastVal >= 0) {
            lineGrad.addColorStop(0, 'rgba(34,197,94,0.2)');
            lineGrad.addColorStop(1, '#22c55e');
        } else {
            lineGrad.addColorStop(0, 'rgba(239,68,68,0.2)');
            lineGrad.addColorStop(1, '#ef4444');
        }
        ctx.beginPath();
        ctx.moveTo(pad.left + 0 * stepX, yPos(vals[0]));
        for (let i = 1; i < count; i++) {
            const x = pad.left + i * stepX;
            ctx.lineTo(x, yPos(vals[i]));
        }
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        /* dots */
        for (let i = 0; i < count; i++) {
            const x = pad.left + i * stepX;
            const y = yPos(vals[i]);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = vals[i] >= 0 ? '#22c55e' : '#ef4444';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        /* tooltip-like label on last point */
        if (count > 0) {
            const idx = Math.min(count - 1, vals.length - 1);
            const x = pad.left + idx * stepX;
            const y = yPos(vals[idx]);
            const label = fmt(vals[idx]);
            ctx.font = '11px Fira Code, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(label, x, y - 10);
        }
    }

    function animate() {
        progress = Math.min(progress + 0.04, 1);
        drawFrame(progress);
        if (progress < 1) {
            chartAnimId = requestAnimationFrame(animate);
        }
    }
    animate();
}

/* redraw on resize */
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
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
    const data = {
        type: $('#type').value,
        amount: parseFloat($('#amount').value),
        category: $('#category').value.trim(),
        date: $('#date').value,
        description: $('#description').value.trim() || null,
    };
    try {
        if (state.editingTxId) {
            await api('PUT', '/transactions/' + state.editingTxId, data);
        } else {
            await api('POST', '/transactions/', data);
        }
        resetTxForm();
        await loadAll();
        drawChart();
    } catch (err) { alert(err.message); }
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
                <div style="font-size:11px;color:var(--text-tertiary);text-align:right">${b.month}</div>
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

/* PIE CHART */
function drawPieChart(data) {
    const canvas = $('#pie-chart');
    const empty = $('#pie-empty');
    if (!canvas) return;
    const wrap = canvas.parentElement;
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
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 20;
    const total = data.reduce((s, d) => s + d[1], 0);
    const colors = ['#818cf8', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#d946ef', '#f97316', '#14b8a6', '#8b5cf6', '#eab308'];
    let start = -Math.PI / 2;
    data.forEach((d, i) => {
        const angle = (d[1] / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        start += angle;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--bg-primary)';
    ctx.fill();
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '13px Fira Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(total), cx, cy);
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
                        <span>Ahorrado: ${fmt(g.current_amount)}</span>
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
    await loadAll();
    drawChart();
    if (!$('#date').value) $('#date').valueAsDate = new Date();
    if (!$('#budget-month').value) $('#budget-month').value = thisMonth();
});
