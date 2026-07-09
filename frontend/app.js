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
   TOAST SYSTEM
   ============================================ */
function showToast(message, type) {
    type = type || 'info';
    const container = $('#toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', info: '◆' };
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-icon ${type}">${icons[type] || '◆'}</span><span class="toast-msg">${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('removing');
        el.addEventListener('animationend', () => el.remove());
    }, 3500);
}

/* ============================================
   CONFIRM MODAL
   ============================================ */
function showConfirm(message, okText) {
    const dialog = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!dialog || !msgEl || !okBtn || !cancelBtn) return Promise.resolve(false);

    msgEl.textContent = message;
    okBtn.textContent = okText || 'Eliminar';
    return new Promise(resolve => {
        function cleanup() {
            dialog.close();
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            dialog.removeEventListener('close', onClose);
        }
        function onOk() { cleanup(); resolve(true); }
        function onCancel() { cleanup(); resolve(false); }
        function onClose() { cleanup(); resolve(false); }
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        dialog.addEventListener('close', onClose);
        dialog.showModal();
    });
}

/* ============================================
   EMPTY STATE HELPER
   ============================================ */
function emptyStateHTML(icon, title, desc) {
    return `<div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        ${desc ? '<div class="empty-state-desc">' + desc + '</div>' : ''}
    </div>`;
}

/* ============================================
   FORM VALIDATION
   ============================================ */
function clearFieldError(field) {
    const parent = field.closest('.field');
    if (!parent) return;
    field.classList.remove('error');
    const existing = parent.querySelector('.field-error');
    if (existing) existing.remove();
}

function showFieldError(field, msg) {
    const parent = field.closest('.field');
    if (!parent) return;
    field.classList.add('error');
    clearFieldError(field);
    const err = document.createElement('div');
    err.className = 'field-error';
    err.textContent = msg;
    field.parentNode.appendChild(err);
}

function validateRequired(field, label) {
    clearFieldError(field);
    if (!field.value.trim()) {
        showFieldError(field, (label || 'Este campo') + ' es obligatorio');
        return false;
    }
    return true;
}

function validatePositive(field, label) {
    clearFieldError(field);
    const v = parseFloat(field.value);
    if (isNaN(v) || v <= 0) {
        showFieldError(field, (label || 'El valor') + ' debe ser mayor a 0');
        return false;
    }
    return true;
}

/* ============================================
    SIDEBAR NAV
    ============================================ */
let currentTab = 'dashboard';

