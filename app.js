let products = [];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = n => `₹${n.toLocaleString('en-IN')}`;
let cart = JSON.parse(localStorage.getItem('zubis-cart') || '[]');
let activeCategory = 'All';
let searchQuery = '';
let pendingWhatsAppUrl = '';
const productGrid = document.querySelector('#product-grid');
const cartDrawer = document.querySelector('.cart-drawer');
const drawerOverlay = document.querySelector('.drawer-overlay');
const toast = document.querySelector('.toast');

function currentProducts(){
  const sort = document.querySelector('#sort-products').value;
  let list = products.filter(p => (activeCategory === 'All' || p.category === activeCategory) && `${escapeHtml(p.name)} ${escapeHtml(p.description)}`.toLowerCase().includes(searchQuery));
  if(sort === 'low') list.sort((a,b) => a.price-b.price);
  if(sort === 'high') list.sort((a,b) => b.price-a.price);
  return list;
}
function renderProducts(){
  const list = currentProducts();
  productGrid.innerHTML = list.map(p => `<article class="product-card"><div class="product-image ${p.image ? 'has-photo' : (p.kind || '')}" style="--image-position:${p.imagePosition || '50% 50%'};--product-bg:${p.bg};--jar-color:${p.jar};--tilt:${p.id.includes('squash')?'3deg':'-4deg'}" data-label="${escapeHtml(p.label)}">${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">` : ''}${p.badge ? `<span class="badge">${p.badge}</span>` : ''}</div><div class="product-info"><span class="product-category">${p.category === 'Drinks' ? 'Fruit squash' : p.category}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-bottom"><span class="price">${currency(p.price)}</span><button class="add-button" data-add="${p.id}" aria-label="Add ${escapeHtml(p.name)} to bag">+</button></div></div></article>`).join('');
  document.querySelector('.empty-state').hidden = !!list.length;
}
function saveCart(){localStorage.setItem('zubis-cart', JSON.stringify(cart));}
function cartDetails(){return cart.map(item => ({...products.find(p=>p.id===item.id),quantity:item.quantity})).filter(x=>x.name);}
function renderCart(){
  const details = cartDetails(); const qty = details.reduce((sum,item)=>sum+item.quantity,0); const total = details.reduce((sum,item)=>sum+item.price*item.quantity,0);
  document.querySelectorAll('.cart-count').forEach(el=>el.textContent=qty);
  document.querySelectorAll('.cart-total').forEach(el=>el.textContent=currency(total));
  document.querySelector('.cart-items').innerHTML = details.map(item=>`<div class="cart-item"><div class="cart-thumb ${item.image ? 'has-photo' : ''}" style="--image-position:${item.imagePosition || '50% 50%'};--product-bg:${item.bg}" data-icon="${item.kind==='cookies'?'●':'z'}">${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : ''}</div><div><h3>${escapeHtml(item.name)}</h3><div class="price">${currency(item.price)}</div><div class="quantity"><button data-change="${item.id}" data-delta="-1" aria-label="Decrease ${escapeHtml(item.name)}">−</button><span>${item.quantity}</span><button data-change="${item.id}" data-delta="1" aria-label="Increase ${escapeHtml(item.name)}">+</button></div></div><button class="remove-item" data-remove="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join('');
  document.querySelector('.cart-empty').hidden = !!details.length; document.querySelector('.cart-summary').hidden = !details.length;
  saveCart();
}
function addProduct(id){const existing=cart.find(item=>item.id===id);if(existing) existing.quantity++;else cart.push({id,quantity:1});renderCart();showToast('Added to your bag');}
function changeQuantity(id,delta){const item=cart.find(x=>x.id===id);if(!item)return;item.quantity+=delta;if(item.quantity<1)cart=cart.filter(x=>x.id!==id);renderCart();}
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
function openCart(){cartDrawer.classList.add('open');drawerOverlay.classList.add('open');cartDrawer.setAttribute('aria-hidden','false')}
function closeCart(){cartDrawer.classList.remove('open');drawerOverlay.classList.remove('open');cartDrawer.setAttribute('aria-hidden','true')}

function toggleMobileMenu(forceClose = false){
  const b = document.querySelector('.mobile-menu');
  const nav = document.querySelector('.site-header nav');
  const overlay = document.querySelector('.mobile-nav-overlay');
  if(!b || !nav) return;
  const isOpen = forceClose ? false : !b.classList.contains('open');
  b.classList.toggle('open', isOpen);
  b.setAttribute('aria-expanded', String(isOpen));
  nav.classList.toggle('open', isOpen);
  overlay?.classList.toggle('open', isOpen);
}

document.addEventListener('click',event=>{
  const add=event.target.closest('[data-add]'); if(add){addProduct(add.dataset.add);return;}
  const change=event.target.closest('[data-change]'); if(change){changeQuantity(change.dataset.change,Number(change.dataset.delta));return;}
  const remove=event.target.closest('[data-remove]'); if(remove){cart=cart.filter(x=>x.id!==remove.dataset.remove);renderCart();return;}
  if(event.target.closest('.cart-button')) openCart();
  if(event.target.closest('.close-drawer') || event.target===drawerOverlay) closeCart();
  const filter=event.target.closest('.filter'); if(filter){activeCategory=filter.dataset.category;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===filter));renderProducts();}
  const categoryLink=event.target.closest('[data-go-category]'); if(categoryLink){activeCategory=categoryLink.dataset.goCategory;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x.dataset.category===activeCategory));setTimeout(renderProducts,0);}
  if(event.target.closest('.search-toggle')){toggleMobileMenu(true);document.querySelector('#shop').scrollIntoView();setTimeout(()=>document.querySelector('#product-search').focus(),500)}
  if(event.target.closest('.mobile-menu')){toggleMobileMenu();return;}
  if(event.target.closest('.mobile-nav-overlay')){toggleMobileMenu(true);return;}
  if(event.target.closest('.site-header nav a')){toggleMobileMenu(true);}
  if(event.target.closest('.checkout-start')){if(!cart.length){showToast('Your bag is empty');return;}closeCart();document.querySelector('.checkout-dialog').showModal();}
  if(event.target.closest('.dialog-close'))event.target.closest('dialog').close();
  const policy=event.target.closest('.policy-button');if(policy){showPolicy(policy.dataset.policy)}
  if(event.target.closest('.confirm-cancel'))document.querySelector('.confirm-dialog').close();
  if(event.target.closest('.confirm-order'))window.open(pendingWhatsAppUrl,'_blank','noopener');
});
document.querySelector('#product-search').addEventListener('input',e=>{searchQuery=e.target.value.trim().toLowerCase();renderProducts()});
document.querySelector('#sort-products').addEventListener('change',renderProducts);
document.querySelector('#newsletter-form').addEventListener('submit',e=>{e.preventDefault();e.currentTarget.reset();e.currentTarget.querySelector('.form-message').textContent='Thank you - you are on the list!';});
document.querySelector('#checkout-form').addEventListener('submit',e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);const error=e.currentTarget.querySelector('.checkout-error');
  const name=form.get('name').trim(),phone=form.get('phone').trim(),address=form.get('address').trim(),notes=form.get('notes').trim();
  if(!name||!phone||!address){error.textContent='Please complete your name, phone number, and delivery address.';return} if(!/^[0-9+\-\s()]{7,}$/.test(phone)){error.textContent='Please enter a valid phone number.';return}error.textContent='';
  const details=cartDetails();const total=details.reduce((sum,x)=>sum+x.price*x.quantity,0),qty=details.reduce((sum,x)=>sum+x.quantity,0);
  const lines=['Hi, I would like to place an order for:',''];details.forEach((item,i)=>lines.push(`${i+1}. ${escapeHtml(item.name)}`,`   Quantity: ${item.quantity}`,`   Price: ${currency(item.price)}`,`   Subtotal: ${currency(item.price*item.quantity)}`,''));lines.push('-------------------------',`Total Items: ${qty}`,`Total Bill: ${currency(total)}`,'Delivery Charges: To be confirmed based on location (if applicable).',`Grand Total: ${currency(total)} + Delivery Charges (if applicable)`,'-------------------------','','Customer Details',`Name: ${name}`,`Phone: ${phone}`,`Address: ${address}`,'','Notes:',notes||'None.','','Thank you.');
  pendingWhatsAppUrl=`https://wa.me/9846525325?text=${encodeURIComponent(lines.join('\n'))}`;document.querySelector('.checkout-dialog').close();document.querySelector('.confirm-dialog').showModal();
});
function showPolicy(type){const content=document.querySelector('.policy-content');const copy=type==='shipping'?{title:'Shipping policy',body:'Orders are confirmed personally by the Zubi’s team through WhatsApp. Delivery availability, timing, and any applicable delivery charge will be shared before your order is finalised.'}:{title:'Privacy policy',body:'Details you submit through the order form are used only to prepare and respond to your WhatsApp order enquiry. This demonstration site does not collect payment details or create customer accounts.'};content.innerHTML=`<h2>${copy.title}</h2><p>${copy.body}</p>`;document.querySelector('.policy-dialog').showModal()}
document.querySelector('#year').textContent=new Date().getFullYear();
async function loadCatalog(){
  try {
    const response=await fetch('/api/products',{cache:'no-store'});
    if(!response.ok) throw new Error('Catalog unavailable');
    products=await response.json();renderProducts();renderCart();checkUrlCart();
  } catch(error){productGrid.textContent='Unable to load products. Please refresh the page.';}
}
function checkUrlCart(){
  const params=new URLSearchParams(window.location.search);
  if(window.location.hash==='#cart'||params.get('cart')==='open'){
    if(!cart.length&&products.length){
      cart=[{id:products[0].id,quantity:2},{id:(products[1]||products[0]).id,quantity:1}];
      renderCart();
    }
    openCart();
  }
}
loadCatalog();
window.addEventListener('hashchange',checkUrlCart);
window.addEventListener('pageshow',event=>{if(event.persisted)loadCatalog()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCatalog()});

