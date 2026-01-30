// script.js (compact)
const STORAGE_KEY = "finance_state_v2";
const CURRENCY = "฿";

let state = {
  transactions: [],
  card: { name: "-", number: "0000 0000 0000 0000", limit: 0 },
  ui: {
    sort: { key: "date", dir: "desc" },
    period: "Daily",
    overview: "Yearly",
    date: null,
    expenseTab: "Monthly",
  },
};

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const money = (n) => `${CURRENCY}${Number(n || 0).toLocaleString()}.00`;
const moneyPlain = (n) => `${CURRENCY}${Number(n || 0).toLocaleString()}`;

const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") state = parsed;
  } catch {}
};

const openModal = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
};
const closeModal = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("open");
  document.body.style.overflow = "auto";
};

const getActiveDate = () => {
  const d = state.ui.date ? new Date(state.ui.date) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};
const getActiveYM = () => {
  const d = getActiveDate();
  return { y: d.getFullYear(), m: d.getMonth() };
};
const inSameMonth = (dateStr, y, m) => {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
};

const sumMonthIncome = (y, m) =>
  state.transactions.reduce((a, t) => (t.amount > 0 && inSameMonth(t.date, y, m) ? a + (+t.amount || 0) : a), 0);

const sumMonthExpense = (y, m) =>
  state.transactions.reduce((a, t) => (t.amount < 0 && inSameMonth(t.date, y, m) ? a + Math.abs(+t.amount || 0) : a), 0);

const sumRangeExpense = (fromDate, toDate) => {
  const from = fromDate.getTime(),
    to = toDate.getTime();
  return state.transactions.reduce((a, t) => {
    const d = new Date(t.date).getTime();
    if (isNaN(d) || d < from || d > to || t.amount >= 0) return a;
    return a + Math.abs(+t.amount || 0);
  }, 0);
};

function updateAllExpenses() {
  const active = getActiveDate();
  const end = new Date(active);
  end.setHours(23, 59, 59, 999);

  const startDaily = new Date(active);
  startDaily.setHours(0, 0, 0, 0);

  const startWeekly = new Date(active);
  startWeekly.setDate(startWeekly.getDate() - 6);
  startWeekly.setHours(0, 0, 0, 0);

  const { y, m } = getActiveYM();
  const monthlyExpense = sumMonthExpense(y, m);
  const dailyExpense = sumRangeExpense(startDaily, end);
  const weeklyExpense = sumRangeExpense(startWeekly, end);

  const totalEl = $("#allExpensesTotal");
  if (totalEl) totalEl.textContent = money(monthlyExpense);

  const pv = $$("#periodValues span");
  if (pv.length >= 3) {
    pv[0].textContent = moneyPlain(Math.round(dailyExpense));
    pv[1].textContent = moneyPlain(Math.round(weeklyExpense));
    pv[2].textContent = moneyPlain(Math.round(monthlyExpense));
  }

  const cats = {};
  for (const t of state.transactions) {
    if (t.amount < 0 && inSameMonth(t.date, y, m)) {
      cats[t.category] = (cats[t.category] || 0) + Math.abs(+t.amount || 0);
    }
  }
  $$("#categoryList [data-cat]").forEach((el) => {
    const key = el.getAttribute("data-cat");
    el.textContent = String(Math.round(cats[key] || 0));
  });
}

