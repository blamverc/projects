let baskets = {};
let activeBasket = null;
let searchCache = [];

/* ================= SEARCH ================= */
async function searchCoin() {
  const q = document.getElementById("searchCoin").value;
  if (!q) return;

  const data = await fetch(
    `https://api.dexscreener.com/latest/dex/search/?q=${q}`
  ).then(r => r.json());

  const box = document.getElementById("searchResults");
  box.innerHTML = "";

  if (!data.pairs?.length) {
    box.innerHTML = "<p>No results</p>";
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

  pairs.forEach((p, i) => {
    const mc = p.marketCap ?? 0;

    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "8px";
    div.style.margin = "5px 0";

    div.innerHTML = `
      <b>${p.baseToken.symbol}</b>
      | ${p.chainId}
      | $${Number(p.priceUsd || 0).toFixed(6)}
      | MC: $${Math.round(mc).toLocaleString()}
      | Liquidity: $${Math.round(p.liquidity?.usd || 0)}
      <button onclick="addCoin(${i})">Add</button>
    `;

    box.appendChild(div);
  });
}

/* ================= ADD COIN ================= */
function addCoin(i) {
  if (!activeBasket) return alert("Create a basket first");

  const p = searchCache[i];

  baskets[activeBasket].coins.push({
    symbol: p.baseToken.symbol,
    pairAddress: p.pairAddress,
    chainId: p.chainId,
    marketCap: p.marketCap ?? 0
  });

  document.getElementById("searchResults").innerHTML = "";
  document.getElementById("searchCoin").value = "";

  render();
}

/* ================= BASKETS ================= */
function createBasket() {
  const name = document.getElementById("newBasketName").value;
  if (!name) return;

  baskets[name] = { coins: [] };
  activeBasket = name;

  updateSelector();
  render();
}

function switchBasket() {
  activeBasket = document.getElementById("basketSelector").value;
  render();
}

function deleteBasket() {
  delete baskets[activeBasket];
  const keys = Object.keys(baskets);
  activeBasket = keys[0] || null;

  updateSelector();
  render();
}

/* ================= SAVE ================= */
function saveAll() {
  localStorage.setItem("baskets", JSON.stringify(baskets));
  localStorage.setItem("activeBasket", activeBasket);
  alert("Saved!");
}

/* ================= PRICE ================= */
async function getPrice(pairAddress, chainId) {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`
    );

    const d = await res.json();
    return Number(d.pair?.priceUsd || 0);
  } catch {
    return 0;
  }
}

/* ================= RENDER ================= */
async function render() {
  const list = document.getElementById("coinList");
  list.innerHTML = "";

  if (!activeBasket || !baskets[activeBasket]) {
    document.getElementById("totalWeight").innerText = "No basket";
    return;
  }

  const coins = baskets[activeBasket].coins;

  if (!coins.length) {
    list.innerHTML = "<i>Basket is empty</i>";
    document.getElementById("totalWeight").innerText = "0 coins | $0";
    return;
  }

  const weightPerCoin = 100 / coins.length;

  let totalValue = 0;

  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];

    const price = await getPrice(c.pairAddress, c.chainId);

    const value = price * weightPerCoin;
    totalValue += value;

    const li = document.createElement("li");

    li.innerHTML = `
      <b>${c.symbol}</b>
      | MC: $${Math.round(c.marketCap || 0).toLocaleString()}
      | ${c.chainId}
      | Price: $${price.toFixed(6)}
      | Weight: ${weightPerCoin.toFixed(2)}%
      | Value: $${value.toFixed(2)}
      <button onclick="baskets[activeBasket].coins.splice(${i},1);render()">X</button>
    `;

    list.appendChild(li);
  }

  document.getElementById("totalWeight").innerText =
    `Equal Weight Portfolio | Total Value: $${totalValue.toFixed(2)}`;
}

/* ================= SELECT ================= */
function updateSelector() {
  const sel = document.getElementById("basketSelector");
  sel.innerHTML = "";

  Object.keys(baskets).forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });

  if (activeBasket) sel.value = activeBasket;
}

/* ================= INIT ================= */
window.onload = function () {
  const saved = localStorage.getItem("baskets");
  const savedActive = localStorage.getItem("activeBasket");

  if (saved) baskets = JSON.parse(saved);

  const keys = Object.keys(baskets);

  activeBasket =
    savedActive && baskets[savedActive]
      ? savedActive
      : keys[0] || null;

  updateSelector();
  render();
};