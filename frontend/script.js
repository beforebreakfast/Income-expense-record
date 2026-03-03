const API_URL = "https://income-expense-record.onrender.com/api/transactions";

const STORAGE_KEY = "finance_state_v2";
const CURRENCY = "฿";

const DEFAULT_STATE = {
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

let state = structuredClone(DEFAULT_STATE);

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const money = (n) => `${CURRENCY}${Number(n || 0).toLocaleString()}.00`;
const moneyPlain = (n) => `${CURRENCY}${Number(n || 0).toLocaleString()}`;

const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function normalizeState(input) {
  const s = structuredClone(DEFAULT_STATE);

  if (input && typeof input === "object") {
    if (Array.isArray(input.transactions)) s.transactions = input.transactions.filter(Boolean);
    if (input.card && typeof input.card === "object") {
      s.card.name = typeof input.card.name === "string" ? input.card.name : s.card.name;
      s.card.number = typeof input.card.number === "string" ? input.card.number : s.card.number;
      s.card.limit = Math.max(0, Number(input.card.limit || 0));
    }
    if (input.ui && typeof input.ui === "object") {
      s.ui.period = typeof input.ui.period === "string" ? input.ui.period : s.ui.period;
      s.ui.overview = typeof input.ui.overview === "string" ? input.ui.overview : s.ui.overview;
      s.ui.date = typeof input.ui.date === "string" ? input.ui.date : s.ui.date;
      s.ui.expenseTab = typeof input.ui.expenseTab === "string" ? input.ui.expenseTab : s.ui.expenseTab;

      if (input.ui.sort && typeof input.ui.sort === "object") {
        const key = input.ui.sort.key;
        const dir = input.ui.sort.dir;
        s.ui.sort.key = ["date", "amount", "category"].includes(key) ? key : s.ui.sort.key;
        s.ui.sort.dir = dir === "asc" || dir === "desc" ? dir : s.ui.sort.dir;
      }
    }
  }

  // sanitize transactions
  s.transactions = s.transactions
    .map((t) => {
      if (!t || typeof t !== "object") return null;
      const id = Number(t.id || Date.now());
      const date = typeof t.date === "string" ? t.date : new Date().toISOString().split("T")[0];
      const category = typeof t.category === "string" ? t.category : "Other";
      const amount = Number(t.amount || 0);
      const status = typeof t.status === "string" ? t.status : "Success";
      const type = typeof t.type === "string" ? t.type : amount >= 0 ? "income" : "expense";
      const description = typeof t.description === "string" ? t.description : "";
      return { id, date, category, amount, status, type, description };
    })
    .filter(Boolean);

  return s;
}

async function loadState() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    state.transactions = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("โหลดข้อมูลจาก backend ไม่ได้:", err);
    state.transactions = [];
  }
}

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
  const d = state.ui?.date ? new Date(state.ui.date) : new Date();
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
  const from = fromDate.getTime();
  const to = toDate.getTime();
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

  $("#allExpensesTotal") && ($("#allExpensesTotal").textContent = money(monthlyExpense));

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
  const MAX_H = 180;
  const MIN_H = 18;

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
        <div class="tooltip-row income"><span>Income:</span><span class="tooltip-amount">${moneyPlain(Math.round(d.income))}</span></div>
        <div class="tooltip-row expense"><span>Expenses:</span><span class="tooltip-amount">${moneyPlain(Math.round(d.expense))}</span></div>
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

  $(".income-amount") && ($(".income-amount").textContent = money(income));
  $(".expense-amount") && ($(".expense-amount").textContent = money(expense));

  $("#spendingLimitDisplay") && ($("#spendingLimitDisplay").textContent = money(state.card.limit));
  $("#spendingUsedDisplay") && ($("#spendingUsedDisplay").textContent = `used from ${money(expense)}`);

  const pct = state.card.limit > 0 ? (expense / state.card.limit) * 100 : 0;
  $("#progressFill") && ($("#progressFill").style.width = `${Math.min(Math.max(pct, 0), 100)}%`);

  $("#cardNameDisplay") && ($("#cardNameDisplay").textContent = state.card.name || "-");
  $("#cardNumberDisplay") && ($("#cardNumberDisplay").textContent = state.card.number || "0000 0000 0000 0000");

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

  for (const t of rows) {
    const tr = document.createElement("tr");
    const formattedDate = new Date(t.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const amt = t.amount > 0 ? `+${money(Math.abs(+t.amount))}` : `-${money(Math.abs(+t.amount))}`;

    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>${t.category}</td>
      <td style="color:${t.amount > 0 ? "#10b981" : "#ef4444"}">${amt}</td>
      <td><span class="status-success">${t.status}</span></td>
      <td>
        <button class="action-btn" type="button" data-action-id="${t._id}">
          <i class="fas fa-ellipsis-h"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  $$(".action-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionTxId = btn.getAttribute("data-action-id");
      openActionMenuAt(e.clientX, e.clientY);
    });
  });
}

