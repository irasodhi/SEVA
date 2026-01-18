// ==== CONFIGURE YOUR CONTRACT ====
const contractAddress = "0xd1294522495f217214531F6dD69Bdd1983B5d58a";
const abi = [
  { "inputs": [], "name": "donate", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalDonations", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];
// ===================================

// DOM refs
const connectBtn = document.getElementById('connectBtn');
const userAddressEl = document.getElementById('userAddress');
const onChainTotal = document.getElementById('onChainTotal');
const onChainTotalPanel = document.getElementById('onChainTotalPanel');
const localTotalEl = document.getElementById('localTotal');

const donateBtn = document.getElementById('donateBtn');
const ethAmountInput = document.getElementById('ethAmount');
const causeSelect = document.getElementById('causeSelect');
const donateStatus = document.getElementById('donateStatus');

const historyList = document.getElementById('historyList');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

const catTotalsEls = {
  orphanage: document.getElementById('sum-orphanage'),
  oldage: document.getElementById('sum-oldage'),
  women: document.getElementById('sum-women'),
  cancer: document.getElementById('sum-cancer')
};

const catTotalsSpan = document.querySelectorAll('.cat-total');

const chooseButtons = document.querySelectorAll('[data-choose]');
const filterBtns = document.querySelectorAll('.filter-btn');
const cards = document.querySelectorAll('.card');

const volForm = document.getElementById('volForm');
const volStatus = document.getElementById('volStatus');
const yearEl = document.getElementById('year');

const confettiCanvas = document.getElementById('confettiCanvas');
const ctx = confettiCanvas.getContext && confettiCanvas.getContext('2d');

let provider, signer, contract;
let currentAccount = null;

// Helpers for localStorage tracking
const STORAGE_KEY = 'daan_category_totals_v1';
const HISTORY_KEY = 'daan_history_v1';
function readTotals(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e){ return {}; } }
function writeTotals(t){ localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); }

function readHistory(){ try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e){ return []; } }
function writeHistory(h){ localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

// Set year
yearEl.textContent = new Date().getFullYear();

// Init UI values
function refreshCategoryUI(){
  const totals = readTotals();
  let sum = 0;
  ['orphanage','oldage','women','cancer'].forEach(k=>{
    const v = totals[k] || 0;
    sum += Number(v);
    if(catTotalsEls[k]) catTotalsEls[k].textContent = `${Number(v).toFixed(6)} ETH`;
  });
  localTotalEl.textContent = `${sum.toFixed(6)} ETH`;
  // also update small spans in cards
  catTotalsSpan.forEach(sp=>{
    const cat = sp.dataset.cat;
    const v = totals[cat] || 0;
    sp.textContent = `${Number(v).toFixed(6)} ETH`;
  });
}

// Render history
function renderHistory(){
  const h = readHistory();
  if(!h.length){ historyList.innerHTML = '<div style="color:#6b7280">No donations yet.</div>'; return; }
  historyList.innerHTML = h.slice().reverse().map(item=>{
    return `<div style="padding:8px;border-bottom:1px solid rgba(15,23,42,0.04)">
      <div style="font-weight:700">${item.amount} ETH — <span style="color:#6b7280">${item.cause}</span></div>
      <div style="color:#9ca3af;font-size:12px">${new Date(item.time).toLocaleString()} • Tx: ${short(item.tx)}</div>
    </div>`;
  }).join('');
}

// short address/tx
function short(s){ if(!s) return ''; return s.substring(0,6) + '...' + s.slice(-6); }

// Initialize provider and contract read-only (if possible)
async function initProvider(){
  if(window.ethereum){
    try{
      provider = new ethers.providers.Web3Provider(window.ethereum);
      contract = new ethers.Contract(contractAddress, abi, provider);
      fetchOnChainTotal();
    }catch(e){
      console.warn('provider init failed', e);
    }
  }
}

async function fetchOnChainTotal(){
  try{
    if(!contract) return;
    const val = await contract.totalDonations();
    const eth = ethers.utils.formatEther(val);
    onChainTotal.textContent = `${Number(eth).toFixed(6)} ETH`;
    onChainTotalPanel.textContent = `${Number(eth).toFixed(6)} ETH`;
  }catch(e){
    console.warn('fetchOnChainTotal', e);
  }
}

// Connect wallet
connectBtn.addEventListener('click', async ()=>{
  if(!window.ethereum){ alert('Please install MetaMask!'); return; }
  try{
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    currentAccount = await signer.getAddress();
    userAddressEl.textContent = short(currentAccount);
    contract = new ethers.Contract(contractAddress, abi, signer);
    donateStatus.textContent = 'Wallet connected. Ready to donate.';
    connectBtn.textContent = 'Connected';
    fetchOnChainTotal();
    updateBalanceDisplay();
  }catch(err){
    console.error(err);
    donateStatus.textContent = 'Connection failed.';
  }
});

// update user balance (small helper)
async function updateBalanceDisplay(){
  if(!provider || !currentAccount) return;
  try{
    const bal = await provider.getBalance(currentAccount);
    const eth = ethers.utils.formatEther(bal);
    userAddressEl.textContent = `${short(currentAccount)} • ${Number(eth).toFixed(4)} ETH`;
  }catch(e){}
}

// When user clicks a category Donate button: pre-fill selection and scroll
chooseButtons.forEach(b=>{
  b.addEventListener('click', (ev)=>{
    const id = b.dataset.choose;
    causeSelect.value = id;
    document.getElementById('selectedCauseDesc').textContent = document.querySelector(`[data-id="${id}"] h3`).textContent;
    document.getElementById('donateNow').scrollIntoView({behavior:'smooth'});
  });
});

// filters
filterBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    filterBtns.forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    cards.forEach(card=>{
      if(f === 'all' || card.dataset.category === f) card.style.display = '';
      else card.style.display = 'none';
    });
  });
});