async function switchTab(tab) {
    if (tab === currentTab) return;
    const tabs = ['dashboard', 'budgets', 'categories', 'goals'];
    const idx = tabs.indexOf(tab);
    const prevIdx = tabs.indexOf(currentTab);
    const dir = idx > prevIdx ? 8 : -8;
    currentTab = tab;

    $$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    const oldEl = $('.tab-content.active');
    if (oldEl) {
        oldEl.style.animation = 'fade-out 0.15s ease-out forwards';
        await new Promise(r => setTimeout(r, 160));
        oldEl.classList.remove('active');
        oldEl.style.animation = '';
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
    if (tab === 'dashboard') renderChart();
}
$$('.side-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
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
function showSkeletons() {
    const lists = ['#transactions-list', '#budgets-list', '#categories-list', '#goals-list', '#savings-preview-body'];
    lists.forEach(id => {
        const el = document.querySelector(id);
        if (!el) return;
        if (id === '#savings-preview-body') {
            el.innerHTML = '<div class="skeleton skeleton-card" style="height:60px"></div>';
        } else if (id === '#transactions-list') {
            el.innerHTML = Array(5).fill('<div class="skeleton skeleton-row"></div>').join('');
        } else {
            el.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="margin-top:8px"></div>';
        }
    });
}

async function loadAll() {
    showSkeletons();
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
window.switchTab = switchTab;
/* suppress uncaught promise from inline onclick */
window._switchTab = (tab) => { switchTab(tab).catch(() => {}); };

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

    renderChart();
}

/* ============================================
   CHART — LINE (Chart.js)
   ============================================ */

/* Gradient fill plugin */
const chartAreaGradient = {
    id: 'chartAreaGradient',
    beforeDraw(chart) {
        const { ctx, chartArea, data } = chart;
        if (!chartArea) return;
        const ds = data.datasets[0];
        if (!ds || !ds.data.length) return;
        const lastVal = ds.data[ds.data.length - 1];
        const isGreen = lastVal >= 0;
        const color = isGreen ? 'rgba(0,230,118,' : 'rgba(255,82,82,';
        const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, color + '0.3)');
        grad.addColorStop(1, color + '0.0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const firstX = xScale.getPixelForValue(ds.data[0]);
        const lastX = xScale.getPixelForValue(ds.data[ds.data.length - 1]);
        ctx.moveTo(firstX, yScale.getPixelForValue(0));
        for (let i = 0; i < ds.data.length; i++) {
            const x = xScale.getPixelForValue(ds.data[i]);
            const y = yScale.getPixelForValue(ds.data[i]);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(lastX, yScale.getPixelForValue(0));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
};

Chart.register(chartAreaGradient);

function renderChart() {
    if (window._chartInstance) {
        window._chartInstance.destroy();
        window._chartInstance = null;
    }
    const canvas = $('#line-chart');
    if (!canvas) return;
    const data = getChartData();
    if (data.values.length < 2 || data.values.every(v => v === 0)) {
        canvas.parentElement.querySelector('.chart-empty').style.display = 'flex';
        return;
    }
    canvas.parentElement.querySelector('.chart-empty').style.display = 'none';

    const lastVal = data.values[data.values.length - 1];
    const isGreen = lastVal >= 0;
    const lineColor = isGreen ? '#00e676' : '#ff5252';
    const max = Math.max(...data.values, 1);
    const min = Math.min(...data.values, 0);
    const range = max - min || 1;
    const padding = range * 0.1;

    window._chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                borderColor: lineColor,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBorderWidth: 2,
                pointHoverBackgroundColor: lineColor,
                pointHoverBorderColor: '#fff',
                tension: 0.35,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1200,
                easing: 'easeOutQuart',
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(8,8,16,0.94)',
                    titleFont: { weight: '600', size: 11 },
                    bodyFont: { size: 11, weight: '600' },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    caretSize: 6,
                    callbacks: {
                        label: (ctx) => fmt(ctx.parsed.y),
                    },
                },
                zoom: {
                    pan: { enabled: true, mode: 'x', threshold: 10 },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    limits: { x: { minRange: 2 } },
                },
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.22)',
                        font: { size: 10, weight: '500' },
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(255,255,255,0.06)',
                        drawTicks: false,
                    },
                    border: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        font: { size: 10, weight: '500' },
                        padding: 4,
                        maxTicksLimit: 6,
                        callback: (v) => fmt(v),
                    },
                    min: Math.floor(min - padding),
                    max: Math.ceil(max + padding),
                },
            },
        },
    });

    /* Reset zoom button */
    let resetBtn = canvas.parentElement.querySelector('.chart-reset-zoom');
    if (!resetBtn) {
        resetBtn = document.createElement('button');
        resetBtn.className = 'chart-reset-zoom';
        resetBtn.textContent = '↺ Reset zoom';
        canvas.parentElement.appendChild(resetBtn);
        resetBtn.addEventListener('click', () => {
            if (window._chartInstance) window._chartInstance.resetZoom();
        });
    }
    const handler = () => {
        const isZoomed = window._chartInstance?.isZoomedOrPanned();
        resetBtn.style.display = isZoomed ? 'block' : 'none';
    };
    canvas.removeEventListener('zoom', handler);
    canvas.removeEventListener('pan', handler);
    canvas.addEventListener('zoom', handler);
    canvas.addEventListener('pan', handler);
    handler();
}

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

/* view mode toggle */

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
    resizeTimer = setTimeout(() => { try { renderChart(); } catch(e) {} }, 150);
});

/* ============================================
   TRANSACTION FORM
   ============================================ */
function toggleTxForm(open) {
    const form = $('#transaction-form');
    const toggle = $('#tx-form-toggle');
    if (open) {
        form.classList.remove('collapsed');
        form.classList.add('open');
        toggle.style.display = 'none';
        $('#amount')?.focus();
    } else {
        form.classList.remove('open');
        form.classList.add('collapsed');
        toggle.style.display = '';
    }
}

function resetTxForm() {
    $('#transaction-form').reset();
    $('#date').valueAsDate = new Date();
    $('#type').value = 'ingreso';
    toggleBtns.forEach((b, i) => {
        b.classList.toggle('active', i === 0);
    });
    if (state.editingTxId) {
        state.editingTxId = null;
        $('#submit-btn').textContent = 'Agregar';
        $('#cancel-edit').style.display = 'none';
    }
    toggleTxForm(false);
}

$('#tx-form-toggle')?.addEventListener('click', () => toggleTxForm(true));