function renderOverview() {
  const wrap = $("#chartBars");
  if (!wrap) return;

  const monthsRow = $(".chart-months");
  if (monthsRow) {
    const labels = Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" })
    );
    monthsRow.innerHTML = labels.map((t) => `<span>${t}</span>`).join("");
  }

  const active = getActiveDate();
  const year = active.getFullYear();
  const activeMonth = active.getMonth();

  const data = Array.from({ length: 12 }, (_, m) => {
    const income = sumMonthIncome(year, m);
    const expense = sumMonthExpense(year, m);
    return { m, income, expense, total: income + expense };
  });

  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const MAX_H = 180,
    MIN_H = 18;

  wrap.innerHTML = "";
  data.forEach((d) => {
    const bar = document.createElement("div");
    bar.className = "chart-bar" + (d.m === activeMonth ? " active" : "");

    const totalH = Math.round((d.total / maxTotal) * MAX_H);
    const incomeH = Math.round((d.income / maxTotal) * MAX_H);
    const expenseH = Math.round((d.expense / maxTotal) * MAX_H);

    bar.style.height = `${Math.max(MIN_H, totalH)}px`;

    const monthLabel = new Date(year, d.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    bar.innerHTML = `
      <div class="tooltip">
        <div class="tooltip-month">${monthLabel}</div>
        <div class="tooltip-row income"><span>Income:</span><span class="tooltip-amount">${moneyPlain(
          Math.round(d.income)
        )}</span></div>
        <div class="tooltip-row expense"><span>Expenses:</span><span class="tooltip-amount">${moneyPlain(
          Math.round(d.expense)
        )}</span></div>
      </div>
      <div class="chart-bar-income" style="height:${incomeH}px;"></div>
      <div class="chart-bar-expense" style="height:${expenseH}px;"></div>
    `;

    bar.addEventListener("mouseenter", () => {
      $$(".chart-bar", wrap).forEach((b) => b.classList.remove("active"));
      bar.classList.add("active");
    });

    wrap.appendChild(bar);
  });
}

function updateDashboard() {
  const { y, m } = getActiveYM();
  const income = sumMonthIncome(y, m);
  const expense = sumMonthExpense(y, m);

  const incomeEl = $(".income-amount");
  const expenseEl = $(".expense-amount");
  if (incomeEl) incomeEl.textContent = money(income);
  if (expenseEl) expenseEl.textContent = money(expense);

  const limitEl = $("#spendingLimitDisplay");
  const usedEl = $("#spendingUsedDisplay");
  const fillEl = $("#progressFill");

  if (limitEl) limitEl.textContent = money(state.card.limit);
  if (usedEl) usedEl.textContent = `used from ${money(expense)}`;

  const pct = state.card.limit > 0 ? (expense / state.card.limit) * 100 : 0;
  if (fillEl) fillEl.style.width = `${Math.min(Math.max(pct, 0), 100)}%`;

  const nameEl = $("#cardNameDisplay");
  const numEl = $("#cardNumberDisplay");
  if (nameEl) nameEl.textContent = state.card.name || "-";
  if (numEl) numEl.textContent = state.card.number || "0000 0000 0000 0000";

  updateAllExpenses();
  renderOverview();
}

function sortedTransactions() {
  const arr = [...state.transactions];
  const { key, dir } = state.ui.sort;
  const mul = dir === "asc" ? 1 : -1;

  arr.sort((a, b) => {
    if (key === "amount") return (a.amount - b.amount) * mul;
    if (key === "category") return String(a.category).localeCompare(String(b.category)) * mul;
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * mul;
  });
  return arr;
}

let actionTxId = null;

function openActionMenuAt(x, y) {
  const menu = $("#actionMenu");
  if (!menu) return;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add("open");
}
function closeActionMenu() {
  const menu = $("#actionMenu");
  if (!menu) return;
  menu.classList.remove("open");
  actionTxId = null;
}

