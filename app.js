const SUPABASE_URL='https://xvyzwrkkvvpoqwlanaas.supabase.co';
const SUPABASE_KEY='sb_publishable_42LvRC2raazxqq0LG2WwIA_1CPR6uqT';
const OWNER_EMAIL='nishagolden50@gmail.com';
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let inventory=[],sales=[],expenses=[],customers=[],suppliers=[],purchases=[],staff=[],user=null,dataOwnerId=null,role='owner',upgradeReady=false;

const money=n=>'KES '+Number(n||0).toLocaleString('en-KE',{maximumFractionDigits:2});
const fmt=d=>new Date(d).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'});
const today=d=>new Date(d).toDateString()===new Date().toDateString();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=t=>`<div class="empty">${esc(t)}</div>`;
const row=(title,meta,right,buttons='')=>`<div class="row"><div><strong>${esc(title)}</strong><small>${esc(meta)}</small></div><div class="money">${right}<div class="actions">${buttons}</div></div></div>`;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2800)}
function can(area){if(role==='owner'||role==='manager')return true;if(role==='cashier')return area==='sales'||area==='customers';if(role==='stock_manager')return area==='inventory'||area==='suppliers'||area==='purchases';return false}

async function start(){const {data}=await client.auth.getSession();await showSession(data.session);client.auth.onAuthStateChange(async(_e,s)=>showSession(s))}
async function showSession(session){
  user=session?.user||null;$('#auth').classList.toggle('hidden',!!user);$('#app').classList.toggle('hidden',!user);
  if(!user)return;
  if(user.email.toLowerCase()===OWNER_EMAIL){role='owner';dataOwnerId=user.id}else{
    const {data,error}=await client.from('staff_profiles').select('*').eq('email',user.email.toLowerCase()).eq('active',true).maybeSingle();
    if(error||!data){await client.auth.signOut();$('#auth-error').textContent='This account has not been approved by the owner.';return}
    role=data.role;dataOwnerId=data.owner_id;
  }
  $('#user-email').textContent=`${user.email} · ${role.replace('_',' ')}`;applyPermissions();loadAll();
}
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#auth-error').textContent='';const {error}=await client.auth.signInWithPassword({email:$('#email').value.trim().toLowerCase(),password:$('#password').value});if(error)$('#auth-error').textContent=error.message};
$('#logout').onclick=()=>client.auth.signOut();

function applyPermissions(){
  $('#new-product').classList.toggle('hidden',!can('inventory'));$('#new-sale').classList.toggle('hidden',!can('sales'));$('#new-expense').classList.toggle('hidden',!can('expenses'));
  $('#new-customer').classList.toggle('hidden',!can('customers'));$('#new-supplier').classList.toggle('hidden',!can('suppliers'));$('#new-purchase').classList.toggle('hidden',!can('purchases'));
  $('#new-staff').classList.toggle('hidden',role!=='owner');
}

async function loadAll(){
  const core=await Promise.all([
    client.from('fruit_inventory').select('*').eq('user_id',dataOwnerId).order('name'),
    client.from('fruit_sales').select('*').eq('user_id',dataOwnerId).order('created_at',{ascending:false}),
    client.from('business_expenses').select('*').eq('user_id',dataOwnerId).order('created_at',{ascending:false})
  ]);
  const err=core.find(x=>x.error)?.error;if(err){toast(err.message);return}
  [inventory,sales,expenses]=core.map(x=>x.data||[]);
  const extra=await Promise.all([
    client.from('customers').select('*').eq('user_id',dataOwnerId).order('name'),
    client.from('suppliers').select('*').eq('user_id',dataOwnerId).order('name'),
    client.from('supplier_purchases').select('*').eq('user_id',dataOwnerId).order('created_at',{ascending:false}),
    client.from('staff_profiles').select('*').eq('owner_id',dataOwnerId).order('name')
  ]);
  upgradeReady=!extra.some(x=>x.error);
  if(upgradeReady)[customers,suppliers,purchases,staff]=extra.map(x=>x.data||[]);else [customers,suppliers,purchases,staff]=[[],[],[],[]];
  render();
}