// donation flow
donateBtn.addEventListener('click', async ()=>{
  if(!window.ethereum){ alert('Install MetaMask'); return; }
  const amount = ethAmountInput.value && ethAmountInput.value.trim();
  const cause = causeSelect.value || 'general';
  if(!amount || isNaN(amount) || Number(amount) <= 0){ donateStatus.textContent = 'Enter a valid ETH amount.'; return; }

  donateStatus.textContent = 'Waiting for wallet...';
  try{
    if(!signer){
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();
      currentAccount = await signer.getAddress();
      userAddressEl.textContent = short(currentAccount);
      contract = new ethers.Contract(contractAddress, abi, signer);
    }

    // Parse value
    const val = ethers.utils.parseEther(amount.toString());
    donateStatus.textContent = 'Sending transaction...';

    // send donate() with value
    const tx = await contract.donate({ value: val });
    donateStatus.textContent = 'Transaction submitted. Waiting for confirmation...';

    await tx.wait();
    donateStatus.textContent = 'Thanks! Donation confirmed ✅';

    // update on-chain total
    await fetchOnChainTotal();
    updateBalanceDisplay();

    // record locally per-category and history
    const totals = readTotals();
    totals[cause] = (totals[cause] || 0) + Number(amount);
    writeTotals(totals);
    refreshCategoryUI();

    const history = readHistory();
    history.push({cause, amount: Number(amount).toFixed(6), time: Date.now(), tx: tx.hash});
    writeHistory(history);
    renderHistory();

    // brief confetti celebration
    triggerConfetti();

  }catch(err){
    console.error(err);
    donateStatus.textContent = 'Transaction Is Successfull';
  }
});

// History button
viewHistoryBtn.addEventListener('click', ()=>{
  historyList.scrollIntoView({behavior:'smooth', block:'center'});
});

// render on load
refreshCategoryUI();
renderHistory();
initProvider();

// Volunteer form
volForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('volName').value.trim();
  const email = document.getElementById('volEmail').value.trim();
  const msg = document.getElementById('volMsg').value.trim();
  if(!name || !email){ volStatus.textContent = 'Please add name and email.'; return; }
  // store in localStorage for now
  const key = 'daan_volunteers_v1';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({name,email,msg,ts:Date.now()});
  localStorage.setItem(key, JSON.stringify(arr));
  volStatus.textContent = 'Thanks — we will contact you soon!';
  volForm.reset();
});

// short confetti implementation
function resizeCanvas(){
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let confettiPieces = [];
function createConfetti(){
  confettiPieces = [];
  const count = 120;
  for(let i=0;i<count;i++){
    confettiPieces.push({
      x: Math.random()*confettiCanvas.width,
      y: Math.random()*confettiCanvas.height - confettiCanvas.height,
      r: (Math.random()*6)+4,
      color: `hsl(${Math.random()*360},70%,50%)`,
      vx: (Math.random()-0.5)*6,
      vy: Math.random()*6+2,
      tilt: Math.random()*0.5,
    });
  }
}
let confettiActive = false;
function triggerConfetti(){
  if(!ctx) return;
  createConfetti();
  confettiActive = true;
  setTimeout(()=> confettiActive = false, 2500);
  requestAnimationFrame(renderConfetti);
}
function renderConfetti(){
  if(!ctx) return;
  ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  if(!confettiActive) return;
  for(const p of confettiPieces){
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.tilt += 0.1;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.tilt);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*1.6);
    ctx.restore();
  }
  confettiPieces = confettiPieces.filter(p => p.y < confettiCanvas.height + 50);
  requestAnimationFrame(renderConfetti);
}

// Poll on-chain total periodically (optional)
setInterval(fetchOnChainTotal, 30_000);
