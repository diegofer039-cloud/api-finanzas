const API = '';

let editingId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    loadTransactions();
    loadSummary();

    document.getElementById('transaction-form').addEventListener('submit', handleSubmit);
    document.getElementById('apply-filters').addEventListener('click', loadTransactions);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
});

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
    } catch (e) {
        document.getElementById('transactions-list').innerHTML =
            '<p class="empty">Error al cargar transacciones</p>';
    }
}

async function loadSummary() {
    const year = new Date().getFullYear();
    try {
        const res = await fetch(`${API}/transactions/summary/monthly?year=${year}`);
        const data = await res.json();
        updateDashboard(data);
    } catch (e) {
        // no-op
    }
}

function updateDashboard(months) {
    let totalIngresos = 0;
    let totalGastos = 0;

    for (const m of months) {
        totalIngresos += m.total_ingresos;
        totalGastos += m.total_gastos;
    }

    const balance = totalIngresos - totalGastos;

    document.getElementById('total-ingresos').textContent = formatMoney(totalIngresos);
    document.getElementById('total-gastos').textContent = formatMoney(totalGastos);
    document.getElementById('total-balance').textContent = formatMoney(balance);
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');

    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty">No hay transacciones aún</p>';
        return;
    }

    container.innerHTML = transactions.map(tx => `
        <div class="tx-item ${tx.type}">
            <div class="tx-info">
                <div class="tx-category">${escapeHtml(tx.category)}</div>
                ${tx.description ? `<div class="tx-description">${escapeHtml(tx.description)}</div>` : ''}
                <div class="tx-meta">
                    <span>${tx.type === 'ingreso' ? '📈 Ingreso' : '📉 Gasto'}</span>
                    <span>📅 ${tx.date}</span>
                </div>
            </div>
            <div class="tx-amount ${tx.type}">${formatMoney(tx.amount)}</div>
            <div class="tx-actions">
                <button class="btn-edit" onclick="editTransaction(${tx.id})">✏️</button>
                <button class="btn-danger" onclick="deleteTransaction(${tx.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function handleSubmit(e) {
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
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } else {
            await fetch(`${API}/transactions/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        }

        document.getElementById('transaction-form').reset();
        document.getElementById('date').valueAsDate = new Date();
        cancelEdit();
        await loadTransactions();
        await loadSummary();
    } catch (e) {
        alert('Error al guardar la transacción');
    }
}

async function editTransaction(id) {
    try {
        const res = await fetch(`${API}/transactions/${id}`);
        const tx = await res.json();

        document.getElementById('type').value = tx.type;
        document.getElementById('amount').value = tx.amount;
        document.getElementById('category').value = tx.category;
        document.getElementById('description').value = tx.description || '';
        document.getElementById('date').value = tx.date;

        editingId = id;
        document.querySelector('#form-section h2').textContent = 'Editar Transacción';
        document.querySelector('.btn-primary').textContent = 'Guardar';
        document.getElementById('cancel-edit').style.display = 'inline-block';
    } catch (e) {
        alert('Error al cargar la transacción');
    }
}

function cancelEdit() {
    editingId = null;
    document.querySelector('#form-section h2').textContent = 'Nueva Transacción';
    document.querySelector('.btn-primary').textContent = 'Agregar';
    document.getElementById('cancel-edit').style.display = 'none';
    document.getElementById('transaction-form').reset();
    document.getElementById('date').valueAsDate = new Date();
}

async function deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;

    try {
        await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
        await loadTransactions();
        await loadSummary();
    } catch (e) {
        alert('Error al eliminar');
    }
}

function formatMoney(n) {
    return '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