$('#transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submit-btn');

    const amountField = $('#amount');
    const categoryField = $('#category');
    const dateField = $('#date');

    let valid = true;
    if (!validatePositive(amountField, 'El monto')) valid = false;
    if (!validateRequired(categoryField, 'La categoría')) valid = false;
    if (!validateRequired(dateField, 'La fecha')) valid = false;
    if (!valid) return;

    const data = {
        type: $('#type').value,
        amount: parseFloat(amountField.value),
        category: categoryField.value.trim(),
        date: dateField.value,
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
        showToast(state.editingTxId ? 'Transacción actualizada' : 'Transacción creada', 'success');
        resetTxForm();
        await loadAll();
        renderChart();
    } catch (err) {
        btn.classList.remove('btn-loading');
        showToast(err.message, 'error');
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
    const filtSearch = $('#filter-search')?.value?.toLowerCase();
    if (filtType) txs = txs.filter(t => t.type === filtType);
    if (filtCat) txs = txs.filter(t => t.category.toLowerCase().includes(filtCat));
    if (filtFrom) txs = txs.filter(t => t.date >= filtFrom);
    if (filtTo) txs = txs.filter(t => t.date <= filtTo);
    if (filtSearch) txs = txs.filter(t =>
        t.category.toLowerCase().includes(filtSearch) ||
        (t.description && t.description.toLowerCase().includes(filtSearch))
    );

    if (!txs.length) {
        el.innerHTML = emptyStateHTML('$', 'Sin transacciones', 'Agrega un ingreso o gasto usando el formulario de arriba.');
        return;
    }
    el.innerHTML = txs.map((t, i) => `
        <div class="tx-row" style="animation-delay:${i * 0.05}s">
            <span class="tx-type ${t.type}"></span>
            <span class="tx-amount ${t.type === 'ingreso' ? 'pos' : 'neg'}">${t.type === 'ingreso' ? '+' : '-'}${fmt(t.amount)}</span>
            <span class="tx-category">${t.category}</span>
            <span class="tx-date">${t.date}</span>
            <span class="tx-desc">${t.description || ''}</span>
            <button class="tx-edit" data-id="${t.id}">Editar</button>
            <button class="tx-delete" data-id="${t.id}">Eliminar</button>
        </div>
    `).join('');

    el.querySelectorAll('.tx-edit').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.tx-row');
            const id = Number(btn.dataset.id);
            const t = state.transactions.find(x => x.id === id);
            if (!t) return;
            state.editingTxId = id;
            $$('.tx-row').forEach(r => r.classList.remove('editing'));
            row.classList.add('editing');
            $('#type').value = t.type;
            toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.value === t.type));
            $('#amount').value = t.amount;
            $('#category').value = t.category;
            $('#date').value = t.date;
            $('#description').value = t.description || '';
            $('#submit-btn').textContent = 'Guardar';
            $('#cancel-edit').style.display = 'inline-block';
            toggleTxForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    el.querySelectorAll('.tx-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.tx-row');
            const id = Number(btn.dataset.id);
            const ok = await showConfirm('¿Eliminar esta transacción?');
            if (!ok) return;
            row.classList.add('anim-row-exit');
            await new Promise(r => setTimeout(r, 280));
            await api('DELETE', '/transactions/' + id);
            showToast('Transacción eliminada', 'success');
            await loadAll();
            renderChart();
        });
    });
}

$('#apply-filters')?.addEventListener('click', renderTxList);
$('#filter-type')?.addEventListener('change', renderTxList);
$('#filter-search')?.addEventListener('input', renderTxList);

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
        el.innerHTML = emptyStateHTML('#', 'Sin presupuestos', 'Crea presupuestos mensuales para controlar tus gastos por categoría.');
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
            const ok = await showConfirm('¿Eliminar este presupuesto?');
            if (!ok) return;
            const card = btn.closest('.budget-card');
            if (card) { card.style.opacity = '0'; card.style.transform = 'translateX(-20px)'; card.style.transition = 'all 0.25s ease-out'; }
            await new Promise(r => setTimeout(r, 280));
            await api('DELETE', '/budgets/' + btn.dataset.id);
            showToast('Presupuesto eliminado', 'success');
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
    const catField = $('#budget-category');
    const amtField = $('#budget-amount');
    const monthField = $('#budget-month');

    let valid = true;
    if (!validateRequired(catField, 'La categoría')) valid = false;
    if (!validatePositive(amtField, 'El presupuesto')) valid = false;
    if (!validateRequired(monthField, 'El mes')) valid = false;
    if (!valid) return;

    const data = {
        category: catField.value.trim(),
        amount: parseFloat(amtField.value),
        month: monthField.value,
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
        showToast(id ? 'Presupuesto actualizado' : 'Presupuesto creado', 'success');
        await loadAll();
    } catch (err) { showToast(err.message, 'error'); }
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
        el.innerHTML = emptyStateHTML('📊', 'Sin gastos', 'Agrega transacciones de tipo gasto para ver el resumen por categoría.');
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

