import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const appFirebase=initializeApp(firebaseConfig), auth=getAuth(appFirebase), db=getFirestore(appFirebase);
const $=id=>document.getElementById(id);
const defaultCats=["House","Personal","Transportation","Cat","Food"];
let cats=[...defaultCats];
let user=null, profile=null, transactions=[], budgets={}, activeView="overview", categoryRecords=[];
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const monthKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`};
const selectedMonth=()=> $("overviewMonth").value || monthKey(new Date());
const monthTx=(m)=>transactions.filter(t=>monthKey(t.date)===m);
const expenses=(arr)=>arr.filter(t=>t.type==="expense");
const incomes=(arr)=>arr.filter(t=>t.type==="income");
const sum=arr=>arr.reduce((s,t)=>s+Number(t.amount||0),0);
function allCategoryNames(){
  return [...new Set([
    ...categoryRecords.flatMap(c=>[
      c.name,
      ...(c.historyNames||[])
    ]),
    ...transactions
      .filter(t=>t.type==="expense")
      .map(t=>t.category)
      .filter(Boolean)
  ])];
}
const dateText=d=>new Date(d).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
function toast(s){$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2400)}
function show(id){$(id).classList.remove("hidden")} function hide(id){$(id).classList.add("hidden")}
function setView(v){activeView=v;document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));show(v+"View");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("pageTitle").textContent=({overview:"Overview",transactions:"Transactions",income:"Add income",budgets:"Budgets",categories:"Manage Categories",assistant:"Money assistant"})[v];if(v==="transactions")renderTransactions();if(v==="budgets")renderBudgets();if(v==="categories")renderCategories()}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.goto)));
$("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
$("overviewMonth").value=monthKey(new Date());$("customMonth").value=monthKey(new Date());
$("overviewMonth").addEventListener("change",renderOverview);
$("customMonth").addEventListener("change",renderTransactions);
$("quickAddBtn").onclick=$("addExpenseBtn").onclick=()=>openExpense();
$("closeModal").onclick=()=>hide("expenseModal");
$("signInBtn").onclick=async()=>authAction(false);$("signUpBtn").onclick=async()=>authAction(true);
async function authAction(create){$("authError").textContent="";try{const email=$("email").value.trim(),password=$("password").value;if(create)await createUserWithEmailAndPassword(auth,email,password);else await signInWithEmailAndPassword(auth,email,password)}catch(e){$("authError").textContent=authMessage(e.code)}}
function authMessage(c){return ({ "auth/invalid-email":"Please enter a valid email address.","auth/invalid-credential":"Email or password is incorrect.","auth/email-already-in-use":"An account already exists with this email.","auth/weak-password":"Use a password with at least 6 characters.","auth/too-many-requests":"Too many attempts. Please try again later."})[c]||"Unable to continue. Check your details and Firebase setup."}
$("signOutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{user=u;if(!u){hide("app");hide("setupScreen");show("authScreen");return}hide("authScreen");$("userEmail").textContent=u.email||"My account";try{const p=await getDoc(doc(db,"users",u.uid,"private","profile"));if(!p.exists()){hide("app");show("setupScreen")}else{profile=p.data();budgets=profile.budgets||{};await loadCategories();hide("setupScreen");show("app");await loadTransactions();setView("overview")}}catch(e){toast("Could not load your cloud data. Check Firebase configuration and rules.");console.error(e)}});
$("saveSetupBtn").onclick=async()=>{const n=Number($("openingBalance").value);if(!Number.isFinite(n)||n<0){$("setupError").textContent="Enter a valid balance of zero or more.";return}try{profile={openingBalance:n,budgets:{},createdAt:new Date().toISOString()};await setDoc(doc(db,"users",user.uid,"private","profile"),profile);await loadCategories();hide("setupScreen");show("app");await loadTransactions();setView("overview")}catch(e){$("setupError").textContent="Could not save. Check your Firebase setup.";console.error(e)}};
async function loadTransactions(){const q=query(collection(db,"users",user.uid,"transactions"),orderBy("date","desc"));const snap=await getDocs(q);transactions=snap.docs.map(d=>({id:d.id,...d.data()}));renderOverview()}
async function loadCategories(){
  if(Array.isArray(profile.categories)){
    categoryRecords=profile.categories;
  }else{
    categoryRecords=defaultCats.map((name,index)=>({
      id:`default-${index+1}`,
      name,
      archived:false,
      isDefault:true
    }));
    profile.categories=categoryRecords;
    await setDoc(doc(db,"users",user.uid,"private","profile"),profile);
  }
  cats=categoryRecords.filter(c=>!c.archived).map(c=>c.name);
}
 
async function saveTx(data,id=null){const ref=collection(db,"users",user.uid,"transactions");if(id)await updateDoc(doc(db,"users",user.uid,"transactions",id),data);else await addDoc(ref,{...data,createdAt:new Date().toISOString()});await loadTransactions()}
function openExpense(t=null){
  $("expenseForm").reset();
  $("editId").value=t?.id||"";
  $("modalTitle").textContent=t?"Edit expense":"Add expense";
  $("expenseAmount").value=t?.amount??"";
  $("expenseDescription").value=t?.description||"";
  $("expenseDate").value=t?.date?toInputDate(t.date):nowLocal();
 
  const selected=t?.category||"House";
  renderCategoryOptions(cats.includes(selected)?selected:cats[0]||"");
 
  updateDescription();
  show("expenseModal");
}
 
function toInputDate(d){const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)}
function updateDescription(){const c=document.querySelector('input[name="category"]:checked').value;$("descriptionField").classList.toggle("hidden",c==="Transportation");$("expenseDescription").required=c!=="Transportation"}
$("categoryOptions").addEventListener("change",async e=>{
  if(e.target.name!=="category")return;
 
  if(e.target.value==="__other__"){
    const previous=cats[0]||"";
    const name=prompt("Enter your new category name:");
 
    if(name===null||!name.trim()){
      renderCategoryOptions(previous);
      updateDescription();
      return;
    }
 
    const cleanName=name.trim();
 
    if(categoryRecords.some(c=>c.name.toLowerCase()===cleanName.toLowerCase())){
      alert("This category already exists.");
      renderCategoryOptions(cleanName);
      updateDescription();
      return;
    }
 
    const category={
      id:"custom-"+Date.now(),
      name:cleanName,
      archived:false,
      isDefault:false
    };
 
    categoryRecords.push(category);
 
    try{
      await saveCategoryRecords();
      renderCategoryOptions(cleanName);
      updateDescription();
      toast("New category added");
    }catch(err){
      categoryRecords.pop();
      renderCategoryOptions(previous);
      updateDescription();
      toast("Could not save category");
      console.error(err);
    }
    return;
  }
 
  updateDescription();
});
$("expenseForm").onsubmit=async e=>{e.preventDefault();const category=document.querySelector('input[name="category"]:checked').value,amount=Number($("expenseAmount").value);if(amount<=0)return;$("expenseError").textContent="";try{await saveTx({type:"expense",category,amount,description:$("expenseDescription").value.trim(),date:new Date($("expenseDate").value).toISOString()},$("editId").value||null);hide("expenseModal");toast("Expense saved");renderTransactions()}catch(err){$("expenseError").textContent="Unable to save transaction.";console.error(err)}};
$("incomeForm").onsubmit=async e=>{e.preventDefault();try{await saveTx({type:"income",category:"Income",amount:Number($("incomeAmount").value),description:$("incomeDescription").value.trim(),date:new Date($("incomeDate").value).toISOString()});e.target.reset();$("incomeDate").value=nowLocal();toast("Income added");setView("overview")}catch(err){toast("Unable to save income");console.error(err)}};
$("incomeDate").value=nowLocal();
function totalBalance(){return Number(profile?.openingBalance||0)+sum(incomes(transactions))-sum(expenses(transactions))}
function renderOverview(){if(!profile)return;const m=selectedMonth(),arr=monthTx(m),inc=sum(incomes(arr)),exp=sum(expenses(arr)),saving=inc-exp;$("balanceStat").textContent=money(totalBalance());$("incomeStat").textContent=money(inc);$("expenseStat").textContent=money(exp);$("savingStat").textContent=money(saving);$("expenseFoot").textContent=`${expenses(arr).length} expense entries`;$("categoryMonthTag").textContent=m;
 const colors={House:"#6c9cdb",Personal:"#a58be2",Transportation:"#e5a34c",Cat:"#e58ca9",Food:"#63b89a"};
 $("categoryBreakdown").innerHTML=allCategoryNames().map(c=>{const v=sum(expenses(arr).filter(t=>t.category===c)),pct=exp?Math.round(v/exp*100):0;return `<div class="cat-row"><div class="cat-name"><i class="cat-dot" style="background:${colors[c]}"></i>${c}</div><div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${colors[c]}"></div></div><div class="cat-amount">${money(v)}</div></div>`}).join("");
 const [y,mo]=m.split("-").map(Number),prev=new Date(y,mo-2,1),pm=monthKey(prev),pe=sum(expenses(monthTx(pm))),diff=exp-pe,pc=pe?Math.round(diff/pe*100):null;
 $("monthlyCompare").innerHTML=`<div class="compare-row"><span class="muted">Previous month · ${pm}</span><strong>${money(pe)}</strong></div><div class="compare-row"><span class="muted">Selected month · ${m}</span><strong>${money(exp)}</strong></div><div class="change-note">${pc===null?(exp===0?"No expenses recorded for this month yet.":"No previous-month data to compare."):(diff>0?`Spending increased by ${Math.abs(pc)}% (${money(diff)}) compared with last month.`:diff<0?`Great! Spending decreased by ${Math.abs(pc)}% (${money(-diff)}) compared with last month.`:"Spending is unchanged from last month.")}</div>`;
 $("recentTransactions").innerHTML=transactions.slice(0,5).map(txHTML).join("")||'<div class="empty">No transactions yet. Add your first expense or income.</div>';
}
function txHTML(t){const isI=t.type==="income";return `<div class="transaction"><div class="tx-main"><div class="tx-icon">${isI?"↗":({House:"⌂",Personal:"◉",Transportation:"↗",Cat:"♡",Food:"♨"}[t.category]||"₹")}</div><div style="min-width:0"><div class="tx-title">${esc(t.description||t.category)}</div><div class="tx-sub">${esc(t.category)} · ${esc(dateText(t.date))}</div></div></div><div class="tx-date muted">${new Date(t.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div><div class="tx-amount ${isI?"positive":"negative"}">${isI?"+":"−"}${money(t.amount)}</div><div class="tx-actions"><button class="small-action" data-edit="${t.id}">Edit</button><button class="small-action" data-delete="${t.id}">Delete</button></div></div>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderCategoryFilter(){
  const filter=$("categoryFilter");
  const current=filter.value||"all";
 
  const names=[
    ...categoryRecords.flatMap(c=>[
      c.name,
      ...(c.historyNames||[])
    ]),
    ...transactions.map(t=>t.category).filter(Boolean),
    "Income"
  ];
 
  const uniqueNames=[...new Set(names)];
 
  filter.innerHTML='<option value="all">All categories</option>'+
    uniqueNames.map(name=>
      `<option value="${esc(name)}">${esc(name)}</option>`
    ).join("");
 
  filter.value=uniqueNames.includes(current)?current:"all";
}
function renderTransactions(){
  renderCategoryFilter();
  let arr=[...transactions],period=$("periodFilter").value,cat=$("categoryFilter").value,search=$("searchInput").value.toLowerCase(),today=new Date();if(period==="month"){const m=$("customMonth").value||monthKey(today);arr=arr.filter(t=>monthKey(t.date)===m)}if(period==="week"){const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));arr=arr.filter(t=>new Date(t.date)>=start)}if(period==="day")arr=arr.filter(t=>new Date(t.date).toDateString()===today.toDateString());if(cat!=="all")arr=arr.filter(t=>t.category===cat);if(search)arr=arr.filter(t=>(t.description||"").toLowerCase().includes(search)||t.category.toLowerCase().includes(search));$("transactionList").innerHTML=arr.map(txHTML).join("")||'<div class="empty">No transactions match these filters.</div>';bindTxActions()}
function bindTxActions(){document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const t=transactions.find(x=>x.id===b.dataset.edit);if(t?.type==="expense")openExpense(t);else if(t){const d=prompt("Edit income description:",t.description||"");if(d!==null)saveTx({...t,description:d,id:undefined},t.id).then(()=>toast("Updated"))}});document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this transaction? This cannot be undone."))return;try{await deleteDoc(doc(db,"users",user.uid,"transactions",b.dataset.delete));await loadTransactions();renderTransactions();toast("Transaction deleted")}catch(e){toast("Could not delete transaction")}})}
["searchInput","categoryFilter","periodFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderTransactions));
function renderBudgets(){const vals=allCategoryNames().map(c=>`<label class="budget-line">${c}<input type="number" min="0" step="1" data-budget="${c}" value="${budgets[c]||""}" placeholder="Monthly limit ₹"></label>`).join("");$("budgetInputs").innerHTML=vals;const arr=monthTx(monthKey(new Date()));$("budgetProgress").innerHTML=allCategoryNames().map(c=>{const b=Number(budgets[c]||0),v=sum(expenses(arr).filter(t=>t.category===c)),p=b?Math.min(100,Math.round(v/b*100)):0;return `<div class="budget-progress-row"><div class="budget-progress-head"><b>${c}</b><span>${money(v)} ${b?"of "+money(b):"· No budget set"}</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%;background:${p>=100?"#d95d63":"#60b994"}"></div></div></div>`}).join("")}
$("saveBudgetsBtn").onclick=async()=>{const next={};document.querySelectorAll("[data-budget]").forEach(i=>{if(i.value!=="")next[i.dataset.budget]=Number(i.value)});try{budgets=next;profile.budgets=budgets;await setDoc(doc(db,"users",user.uid,"private","profile"),profile);renderBudgets();toast("Budgets saved")}catch(e){toast("Unable to save budgets")}};
function renderCategoryOptions(selected="House"){
  const icons={
    House:"⌂",
    Personal:"◉",
    Transportation:"↗",
    Cat:"♡",
    Food:"♨"
  };
 
  const options=[...cats];
 
  if(selected&&!options.includes(selected)){
    options.push(selected);
  }
 
  $("categoryOptions").innerHTML=options.map(c=>`
    <label class="category-option">
      <input type="radio" name="category" value="${esc(c)}" ${c===selected?"checked":""}>
      <span>${icons[c]||"₹"}</span>${esc(c)}
      ${!cats.includes(c)?'<small>(Archived)</small>':""}
    </label>
  `).join("")+`
    <label class="category-option">
      <input type="radio" name="category" value="__other__">
      <span>＋</span>Other
    </label>
  `;
}
 
function renderCategories(){
  const active=categoryRecords.filter(c=>!c.archived);
  const archived=categoryRecords.filter(c=>c.archived);
 
  $("activeCategoryList").innerHTML=active.map(c=>`
    <div class="transaction">
      <div class="tx-main"><div class="tx-title">${esc(c.name)}</div></div>
      <div class="tx-actions">
        <button class="small-action" data-rename="${esc(c.id)}">Rename</button>
        <button class="small-action" data-archive="${esc(c.id)}">Archive</button>
        <button class="small-action" data-permanent-delete="${esc(c.id)}">Delete</button>
      </div>
    </div>
  `).join("")||'<div class="empty">No active categories.</div>';
 
  $("archivedCategoryList").innerHTML=archived.map(c=>`
    <div class="transaction">
      <div class="tx-main"><div class="tx-title">${esc(c.name)}</div></div>
      <div class="tx-actions">
        <button class="small-action" data-restore="${esc(c.id)}">Restore</button>
        <button class="small-action" data-permanent-delete="${esc(c.id)}">Delete</button>
      </div>
    </div>
  `).join("")||'<div class="empty">No archived categories.</div>';
}
async function saveCategoryRecords(){
  profile.categories=categoryRecords;
  await setDoc(doc(db,"users",user.uid,"private","profile"),profile);
  cats=categoryRecords.filter(c=>!c.archived).map(c=>c.name);
  renderCategories();
}
 
$("addCategoryBtn").onclick=async()=>{
  const name=$("newCategoryName").value.trim();
  $("categoryError").textContent="";
 
  if(!name){
    $("categoryError").textContent="Please enter a category name.";
    return;
  }
 
  if(categoryRecords.some(c=>c.name.toLowerCase()===name.toLowerCase())){
    $("categoryError").textContent="This category already exists.";
    return;
  }
 
  try{
    categoryRecords.push({
      id:"custom-"+Date.now(),
      name,
      archived:false,
      isDefault:false
    });
    await saveCategoryRecords();
    $("newCategoryName").value="";
    toast("Category added successfully");
  }catch(e){
    toast("Could not save category");
    console.error(e);
  }
};
$("activeCategoryList").addEventListener("click",async e=>{
  const renameId=e.target.dataset.rename;
  const archiveId=e.target.dataset.archive;
 
  if(renameId){
    const category=categoryRecords.find(c=>c.id===renameId);
    const newName=prompt("Enter the new category name:",category.name);
 
    if(newName===null)return;
 
    const name=newName.trim();
 
    if(!name){
      alert("Category name cannot be empty.");
      return;
    }
 
    if(categoryRecords.some(c=>c.id!==renameId&&c.name.toLowerCase()===name.toLowerCase())){
      alert("This category already exists.");
      return;
    }
 
    category.historyNames=Array.isArray(category.historyNames)?category.historyNames:[];
if(!category.historyNames.includes(category.name)){
  category.historyNames.push(category.name);
}
category.name=name;
    try{
      await saveCategoryRecords();
      toast("Category renamed");
    }catch(err){
      toast("Could not rename category");
      console.error(err);
    }
  }
 
  if(archiveId){
    const category=categoryRecords.find(c=>c.id===archiveId);
    if(!confirm(`Archive "${category.name}"? Existing transactions will be preserved.`))return;
 
    category.archived=true;
    try{
      await saveCategoryRecords();
      toast("Category archived");
    }catch(err){
      toast("Could not archive category");
      console.error(err);
    }
  }
});
 
$("archivedCategoryList").addEventListener("click",async e=>{
  const restoreId=e.target.dataset.restore;
  if(!restoreId)return;
 
  const category=categoryRecords.find(c=>c.id===restoreId);
  category.archived=false;
 
  try{
    await saveCategoryRecords();
    toast("Category restored");
  }catch(err){
    toast("Could not restore category");
    console.error(err);
  }
});
async function permanentlyDeleteCategory(categoryId){
  const category=categoryRecords.find(c=>c.id===categoryId);
  if(!category)return;
 
  if(!category.archived&&categoryRecords.filter(c=>!c.archived).length<=1){
    alert("You must keep at least one active category.");
    return;
  }
 
  const names=[category.name,...(category.historyNames||[])];
  const matching=transactions.filter(t=>names.includes(t.category));
  const total=sum(matching);
 
  if(!confirm(
    `Permanently delete "${category.name}"?\n\n`+
    `Transactions found: ${matching.length}\n`+
    `Total transaction amount: ${money(total)}\n\n`+
    `This action cannot be undone.`
  ))return;
 
  if(!confirm(
    `FINAL CONFIRMATION\n\nDelete "${category.name}" and all ${matching.length} associated transactions permanently?`
  ))return;
 
  try{
    for(const t of matching){
      await deleteDoc(doc(db,"users",user.uid,"transactions",t.id));
    }
 
    categoryRecords=categoryRecords.filter(c=>c.id!==categoryId);
 
    for(const name of names){
      delete budgets[name];
    }
 
    profile.budgets=budgets;
 
    await saveCategoryRecords();
    await setDoc(doc(db,"users",user.uid,"private","profile"),profile);
 
    await loadTransactions();
    renderCategories();
    renderOverview();
    renderTransactions();
    renderBudgets();
 
    toast("Category and associated transactions deleted");
  }catch(err){
    toast("Deletion could not be completed. Please check your data.");
    console.error(err);
  }
}
 
$("activeCategoryList").addEventListener("click",e=>{
  const id=e.target.dataset.permanentDelete;
  if(id)permanentlyDeleteCategory(id);
});
 
$("archivedCategoryList").addEventListener("click",e=>{
  const id=e.target.dataset.permanentDelete;
  if(id)permanentlyDeleteCategory(id);
});
 
function assistantReply(q){const m=monthKey(new Date()),arr=monthTx(m),ex=expenses(arr),inc=sum(incomes(arr)),out=sum(ex),lower=q.toLowerCase();if(lower.includes("most")||lower.includes("category")){const ranked=cats.map(c=>({c,v:sum(ex.filter(t=>t.category===c))})).sort((a,b)=>b.v-a.v);return ranked[0].v?`Your highest spending category this month is ${ranked[0].c} at ${money(ranked[0].v)}. ${ranked[1].v?`${ranked[1].c} comes next at ${money(ranked[1].v)}.`:""}`:"You haven't recorded any expenses this month yet."}if(lower.includes("sav")||lower.includes("balance"))return `This month, you've recorded ${money(inc)} income and ${money(out)} expenses. Your income-minus-expenses savings are ${money(inc-out)}. Your current available balance is ${money(totalBalance())}.`;if(lower.includes("tip")||lower.includes("reduce")||lower.includes("advice")){const rank=cats.map(c=>({c,v:sum(ex.filter(t=>t.category===c))})).sort((a,b)=>b.v-a.v);return out?`Start by reviewing ${rank[0].c}, your largest category (${money(rank[0].v)}). Try setting a realistic monthly limit, recording small purchases immediately, and comparing weekly totals. Keep essential spending separate from optional spending.`:"Record a few weeks of expenses first. Then I can help identify the categories where you may be able to save."}return `For ${m}, your total expenses are ${money(out)} across ${ex.length} entries. You can ask me about your highest-spending category, monthly savings, or ways to reduce spending.`}
function sendChat(q){if(!q.trim())return;const box=$("chatMessages");box.insertAdjacentHTML("beforeend",`<div class="chat-bubble user">${esc(q)}</div><div class="chat-bubble bot">${esc(assistantReply(q))}</div>`);box.scrollTop=box.scrollHeight}
$("chatForm").onsubmit=e=>{e.preventDefault();sendChat($("chatText").value);$("chatText").value=""};document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>sendChat(b.textContent));