function render(){renderDashboard();renderInventory();renderSales();renderExpenses();renderContacts();renderPurchases();renderStaff();renderReport();renderMpesa()}
function renderDashboard(){
  const ts=sales.filter(x=>today(x.created_at)),te=expenses.filter(x=>today(x.created_at));
  const revenue=ts.reduce((a,x)=>a+x.quantity*x.unit_price,0),cogs=ts.reduce((a,x)=>a+x.quantity*x.unit_cost,0),costs=te.reduce((a,x)=>a+x.amount,0);
  $('#today').textContent=new Date().toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'});$('#today-sales').textContent=money(revenue);$('#today-profit').textContent=money(revenue-cogs-costs);$('#today-count').textContent=ts.length;$('#stock-value').textContent=money(inventory.reduce((a,x)=>a+x.quantity*x.cost_price,0));$('#today-expenses').textContent=money(costs);$('#mpesa-total').textContent=money(ts.filter(x=>x.payment_method==='M-Pesa').reduce((a,x)=>a+x.quantity*x.unit_price,0));$('#low-count').textContent=inventory.filter(x=>x.quantity<=x.low_stock_level).length;
  $('#dash-stock').innerHTML=inventory.slice(0,5).map(x=>row(x.name,`${x.quantity} ${x.unit} · ${money(x.selling_price)} each`,esc(x.quantity<=x.low_stock_level?'Low stock':'In stock'))).join('')||empty('No fruits yet');
}
function renderInventory(){$('#inventory-list').innerHTML=inventory.map(x=>row(x.name,`${x.quantity} ${x.unit} · Cost ${money(x.cost_price)} · Sell ${money(x.selling_price)}`,esc(x.quantity<=x.low_stock_level?'Low stock':'Available'),can('inventory')?`<button class="mini" onclick="editProduct('${x.id}')">Edit</button>`:'')).join('')||empty('Add your first fruit product')}
function renderSales(){$('#sales-list').innerHTML=sales.map(x=>row(`${x.product_name} × ${x.quantity}`,`${fmt(x.created_at)} · ${x.payment_method}${x.payment_method==='M-Pesa'&&x.mpesa_code?' · '+x.mpesa_code:''}`,money(x.quantity*x.unit_price),`<button class="mini" onclick="showReceipt('${x.id}')">Receipt</button>${can('sales')?`<button class="mini" onclick="editSale('${x.id}')">Edit</button>`:''}`)).join('')||empty('No sales recorded yet')}
function renderExpenses(){$('#expenses-list').innerHTML=expenses.map(x=>row(x.category,`${fmt(x.created_at)}${x.note?' · '+x.note:''}`,'− '+money(x.amount),can('expenses')?`<button class="mini" onclick="editExpense('${x.id}')">Edit</button>`:'')).join('')||empty('No expenses recorded yet')}

$$('nav button').forEach(b=>b.onclick=()=>navigate(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
function navigate(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id||(id!=='dashboard'&&id!=='inventory'&&id!=='sales'&&id!=='expenses'&&b.dataset.view==='more')));if(id==='reports')renderReport();scrollTo({top:0,behavior:'smooth'})}
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

$('#new-product').onclick=()=>openProduct();
function openProduct(x){$('#product-form').reset();$('#product-id').value=x?.id||'';$('#product-title').textContent=x?'Edit fruit':'Add fruit';$('#product-name').value=x?.name||'';$('#product-qty').value=x?.quantity??'';$('#product-unit').value=x?.unit||'pieces';$('#product-cost').value=x?.cost_price??'';$('#product-price').value=x?.selling_price??'';$('#product-low').value=x?.low_stock_level??10;$('#product-dialog').showModal()}window.editProduct=id=>openProduct(inventory.find(x=>x.id===id));
$('#product-form').onsubmit=async e=>{e.preventDefault();if(!can('inventory'))return toast('Your staff role cannot change inventory');const id=$('#product-id').value,p={name:$('#product-name').value.trim(),quantity:+$('#product-qty').value,unit:$('#product-unit').value,cost_price:+$('#product-cost').value,selling_price:+$('#product-price').value,low_stock_level:+$('#product-low').value,user_id:dataOwnerId};const q=id?client.from('fruit_inventory').update(p).eq('id',id):client.from('fruit_inventory').insert(p);const {error}=await q;if(error)return toast(error.message);$('#product-dialog').close();toast('Fruit inventory saved');loadAll()};