function drawPieChart(data) {
    const canvas = $('#pie-chart');
    const empty = $('#pie-empty');
    if (!canvas) return;
    const wrap = canvas.parentElement;

    pieHover = -1;
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
        '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa',
        '#f97316', '#06b6d4', '#ec4899', '#10b981', '#6366f1',
    ];

    const hoverRingColor = 'rgba(255,255,255,0.25)';

    const segs = [];
    const segGap = data.length > 1 ? 0.025 : 0;
    const animDuration = 800;
    let animStart = null;

    function easeOutBack(t) {
        const c = 1.7;
        return 1 + c * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }

    function renderFrame(ts) {
        if (!animStart) animStart = ts;
        const elapsed = ts - animStart;
        const t = Math.min(elapsed / animDuration, 1);
        const progress = easeOutBack(t);

        ctx.clearRect(0, 0, w, h);

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

            /* Segment body */
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, drawStart, drawStart + drawAngle);
            ctx.arc(cx, cy, innerR, drawStart + drawAngle, drawStart, true);
            ctx.closePath();

            ctx.fillStyle = c;
            ctx.globalAlpha = isHovered ? 1 : 0.78;
            ctx.fill();
            ctx.globalAlpha = 1;

            /* Subtle stroke between segments */
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, drawStart, drawStart + drawAngle);
            ctx.arc(cx, cy, innerR, drawStart + drawAngle, drawStart, true);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();

            /* Hover ring accent */
            if (isHovered) {
                ctx.beginPath();
                ctx.arc(cx, cy, outerR + 2, drawStart, drawStart + drawAngle);
                ctx.arc(cx, cy, innerR - 2, drawStart + drawAngle, drawStart, true);
                ctx.closePath();
                ctx.strokeStyle = hoverRingColor;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }

            ctx.restore();
            start += angle;
        });

        /* Center hole — thin accent ring */
        ctx.beginPath();
        ctx.arc(cx, cy, innerR + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        /* Center text */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (pieHover >= 0 && data[pieHover]) {
            const hd = data[pieHover];
            const pct = ((hd[1] / total) * 100).toFixed(1);
            ctx.font = '600 18px "Fira Code", monospace';
            ctx.fillStyle = colors[pieHover % colors.length];
            ctx.fillText(fmt(hd[1]), cx, cy - 12);
            ctx.font = '500 11px "Fira Sans", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(hd[0], cx, cy + 10);
            ctx.font = '600 10px "Fira Code", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(pct + '%', cx, cy + 26);
        } else {
            ctx.font = '300 10px "Fira Sans", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText('TOTAL', cx, cy - 14);
            ctx.font = '700 18px "Fira Code", monospace';
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
        el.innerHTML = emptyStateHTML('◎', 'Sin meta activa', 'Crea una meta de ahorro para verla aquí.');
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
        el.innerHTML = emptyStateHTML('◎', 'Sin metas de ahorro', 'Define una meta financiera y haz seguimiento a tu progreso.');
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
                const ok = await showConfirm('¿Eliminar esta meta de ahorro?');
                if (!ok) return;
                const card = btn.closest('.goal-card');
                if (card) { card.style.opacity = '0'; card.style.transform = 'translateX(-20px)'; card.style.transition = 'all 0.25s ease-out'; }
                await new Promise(r => setTimeout(r, 280));
                await api('DELETE', '/savings-goals/' + btn.dataset.id);
                showToast('Meta eliminada', 'success');
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
    const nameField = $('#goal-name');
    const targetField = $('#goal-target');

    let valid = true;
    if (!validateRequired(nameField, 'El nombre')) valid = false;
    if (!validatePositive(targetField, 'La meta')) valid = false;
    if (!valid) return;

    const data = {
        name: nameField.value.trim(),
        target_amount: parseFloat(targetField.value),
        current_amount: parseFloat($('#goal-current').value) || 0,
        deadline: $('#goal-deadline').value || null,
    };
    try {
        await api('POST', '/savings-goals/', data);
        $('#goal-form').style.display = 'none';
        await loadAll();
        showToast('Meta de ahorro creada', 'success');
    } catch (err) { showToast(err.message, 'error'); }
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
