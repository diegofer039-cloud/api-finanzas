const API = '';
let editingId = null;
let editingBudgetId = null;

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    const m = new Date();
    document.getElementById('budget-month').value = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`;

    setupTabs();
    setupToggle();
    setupForms();
    setupExport();
    loadAll();
});

function loadAll() {
    loadDashboard();
    loadTransactions();
    loadBudgets();
    loadCategories();
    loadCategorySuggestions();
}

/* ─── Tabs ─── */
function setupTabs() {
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            if (btn.dataset.tab === 'categories') drawChart();
            if (btn.dataset.tab === 'budgets') loadBudgets();
        });
    });
}

/* ─── Toggle (Ingreso/Gasto) ─── */
function setupToggle() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('type').value = btn.dataset.value;
        });
    });
}

/* ─── Forms ─── */
function setupForms() {
    document.getElementById('transaction-form').addEventListener('submit', handleTxSubmit);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('apply-filters').addEventListener('click', loadTransactions);
    document.getElementById('add-budget-btn').addEventListener('click', () => {
        document.getElementById('budget-form').style.display = 'block';
        document.getElementById('budget-category').focus();
    });
    document.getElementById('cancel-budget').addEventListener('click', cancelBudgetForm);
    document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);
}

/* ─── Dashboard ─── */
async function loadDashboard() {
    const year = new Date().getFullYear();
    try {
        const res = await fetch(`${API}/transactions/summary/monthly?year=${year}`);
        const data = await res.json();
        let totalIngresos = 0, totalGastos = 0;
        for (const m of data) { totalIngresos += m.total_ingresos; totalGastos += m.total_gastos; }
        const balance = totalIngresos - totalGastos;
        document.getElementById('total-ingresos').textContent = fmt(totalIngresos);
        document.getElementById('total-gastos').textContent = fmt(totalGastos);
        document.getElementById('total-balance').textContent = fmt(balance);
    } catch {}
}

/* ─── Transactions ─── */
async function loadTransactions() {
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const dateFrom = document.getElementById('filter-from').value;
    const dateTo = document.getElementById('filter-to').value;
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    try {
        const res = await fetch(`${API}/transactions/?${params}`);
        const data = await res.json();
        renderTransactions(data);
    } catch {
        document.getElementById('transactions-list').innerHTML =
            '<div class="empty-state">Error al cargar transacciones</div>';
    }
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay transacciones aún — agrega una arriba</div>';
        return;
    }
    container.innerHTML = transactions.map((tx, i) => `
        <div class="tx-item ${tx.type}" style="animation-delay:${i*30}ms">
            <div class="tx-main">
                <div class="tx-category">${esc(tx.category)}</div>
                ${tx.description ? `<div class="tx-description">${esc(tx.description)}</div>` : ''}
                <div class="tx-meta">
                    <span>${tx.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
                    <span>${tx.date}</span>
                </div>
            </div>
            <div class="tx-amount ${tx.type}">${fmt(tx.amount)}</div>
            <div class="tx-actions">
                <button class="btn-sm" onclick="editTx(${tx.id})">Editar</button>
                <button class="btn-sm danger" onclick="deleteTx(${tx.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function handleTxSubmit(e) {
    e.preventDefault();
    const data = {
        type: document.getElementById('type').value,
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value.trim(),
        description: document.getElementById('description').value.trim() || null,
        date: document.getElementById('date').value,
    };

    try {
        if (editingId) {
            await fetch(`${API}/transactions/${editingId}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API}/transactions/`, {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
            });
        }
        document.getElementById('transaction-form').reset();
        document.getElementById('date').valueAsDate = new Date();
        cancelEdit();
        await loadAll();
    } catch { alert('Error al guardar'); }
}

async function editTx(id) {
    try {
        const res = await fetch(`${API}/transactions/${id}`);
        const tx = await res.json();
        document.getElementById('type').value = tx.type;
        document.querySelectorAll('.toggle-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === tx.type);
        });
        document.getElementById('amount').value = tx.amount;
        document.getElementById('category').value = tx.category;
        document.getElementById('description').value = tx.description || '';
        document.getElementById('date').value = tx.date;
        editingId = id;
        document.getElementById('submit-btn').textContent = 'Guardar';
        document.getElementById('cancel-edit').style.display = 'inline-block';
        document.getElementById('transaction-form').scrollIntoView({behavior:'smooth'});
    } catch { alert('Error al cargar'); }
}

function cancelEdit() {
    editingId = null;
    document.getElementById('submit-btn').textContent = 'Agregar';
    document.getElementById('cancel-edit').style.display = 'none';
}

async function deleteTx(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
        await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
        await loadAll();
    } catch { alert('Error al eliminar'); }
}

/* ─── Budgets ─── */
async function loadBudgets() {
    try {
        const res = await fetch(`${API}/budgets/`);
        const data = await res.json();
        renderBudgets(data);
    } catch {
        document.getElementById('budgets-list').innerHTML =
            '<div class="empty-state">Error al cargar presupuestos</div>';
    }
}