function saleOptions(value){$('#sale-product').innerHTML=inventory.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)} — ${x.quantity} ${esc(x.unit)}</option>`).join('');$('#sale-customer').innerHTML='<option value="">Walk-in customer</option>'+customers.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)}</option>`).join('')}
function openSale(s){$('#sale-form').reset();saleOptions(s?.customer_id);$('#sale-id').value=s?.id||'';$('#sale-title').textContent=s?'Edit sale':'Record sale';$('#sale-product').value=s?.product_id||$('#sale-product').value;$('#sale-customer').value=s?.customer_id||'';$('#sale-qty').value=s?.quantity??1;const p=inventory.find(x=>x.id===$('#sale-product').value);$('#sale-price').value=s?.unit_price??p?.selling_price??0;$('#sale-payment').value=s?.payment_method||'M-Pesa';$('#sale-code').value=s?.mpesa_code||'';$('#void-sale').classList.toggle('hidden',!s||role==='cashier');updateSaleHelp();$('#sale-dialog').showModal()}window.editSale=id=>openSale(sales.find(x=>x.id===id));
$('#new-sale').onclick=()=>openSale();$('#sale-product').onchange=()=>{const p=inventory.find(x=>x.id===$('#sale-product').value);if(p)$('#sale-price').value=p.selling_price};$('#sale-payment').onchange=updateSaleHelp;
function updateSaleHelp(){const n=localStorage.getItem('irris_mpesa_number')||'';$('#sale-mpesa-help').textContent=$('#sale-payment').value==='M-Pesa'?(n?`Ask customer to send payment to ${n}.`:'Set your M-Pesa number under More → M-Pesa.') :''}
$('#sale-form').onsubmit=async e=>{e.preventDefault();if(!can('sales'))return toast('Your staff role cannot record sales');const id=$('#sale-id').value,p=inventory.find(x=>x.id===$('#sale-product').value),qty=+$('#sale-qty').value;if(!p)return toast('Add fruit inventory first');const old=id?sales.find(x=>x.id===id):null,available=p.quantity+(old?.product_id===p.id?old.quantity:0);if(qty>available)return toast(`Only ${available} ${p.unit} available`);if(old){const oldP=inventory.find(x=>x.id===old.product_id);if(oldP)await client.from('fruit_inventory').update({quantity:oldP.quantity+old.quantity}).eq('id',oldP.id)}const sale={product_id:p.id,product_name:p.name,quantity:qty,unit_price:+$('#sale-price').value,unit_cost:p.cost_price,payment_method:$('#sale-payment').value,mpesa_code:$('#sale-code').value.trim()||null,user_id:dataOwnerId};if(upgradeReady)sale.customer_id=$('#sale-customer').value||null;const {error}=id?await client.from('fruit_sales').update(sale).eq('id',id):await client.from('fruit_sales').insert(sale);if(error)return toast(error.message);await client.from('fruit_inventory').update({quantity:available-qty}).eq('id',p.id);$('#sale-dialog').close();toast(id?'Sale updated':'Sale recorded');loadAll()};
$('#void-sale').onclick=async()=>{if(role!=='owner'&&role!=='manager')return toast('Only the owner or manager can void sales');const id=$('#sale-id').value,s=sales.find(x=>x.id===id);if(!s||!confirm('Void sale and restore its stock?'))return;const p=inventory.find(x=>x.id===s.product_id);if(p)await client.from('fruit_inventory').update({quantity:p.quantity+s.quantity}).eq('id',p.id);const {error}=await client.from('fruit_sales').delete().eq('id',id);if(error)return toast(error.message);$('#sale-dialog').close();toast('Sale voided and stock restored');loadAll()};

$('#new-expense').onclick=()=>openExpense();function openExpense(x){$('#expense-form').reset();$('#expense-id').value=x?.id||'';$('#expense-title').textContent=x?'Edit expense':'Add expense';$('#expense-category').value=x?.category||'Transport';$('#expense-amount').value=x?.amount??'';$('#expense-note').value=x?.note||'';$('#expense-dialog').showModal()}window.editExpense=id=>openExpense(expenses.find(x=>x.id===id));
$('#expense-form').onsubmit=async e=>{e.preventDefault();if(!can('expenses'))return toast('Your staff role cannot change expenses');const id=$('#expense-id').value,p={category:$('#expense-category').value,amount:+$('#expense-amount').value,note:$('#expense-note').value.trim()||null,user_id:dataOwnerId};const {error}=id?await client.from('business_expenses').update(p).eq('id',id):await client.from('business_expenses').insert(p);if(error)return toast(error.message);$('#expense-dialog').close();toast('Expense saved');loadAll()};