function updateTransactionsTable() {
  const tbody = $("#txBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rows = sortedTransactions().slice(0, 10);
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" style="text-align:center;color:#6b7280;padding:1.25rem 0;">No transactions yet</td>`;
    tbody.appendChild(tr);
    return;
  }

  tbody.innerHTML = rows
    .map((t) => {
      const formattedDate = new Date(t.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const amtAbs = money(Math.abs(+t.amount || 0));
      const amt = t.amount > 0 ? `+${amtAbs}` : `-${amtAbs}`;
      const color = t.amount > 0 ? "#10b981" : "#ef4444";
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${t.category}</td>
          <td style="color:${color}">${amt}</td>
          <td><span class="status-success">${t.status}</span></td>
          <td>
            <button class="action-btn" type="button" data-action-id="${t.id}">
              <i class="fas fa-ellipsis-h"></i>
            </button>
          </td>
        </tr>`;
    })
    .join("");

  $$(".action-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionTxId = Number(btn.getAttribute("data-action-id"));
      openActionMenuAt(e.clientX, e.clientY);
    });
  });
}

function addIncome() {
  const amountEl = $("#incomeAmount");
  const categoryEl = $("#incomeCategory");
  const dateEl = $("#incomeDate");
  if (!amountEl || !categoryEl || !dateEl) return;

  const amount = parseFloat(amountEl.value);
  const category = categoryEl.value;
  const date = dateEl.value;
  const description = $("#incomeDescription")?.value || "";
  if (!amount || !category || !date) return;

  state.transactions.unshift({
    id: Date.now(),
    date,
    category,
    amount: Math.abs(amount),
    status: "Success",
    type: "income",
    description,
  });

  saveState();
  updateDashboard();
  updateTransactionsTable();
  closeModal("incomeModal");
  $("#incomeForm")?.reset();
}

function addExpense() {
  const amountEl = $("#expenseAmount");
  const categoryEl = $("#expenseCategory");
  const dateEl = $("#expenseDate");
  if (!amountEl || !categoryEl || !dateEl) return;

  const amount = parseFloat(amountEl.value);
  const category = categoryEl.value;
  const date = dateEl.value;
  const description = $("#expenseDescription")?.value || "";
  if (!amount || !category || !date) return;

  state.transactions.unshift({
    id: Date.now(),
    date,
    category,
    amount: -Math.abs(amount),
    status: "Success",
    type: "expense",
    description,
  });

  saveState();
  updateDashboard();
  updateTransactionsTable();
  closeModal("expenseModal");
  $("#expenseForm")?.reset();
}

function initDates() {
  const today = new Date().toISOString().split("T")[0];
  if (!state.ui.date) state.ui.date = today;

  $("#incomeDate") && ($("#incomeDate").value = today);
  $("#expenseDate") && ($("#expenseDate").value = today);

  const dateInput = $("#dateInput");
  if (dateInput) {
    dateInput.value = state.ui.date;
    dateInput.dispatchEvent(new Event("change"));
  }
}

function wireUI() {
  $("#addIncomeFab")?.addEventListener("click", () => openModal("incomeModal"));
  $("#addExpenseFab")?.addEventListener("click", () => openModal("expenseModal"));

  $("#saveIncomeBtn")?.addEventListener("click", addIncome);
  $("#saveExpenseBtn")?.addEventListener("click", addExpense);

  $$("[data-close='incomeModal']").forEach((el) => el.addEventListener("click", () => closeModal("incomeModal")));
  $$("[data-close='expenseModal']").forEach((el) => el.addEventListener("click", () => closeModal("expenseModal")));
  $$("[data-close='cardModal']").forEach((el) => el.addEventListener("click", () => closeModal("cardModal")));

  $("#editCardBtn")?.addEventListener("click", () => {
    $("#cardNameInput") && ($("#cardNameInput").value = state.card.name === "-" ? "" : state.card.name);
    $("#cardNumberInput") && ($("#cardNumberInput").value = state.card.number === "0000 0000 0000 0000" ? "" : state.card.number);
    $("#cardLimitInput") && ($("#cardLimitInput").value = String(state.card.limit || 0));
    openModal("cardModal");
  });

  $("#saveCardBtn")?.addEventListener("click", () => {
    const name = (String($("#cardNameInput")?.value || "-")).trim();
    const number = (String($("#cardNumberInput")?.value || "0000 0000 0000 0000")).trim();
    const limit = Math.max(0, Number($("#cardLimitInput")?.value || 0));

    state.card.name = name || "-";
    state.card.number = number || "0000 0000 0000 0000";
    state.card.limit = limit;

    saveState();
    updateDashboard();
    closeModal("cardModal");
  });

  $("#sortBtn")?.addEventListener("click", () => {
    const keyCycle = ["date", "amount", "category"];
    const idx = keyCycle.indexOf(state.ui.sort.key);
    state.ui.sort.key = keyCycle[(idx + 1) % keyCycle.length];
    state.ui.sort.dir = state.ui.sort.dir === "asc" ? "desc" : "asc";
    $("#sortLabel") && ($("#sortLabel").textContent = `Sort (${state.ui.sort.key}:${state.ui.sort.dir})`);
    updateTransactionsTable();
    saveState();
  });

  $("#tableFilterBtn")?.addEventListener("click", () => alert("Filter clicked"));
  $("#overviewFilterBtn")?.addEventListener("click", () => alert("Filter clicked"));

  const periodBtn = $("#periodBtn");
  const overviewPeriodBtn = $("#overviewPeriodBtn");

  periodBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    periodBtn.parentElement?.classList.toggle("open");
    overviewPeriodBtn?.parentElement?.classList.remove("open");
  });
  overviewPeriodBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    overviewPeriodBtn.parentElement?.classList.toggle("open");
    periodBtn?.parentElement?.classList.remove("open");
  });

  $("#periodMenu") &&
    $$("#periodMenu .menu-item").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-period") || "Daily";
        state.ui.period = p;
        $("#periodLabel") && ($("#periodLabel").textContent = p);
        periodBtn?.parentElement?.classList.remove("open");
        saveState();
      })
    );

  $("#overviewPeriodMenu") &&
    $$("#overviewPeriodMenu .menu-item").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-overview") || "Yearly";
        state.ui.overview = p;
        $("#overviewPeriodLabel") && ($("#overviewPeriodLabel").textContent = p);
        overviewPeriodBtn?.parentElement?.classList.remove("open");
        saveState();
        renderOverview();
      })
    );

  const dateBtn = $("#dateBtn");
  const dateInput = $("#dateInput");
  if (dateBtn && dateInput) {
    dateBtn.addEventListener("click", () => (dateInput.showPicker ? dateInput.showPicker() : dateInput.click()));
    dateInput.addEventListener("change", () => {
      state.ui.date = dateInput.value;
      const d = new Date(state.ui.date);
      const label = isNaN(d.getTime())
        ? "-"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      $("#dateLabel") && ($("#dateLabel").textContent = label);
      saveState();
      updateDashboard();
      updateTransactionsTable();
    });
  }

  $("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("#expenseTabs") &&
    $$("#expenseTabs .period-tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#expenseTabs .period-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.ui.expenseTab = btn.getAttribute("data-tab") || "Monthly";
        saveState();
        updateAllExpenses();
      })
    );

  $("#deleteTxBtn")?.addEventListener("click", () => {
    if (!actionTxId) return;
    state.transactions = state.transactions.filter((t) => t.id !== actionTxId);
    closeActionMenu();
    saveState();
    updateDashboard();
    updateTransactionsTable();
  });
}

function wireGlobalClose() {
  document.addEventListener("click", () => {
    closeActionMenu();
    $("#periodBtn")?.parentElement?.classList.remove("open");
    $("#overviewPeriodBtn")?.parentElement?.classList.remove("open");
  });

  $$(".modal").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        m.classList.remove("open");
        document.body.style.overflow = "auto";
      }
    })
  );
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();

  $("#periodLabel") && ($("#periodLabel").textContent = state.ui.period || "Daily");
  $("#overviewPeriodLabel") && ($("#overviewPeriodLabel").textContent = state.ui.overview || "Yearly");
  $("#sortLabel") && ($("#sortLabel").textContent = "Sort");

  initDates();
  wireUI();
  wireGlobalClose();

  updateDashboard();
  updateTransactionsTable();
});