function renderBudgets(budgets) {
    const container = document.getElementById('budgets-list');
    if (budgets.length === 0) {
        container.innerHTML = '<div class="empty-state">Sin presupuestos — crea uno para controlar tus gastos</div>';
        return;
    }
    container.innerHTML = budgets.map((b, i) => {
        const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
        const status = pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok';
        return `
        <div class="budget-card" style="animation-delay:${i*40}ms">
            <div class="budget-header">
                <span class="budget-category">${esc(b.category)}</span>
                <span class="budget-month">${b.month}</span>
            </div>
            <div class="budget-bar-wrap">
                <div class="budget-bar ${status}" style="width:${Math.min(pct,100)}%"></div>
            </div>
            <div class="budget-numbers">
                <span class="spent">${fmt(b.spent)} de ${fmt(b.amount)}</span>
                <span class="remaining ${status}">${fmt(b.remaining)} restan</span>
            </div>
            <div class="budget-actions">
                <button class="btn-sm" onclick="editBudget(${b.id})">Editar</button>
                <button class="btn-sm danger" onclick="deleteBudget(${b.id})">Eliminar</button>
            </div>
        </div>`;
    }).join('');
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    const data = {
        category: document.getElementById('budget-category').value.trim(),
        amount: parseFloat(document.getElementById('budget-amount').value),
        month: document.getElementById('budget-month').value,
    };

    try {
        if (editingBudgetId) {
            await fetch(`${API}/budgets/${editingBudgetId}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API}/budgets/`, {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
            });
        }
        cancelBudgetForm();
        await loadBudgets();
    } catch (e) {
        const msg = e.response ? await e.response.text() : 'Error';
        alert(msg);
    }
}

function editBudget(id) {
    fetch(`${API}/budgets/${id}`).then(r => r.json()).then(b => {
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-amount').value = b.amount;
        document.getElementById('budget-month').value = b.month;
        editingBudgetId = id;
        document.getElementById('add-budget-btn').textContent = 'Guardar';
        document.getElementById('budget-form').style.display = 'block';
        document.getElementById('budget-form').scrollIntoView({behavior:'smooth'});
    });
}

function cancelBudgetForm() {
    editingBudgetId = null;
    document.getElementById('budget-form').style.display = 'none';
    document.getElementById('budget-form').reset();
    document.getElementById('add-budget-btn').textContent = '+ Nuevo';
}

async function deleteBudget(id) {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    await fetch(`${API}/budgets/${id}`, { method: 'DELETE' });
    await loadBudgets();
}

/* ─── Categories + Chart ─── */
async function loadCategories() {
    const month = document.getElementById('cat-month-filter').value;
    const params = month ? `?month=${month}` : '';
    try {
        const res = await fetch(`${API}/categories/${params}`);
        const data = await res.json();
        renderCategories(data);
        drawChart(data);
    } catch {
        document.getElementById('categories-list').innerHTML =
            '<div class="empty-state">Error al cargar</div>';
    }
}

function renderCategories(categories) {
    const container = document.getElementById('categories-list');
    if (categories.length === 0) {
        container.innerHTML = '<div class="empty-state">Sin datos — agrega transacciones primero</div>';
        return;
    }
    container.innerHTML = categories.map((c, i) => `
        <div class="cat-item" style="animation-delay:${i*30}ms">
            <div>
                <div class="cat-name">${esc(c.category)}</div>
                <div class="cat-count">${c.count} transacciones</div>
            </div>
            <div class="cat-amounts">
                ${c.total_gastos > 0 ? `<span class="cat-gasto">-${fmt(c.total_gastos)}</span>` : ''}
                ${c.total_ingresos > 0 ? `<span class="cat-ingreso">+${fmt(c.total_ingresos)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function drawChart(categories) {
    const canvas = document.getElementById('spending-chart');
    const ctx = canvas.getContext('2d');
    const empty = document.getElementById('chart-empty');

    const gastos = (categories || []).filter(c => c.total_gastos > 0);
    if (gastos.length === 0) {
        empty.style.display = 'block';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    empty.style.display = 'none';

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width - 32;
    const h = 260;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35;
    const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#ec4899','#06b6d4','#a855f7','#f97316'];
    const total = gastos.reduce((s, c) => s + c.total_gastos, 0);
    let start = -Math.PI / 2;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < gastos.length; i++) {
        const slice = (gastos[i].total_gastos / total) * Math.PI * 2;
        const color = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + slice);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        const mid = start + slice / 2;
        const lx = cx + Math.cos(mid) * (r + 14);
        const ly = cy + Math.sin(mid) * (r + 14);
        ctx.fillStyle = '#8888a0';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pct = Math.round((gastos[i].total_gastos / total) * 100);
        if (pct > 3) ctx.fillText(`${pct}%`, lx, ly);

        start += slice;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#12121a';
    ctx.fill();
}

async function loadCategorySuggestions() {
    try {
        const res = await fetch(`${API}/categories/`);
        const data = await res.json();
        const dl = document.getElementById('category-list');
        dl.innerHTML = data.map(c => `<option value="${esc(c.category)}">`).join('');
    } catch {}
}

/* ─── Export ─── */
function setupExport() {
    document.getElementById('export-btn').addEventListener('click', () => {
        window.open(`${API}/transactions/export/csv`, '_blank');
    });
}

/* ─── Populate month filter ─── */
(function populateMonthFilter() {
    const sel = document.getElementById('cat-month-filter');
    const y = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
        const v = `${y}-${String(m).padStart(2,'0')}`;
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', loadCategories);
})();

/* ─── Utils ─── */
function fmt(n) { return '$' + Number(n).toLocaleString('es-CO', {minimumFractionDigits:0, maximumFractionDigits:0}); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