function needUpgrade(){if(upgradeReady)return false;toast('Finish the database upgrade first');return true}
function renderContacts(){$('#customers-list').innerHTML=customers.map(x=>row(x.name,`${x.phone||'No phone'}${x.notes?' · '+x.notes:''}`,'',can('customers')?`<button class="mini" onclick="editContact('customer','${x.id}')">Edit</button>`:'')).join('')||empty(upgradeReady?'No customers yet':'Database upgrade required');$('#suppliers-list').innerHTML=suppliers.map(x=>row(x.name,`${x.phone||'No phone'}${x.notes?' · '+x.notes:''}`,'',can('suppliers')?`<button class="mini" onclick="editContact('supplier','${x.id}')">Edit</button>`:'')).join('')||empty(upgradeReady?'No suppliers yet':'Database upgrade required')}
$$('[data-contact-tab]').forEach(b=>b.onclick=()=>{$$('[data-contact-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#customer-tools').classList.toggle('hidden',b.dataset.contactTab!=='customers');$('#supplier-tools').classList.toggle('hidden',b.dataset.contactTab!=='suppliers')});
$('#new-customer').onclick=()=>openContact('customer');$('#new-supplier').onclick=()=>openContact('supplier');
function openContact(type,x){if(needUpgrade())return;$('#contact-form').reset();$('#contact-id').value=x?.id||'';$('#contact-type').value=type;$('#contact-title').textContent=`${x?'Edit':'Add'} ${type}`;$('#contact-name').value=x?.name||'';$('#contact-phone').value=x?.phone||'';$('#contact-notes').value=x?.notes||'';$('#contact-dialog').showModal()}window.editContact=(type,id)=>openContact(type,(type==='customer'?customers:suppliers).find(x=>x.id===id));
$('#contact-form').onsubmit=async e=>{e.preventDefault();const type=$('#contact-type').value;if(!can(type==='customer'?'customers':'suppliers'))return toast('Your staff role cannot change this');const table=type==='customer'?'customers':'suppliers',id=$('#contact-id').value,p={name:$('#contact-name').value.trim(),phone:$('#contact-phone').value.trim()||null,notes:$('#contact-notes').value.trim()||null,user_id:dataOwnerId};const {error}=id?await client.from(table).update(p).eq('id',id):await client.from(table).insert(p);if(error)return toast(error.message);$('#contact-dialog').close();toast(`${type} saved`);loadAll()};