async function addIncome() {
  const amount = parseFloat($("#incomeAmount")?.value);
  const category = $("#incomeCategory")?.value;
  const description = $("#incomeDescription")?.value || "";
  const date = $("#incomeDate")?.value;

  if (!amount || !category || !date) return;

  const newTx = {
    date,
    category,
    amount: Math.abs(amount),
    status: "Success",
    type: "income",
    description,
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx),
    });

    const saved = await res.json();
    state.transactions.unshift(saved);

    updateDashboard();
    updateTransactionsTable();
    closeModal("incomeModal");
    $("#incomeForm")?.reset();
  } catch (err) {
    console.error("เพิ่มรายรับไม่สำเร็จ:", err);
  }
}

async function addExpense() {
  const amount = parseFloat($("#expenseAmount")?.value);
  const category = $("#expenseCategory")?.value;
  const description = $("#expenseDescription")?.value || "";
  const date = $("#expenseDate")?.value;

  if (!amount || !category || !date) return;

  const newTx = {
    date,
    category,
    amount: -Math.abs(amount),
    status: "Success",
    type: "expense",
    description,
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx),
    });

    const saved = await res.json();
    state.transactions.unshift(saved);

    updateDashboard();
    updateTransactionsTable();
    closeModal("expenseModal");
    $("#expenseForm")?.reset();
  } catch (err) {
    console.error("เพิ่มรายจ่ายไม่สำเร็จ:", err);
  }
}

function wireButtons() {
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
    const name = (($("#cardNameInput")?.value || "-") + "").trim();
    const number = (($("#cardNumberInput")?.value || "0000 0000 0000 0000") + "").trim();
    const limit = Math.max(0, Number($("#cardLimitInput")?.value || 0));

    state.card.name = name.length ? name : "-";
    state.card.number = number.length ? number : "0000 0000 0000 0000";
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

  const overviewPeriodBtn = $("#overviewPeriodBtn");
  if (overviewPeriodBtn) {
    overviewPeriodBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overviewPeriodBtn.parentElement?.classList.toggle("open");
    });
  }
  if ($("#overviewPeriodMenu")) {
    $$("#overviewPeriodMenu .menu-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-overview");
        state.ui.overview = p;
        $("#overviewPeriodLabel") && ($("#overviewPeriodLabel").textContent = p);
        overviewPeriodBtn?.parentElement?.classList.remove("open");
        saveState();
        renderOverview();
      });
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

  $$("#expenseTabs .period-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#expenseTabs .period-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.ui.expenseTab = btn.getAttribute("data-tab");
      saveState();
      updateAllExpenses();
    });
  });

  $("#deleteTxBtn")?.addEventListener("click", async () => {
    if (!actionTxId) return;

    try {
      await fetch(`${API_URL}/${actionTxId}`, {
        method: "DELETE",
      });

      await loadState();

      closeActionMenu();
      updateDashboard();
      updateTransactionsTable();
    } catch (err) {
      console.error("ลบไม่สำเร็จ:", err);
    }
  });
}

function wireGlobalClose() {
  document.addEventListener("click", () => {
    closeActionMenu();
    $("#overviewPeriodBtn")?.parentElement?.classList.remove("open");
  });

  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        m.classList.remove("open");
        document.body.style.overflow = "auto";
      }
    });
  });
}

function initDates() {
  const today = new Date().toISOString().split("T")[0];
  if (!state.ui.date) state.ui.date = today;

  $("#incomeDate") && ($("#incomeDate").value = today);
  $("#expenseDate") && ($("#expenseDate").value = today);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadState();

  $("#overviewPeriodLabel") && ($("#overviewPeriodLabel").textContent = state.ui.overview || "Yearly");
  $("#sortLabel") && ($("#sortLabel").textContent = "Sort");

  initDates();
  wireButtons();
  wireGlobalClose();

  updateDashboard();
  updateTransactionsTable();
});