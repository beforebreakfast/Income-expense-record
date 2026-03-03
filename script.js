const API_URL = "https://income-expense-record.onrender.com/api/transactions";
const CURRENCY = "฿";

let state = {
  transactions: [],
  card: { name: "-", number: "0000 0000 0000 0000", limit: 0 },
  ui: { sort: { key: "date", dir: "desc" } }
};

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const money = (n) => `${CURRENCY}${Number(n || 0).toLocaleString()}`;

async function fetchTransactions() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    state.transactions = data;
    updateDashboard();
    updateTransactionsTable();
  } catch (err) {
    console.error("Error loading transactions:", err);
  }
}

async function addTransaction(type) {
  const amountInput = type === "income" ? "#incomeAmount" : "#expenseAmount";
  const categoryInput = type === "income" ? "#incomeCategory" : "#expenseCategory";
  const dateInput = type === "income" ? "#incomeDate" : "#expenseDate";
  const descInput = type === "income" ? "#incomeDescription" : "#expenseDescription";

  const amount = parseFloat($(amountInput).value);
  const category = $(categoryInput).value;
  const date = $(dateInput).value;
  const description = $(descInput)?.value || "";

  if (!amount || !category || !date) return;

  const newTx = {
    date,
    category,
    amount: type === "income" ? Math.abs(amount) : -Math.abs(amount),
    type,
    status: "Success",
    description
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx)
    });

    fetchTransactions();
  } catch (err) {
    console.error("Error adding transaction:", err);
  }
}

async function deleteTransaction(id) {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });
    fetchTransactions();
  } catch (err) {
    console.error("Error deleting:", err);
  }
}

function updateDashboard() {
  const income = state.transactions
    .filter(t => t.amount > 0)
    .reduce((a, t) => a + t.amount, 0);

  const expense = state.transactions
    .filter(t => t.amount < 0)
    .reduce((a, t) => a + Math.abs(t.amount), 0);

  $(".income-amount") && ($(".income-amount").textContent = money(income));
  $(".expense-amount") && ($(".expense-amount").textContent = money(expense));
}

function updateTransactionsTable() {
  const tbody = $("#txBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.transactions.forEach(t => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(t.date).toLocaleDateString()}</td>
      <td>${t.category}</td>
      <td style="color:${t.amount > 0 ? "#10b981" : "#ef4444"}">
        ${t.amount > 0 ? "+" : "-"}${money(Math.abs(t.amount))}
      </td>
      <td>${t.status || "Success"}</td>
      <td>
        <button onclick="deleteTransaction('${t._id}')">
          Delete
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("#saveIncomeBtn")?.addEventListener("click", () => addTransaction("income"));
  $("#saveExpenseBtn")?.addEventListener("click", () => addTransaction("expense"));

  fetchTransactions();
});