function renderPurchases(){$('#purchases-list').innerHTML=purchases.map(x=>row(`${x.product_name} × ${x.quantity}`,`${fmt(x.created_at)} · ${x.supplier_name}${x.note?' · '+x.note:''}`,money(x.quantity*x.unit_cost))).join('')||empty(upgradeReady?'No supplier purchases yet':'Database upgrade required')}
$('#new-purchase').onclick=()=>{if(needUpgrade())return;if(!suppliers.length)return toast('Add a supplier first');if(!inventory.length)return toast('Add fruit inventory first');$('#purchase-form').reset();$('#purchase-supplier').innerHTML=suppliers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');$('#purchase-product').innerHTML=inventory.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');const p=inventory[0];$('#purchase-cost').value=p?.cost_price||0;$('#purchase-dialog').showModal()};
$('#purchase-product').onchange=()=>{const p=inventory.find(x=>x.id===$('#purchase-product').value);if(p)$('#purchase-cost').value=p.cost_price};
$('#purchase-form').onsubmit=async e=>{e.preventDefault();if(!can('purchases'))return toast('Your staff role cannot record purchases');const product=inventory.find(x=>x.id===$('#purchase-product').value),supplier=suppliers.find(x=>x.id===$('#purchase-supplier').value),qty=+$('#purchase-qty').value,cost=+$('#purchase-cost').value;const record={user_id:dataOwnerId,product_id:product.id,product_name:product.name,supplier_id:supplier.id,supplier_name:supplier.name,quantity:qty,unit_cost:cost,note:$('#purchase-note').value.trim()||null};const {data,error}=await client.from('supplier_purchases').insert(record).select().single();if(error)return toast(error.message);const up=await client.from('fruit_inventory').update({quantity:product.quantity+qty,cost_price:cost}).eq('id',product.id);if(up.error){await client.from('supplier_purchases').delete().eq('id',data.id);return toast(up.error.message)}$('#purchase-dialog').close();toast('Purchase saved and stock added');loadAll()};

function renderStaff(){$('#staff-list').innerHTML=staff.map(x=>row(x.name,x.email,`<span class="role">${esc(x.role.replace('_',' '))}</span>`,role==='owner'?`<button class="mini" onclick="toggleStaff('${x.id}',${!x.active})">${x.active?'Disable':'Enable'}</button>`:'')).join('')||empty(upgradeReady?'No staff permissions yet':'Database upgrade required')}
$('#new-staff').onclick=()=>{if(needUpgrade())return;$('#staff-form').reset();$('#staff-dialog').showModal()};
$('#staff-form').onsubmit=async e=>{e.preventDefault();if(role!=='owner')return toast('Only the owner can manage staff');const p={owner_id:dataOwnerId,name:$('#staff-name').value.trim(),email:$('#staff-email').value.trim().toLowerCase(),role:$('#staff-role').value,active:true};const {error}=await client.from('staff_profiles').insert(p);if(error)return toast(error.message);$('#staff-dialog').close();toast('Staff permission saved');loadAll()};
window.toggleStaff=async(id,active)=>{if(role!=='owner')return;const {error}=await client.from('staff_profiles').update({active}).eq('id',id);if(error)return toast(error.message);toast(active?'Staff enabled':'Staff disabled');loadAll()};

function monthKey(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`}
function renderReport(){const m=$('#report-month').value||monthKey(new Date()),ss=sales.filter(x=>monthKey(x.created_at)===m),ee=expenses.filter(x=>monthKey(x.created_at)===m),revenue=ss.reduce((a,x)=>a+x.quantity*x.unit_price,0),cogs=ss.reduce((a,x)=>a+x.quantity*x.unit_cost,0),expense=ee.reduce((a,x)=>a+x.amount,0);$('#report-revenue').textContent=money(revenue);$('#report-gross').textContent=money(revenue-cogs);$('#report-expenses').textContent=money(expense);$('#report-profit').textContent=money(revenue-cogs-expense);const methods=['M-Pesa','Cash','Bank','Credit'];$('#payment-report').innerHTML=methods.map(k=>row(k,`${ss.filter(x=>x.payment_method===k).length} transactions`,money(ss.filter(x=>x.payment_method===k).reduce((a,x)=>a+x.quantity*x.unit_price,0)))).join('')}
$('#report-month').value=monthKey(new Date());$('#report-month').onchange=renderReport;$('#print-report').onclick=()=>window.print();

window.showReceipt=id=>{const s=sales.find(x=>x.id===id),c=customers.find(x=>x.id===s?.customer_id),n=localStorage.getItem('irris_mpesa_number')||'';if(!s)return;$('#receipt-content').innerHTML=`<h3>Irris Fruits Deli</h3><p class="muted">Customer receipt</p><p>${esc(fmt(s.created_at))}</p><div class="receipt-line"><span>Customer</span><b>${esc(c?.name||'Walk-in customer')}</b></div><div class="receipt-line"><span>${esc(s.product_name)} × ${s.quantity}</span><b>${money(s.quantity*s.unit_price)}</b></div><div class="receipt-line"><span>Payment</span><b>${esc(s.payment_method)}</b></div>${s.payment_method==='M-Pesa'&&s.mpesa_code?`<div class="receipt-line"><span>M-Pesa code</span><b>${esc(s.mpesa_code)}</b></div>`:''}${s.payment_method==='M-Pesa'&&n?`<div class="receipt-line"><span>Paid to</span><b>${esc(n)}</b></div>`:''}<div class="receipt-line receipt-total"><span>Total</span><b>${money(s.quantity*s.unit_price)}</b></div><p>Thank you for supporting Irris Fruits Deli.</p>`;$('#receipt-dialog').showModal()};$('#print-receipt').onclick=()=>window.print();

function renderMpesa(){const n=localStorage.getItem('irris_mpesa_number')||'';$('#mpesa-number').value=n;$('#mpesa-display').textContent=n;$('#mpesa-card').classList.toggle('hidden',!n)}
$('#mpesa-form').onsubmit=e=>{e.preventDefault();const n=$('#mpesa-number').value.trim();localStorage.setItem('irris_mpesa_number',n);renderMpesa();toast('M-Pesa number saved on this device')};

start();
