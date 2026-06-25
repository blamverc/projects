let baskets = {};
let activeBasket = null;
let searchCache = [];
let searchTimeout = null;

/* ================= INIT ================= */
window.addEventListener("DOMContentLoaded", () => {

  /* enable/disable create button */
  const input = document.getElementById("newBasketName");
  const btn = document.getElementById("createBtn");

  input.addEventListener("input", () => {
    btn.disabled = input.value.trim().length === 0;
  });

  btn.disabled = true;

  /* live search */
  const searchInput = document.getElementById("searchCoin");

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();

    if (!q) {
      closeSearch();
      return;
    }

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      searchCoin(q);
    }, 300);
  });

  /* click outside closes search */
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("searchWrapper");

    const results = document.getElementById("searchResults");

    if (
      results.style.display === "block" &&
      !wrapper.contains(e.target)
    ) {
      closeSearch();
    }
  });
});

/* ================= SEARCH OPEN ================= */
function openSearch() {
  document.getElementById("searchResults").style.display = "block";
  document.getElementById("closeBtn").style.display = "block";
}

/* ================= SEARCH ================= */
async function searchCoin(q) {
  const box = document.getElementById("searchResults");

  openSearch();

  box.innerHTML = "<p style='padding:10px'>Searching...</p>";

  const data = await fetch(
    `https://api.dexscreener.com/latest/dex/search/?q=${q}`
  ).then(r => r.json());

  if (!data.pairs?.length) {
    box.innerHTML = "<p style='padding:10px'>No results</p>";
    return;
  }

  const query = q.toLowerCase();

  const pairs = data.pairs
    .filter(p => p.baseToken && p.pairAddress)
    .map(p => {
      const sym = (p.baseToken.symbol || "").toLowerCase();

      let score = 0;
      if (sym === query) score += 10000;
      if (sym.includes(query)) score += 1000;
      score += Math.log10(p.liquidity?.usd || 1);

      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  searchCache = pairs;

  box.innerHTML = "";

  pairs.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "resultRow";

    row.innerHTML = `
      <div>
        <b>${p.baseToken.symbol}</b>
        | ${p.chainId}
        | MC: $${Math.round(p.marketCap || 0).toLocaleString()}
      </div>

      <button class="addBtn" onclick="addCoin(${i})">
        Add to Basket
      </button>
    `;

    box.appendChild(row);
  });
}

/* ================= CLOSE SEARCH ================= */
function closeSearch() {
  document.getElementById("searchResults").innerHTML = "";
  document.getElementById("searchResults").style.display = "none";
  document.getElementById("closeBtn").style.display = "none";
  document.getElementById("searchCoin").value = "";
}

/* ================= ADD COIN ================= */
function addCoin(i) {
  if (!activeBasket) return alert("Select a basket first");

  const p = searchCache[i];

  baskets[activeBasket].coins.push({
    symbol: p.baseToken.symbol,
    pairAddress: p.pairAddress,
    chainId: p.chainId,
    marketCap: p.marketCap ?? 0
  });

  closeSearch();
  render();
}

/* ================= BASKET MANAGEMENT ================= */
function createBasket() {
  const name = document.getElementById("newBasketName").value;
  if (!name) return;

  baskets[name] = { coins: [] };
  activeBasket = null;

  document.getElementById("newBasketName").value = "";

  updateSelector();
  render();
}

function switchBasket() {
  const val = document.getElementById("basketSelector").value;
  if (!val) return;

  activeBasket = val;
  render();
}

function deleteBasket() {
  if (!activeBasket) return;

  delete baskets[activeBasket];
  activeBasket = null;

  updateSelector();
  render();
}

/* ================= SAVE ================= */
function saveAll() {
  localStorage.setItem("baskets", JSON.stringify(baskets));

  // IMPORTANT FIX:
  // DO NOT save activeBasket anymore (this caused your startup bug)

  alert("Saved!");
}

/* ================= RENDER ================= */
function render() {
  const section = document.getElementById("basketSection");
  const list = document.getElementById("coinList");
  const summary = document.getElementById("summary");

  list.innerHTML = "";

  // 🚨 CRITICAL FIX: hide everything if no active basket
  if (!activeBasket || !baskets[activeBasket]) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  const coins = baskets[activeBasket].coins;

  if (!coins.length) {
    list.innerHTML = "<i>Basket is empty</i>";
    summary.innerText = "0 coins";
    return;
  }

  const weight = (100 / coins.length).toFixed(2);

  coins.forEach((c, i) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <b>${c.symbol}</b>
      | ${c.chainId}
      | MC: $${Math.round(c.marketCap || 0).toLocaleString()}
      | Weight: ${weight}%
      <button onclick="baskets[activeBasket].coins.splice(${i},1);render()">X</button>
    `;

    list.appendChild(li);
  });

  summary.innerText =
    `Coins: ${coins.length} | Equal Weight`;
}

/* ================= DROPDOWN ================= */
function updateSelector() {
  const sel = document.getElementById("basketSelector");
  sel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.textContent = "Select basket...";
  placeholder.value = "";
  placeholder.selected = true;
  placeholder.disabled = true;
  sel.appendChild(placeholder);

  Object.keys(baskets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

/* ================= INIT LOAD ================= */
window.onload = function () {
  const saved = localStorage.getItem("baskets");

  if (saved) baskets = JSON.parse(saved);

  // 🚨 FIX: always start with NO active basket
  activeBasket = null;

  updateSelector();
  render();
};
