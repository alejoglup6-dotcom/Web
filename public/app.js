
(function(){
"use strict";
var S={tienda:{nombre:"PcuecaSport",ciudad:"",whatsapp:"",direccion:"",horario:"",bienvenida:"¡Zapatos que aguantan la masticada de verdad!"},productos:[]};
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var money=function(n){return "$ "+Number(n).toLocaleString("es-CO")};
var CATS=["Tenis","Sandalias","Zapatos","Botas","Infantil","Otros"];
var PARA=["Mujer","Hombre","Niños","Unisex"];
var DEF_ILU={Tenis:{k:"sneaker",c:"#e3e9f4",s:"#c5cee0"},Sandalias:{k:"sandal",c:"#c58a54",s:"#efe6d8"},Zapatos:{k:"loafer",c:"#3b2a20",s:"#20150e"},Botas:{k:"loafer",c:"#5a3a22",s:"#2a1a10"},Infantil:{k:"sneaker",c:"#f2a65a",s:"#fff"},Otros:{k:"sneaker",c:"#cdd6e6",s:"#aab6cd"}};

var admin=false,preview=false,A=null,U=null;
var route={n:"home"},cat="Todo",q="",ord={z:null,q:1},F=null,busy=false;

/* ---------- Ilustraciones de respaldo (cuando no hay fotos) ---------- */
function shoe(k,c,s){
  var id="g"+Math.random().toString(36).slice(2,7);
  var d='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>',b="";
  if(k==="sandal"){
    b='<path d="M16 96c40 8 100 4 168-22l6 10c-62 30-132 32-172 16z" fill="'+s+'"/><path d="M26 92h36l-4 22H30z" fill="'+c+'"/><path d="M24 88C70 94 130 86 188 66l-2 10C130 96 70 100 24 96z" fill="'+c+'"/><path d="M64 84c8-34 34-46 64-38l-4 14c-20-6-34 2-40 26z" fill="'+c+'"/><path d="M64 84c8-34 34-46 64-38l-4 14c-20-6-34 2-40 26z" fill="url(#'+id+')"/><path d="M126 52c22 2 38 8 54 16l-4 10c-16-8-32-14-52-14z" fill="'+c+'"/><rect x="116" y="44" width="14" height="16" rx="3" fill="#e9d9b5" stroke="#8a6a3a" stroke-width="2"/>';
  }else if(k==="loafer"){
    b='<path d="M12 96c0 10 26 14 90 14s92-4 92-18v-6H12z" fill="'+s+'"/><path d="M14 90c-2-22 8-34 28-40 20-4 34-2 48 4 20 8 56 8 90 22 6 3 10 8 10 14z" fill="'+c+'"/><path d="M14 90c-2-22 8-34 28-40 20-4 34-2 48 4 20 8 56 8 90 22 6 3 10 8 10 14z" fill="url(#'+id+')"/><path d="M70 58c14 4 26 4 38 0v10c-12 4-26 4-38 0z" fill="#d9b365" stroke="#9c7a30" stroke-width="2"/>';
  }else{
    b='<path d="M10 90c0 12 22 18 92 18 62 0 92-4 92-20v-8H10z" fill="'+s+'"/><path d="M14 86c0-24 6-38 24-44l32-6c10-14 28-16 38-2 16 22 46 28 74 36 10 3 12 10 10 16H14z" fill="'+c+'"/><path d="M14 86c0-24 6-38 24-44l32-6c10-14 28-16 38-2 16 22 46 28 74 36 10 3 12 10 10 16H14z" fill="url(#'+id+')"/><g stroke="'+s+'" stroke-width="3" stroke-linecap="round"><path d="M78 42l14 8M90 36l14 10M102 36l12 12"/></g>';
  }
  return '<svg viewBox="0 0 204 124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustración de calzado">'+d+b+'</svg>';
}
function illu(p){var i=p.ilu||DEF_ILU[p.categoria]||DEF_ILU.Otros;return shoe(i.k,i.c,i.s)}

/* ---------- Utilidades ---------- */
function totalU(p){return p.tallas.reduce(function(a,t){return a+(+t.u||0)},0)}
function sortSizes(a){return a.slice().sort(function(x,y){var nx=parseFloat(x.t),ny=parseFloat(y.t);if(!isNaN(nx)&&!isNaN(ny))return nx-ny;return String(x.t).localeCompare(String(y.t))})}
function isAdmin(){return admin&&!preview}
function findP(id){return S.productos.filter(function(p){return p.id===id})[0]}
var tt;function toast(t){var e=$("#toast");if(!e){e=document.createElement("div");e.id="toast";e.className="toast glass";e.setAttribute("role","status");document.body.appendChild(e)}e.textContent=t;void e.offsetWidth;e.classList.add("on");clearTimeout(tt);tt=setTimeout(function(){e.classList.remove("on")},2600)}
function askConfirm(msg,okLabel){
  return new Promise(function(res){
    var d=document.createElement("div");d.className="confirm";
    d.innerHTML='<div class="box glass" role="alertdialog" aria-modal="true"><p>'+esc(msg)+'</p><div class="grp"><button class="btn neu-sm press" data-v="0">Cancelar</button><button class="btn pri press" data-v="1">'+esc(okLabel||"Aceptar")+'</button></div></div>';
    d.addEventListener("click",function(e){var b=e.target.closest("[data-v]");if(b||e.target===d){d.remove();res(!!b&&b.dataset.v==="1")}});
    document.body.appendChild(d);var f=$("[data-v='1']",d);if(f)f.focus();
  });
}

/* ---------- Comunicación con el servidor ---------- */
async function api(path,opt){
  opt=opt||{};
  var r=await fetch(path,{method:opt.method||"GET",headers:opt.body?{"Content-Type":"application/json"}:undefined,body:opt.body?JSON.stringify(opt.body):undefined,credentials:"same-origin"});
  var j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){var er=new Error((j&&j.error)||"No se pudo completar la acción.");er.status=r.status;throw er}
  return j;
}
async function commit(next,msg){
  setBusy(true);
  try{
    var res=await api("/api/store",{method:"PUT",body:{tienda:next.tienda,productos:next.productos}});
    S=res;toast(msg);closeSheet();render();return true;
  }catch(e){
    if(e.status===401){admin=false;render();toast("Tu sesión terminó. Entra de nuevo.")}
    else toast(e.message||"No se pudo guardar. Intenta de nuevo.");
    return false;
  }finally{setBusy(false)}
}
function setBusy(b){
  busy=b;var s=$("#fsave");
  if(s){s.classList.toggle("dis",b);s.innerHTML=b?'<span class="spinner"></span> Guardando…':s.dataset.label}
}
function openLogin(){
  openSheet("Acceso administrador",'<div class="field"><label for="pw">Contraseña</label><input class="inp" id="pw" type="password" autocomplete="current-password"></div><div class="ferr" id="ferr" role="alert"></div>','<button class="btn neu-sm press" data-act="close" type="button">Cancelar</button><button class="btn pri press" id="fsave" data-act="dologin" data-label="Entrar" type="button">Entrar</button>');
  setTimeout(function(){var i=$("#pw");if(i)i.focus()},450);
}
async function doLogin(){
  var pw=$("#pw").value;if(!pw){$("#ferr").textContent="Escribe la contraseña.";return}
  setBusy(true);
  try{
    await api("/api/login",{method:"POST",body:{password:pw}});
    admin=true;S=await api("/api/store");closeSheet();render();toast("Bienvenido");
  }catch(e){$("#ferr").textContent=e.status===429?"Demasiados intentos. Espera unos minutos.":"Contraseña incorrecta."}
  finally{setBusy(false)}
}
async function doLogout(){
  try{await api("/api/logout",{method:"POST"})}catch(e){}
  admin=false;preview=false;try{S=await api("/api/store")}catch(e){}
  render();toast("Sesión cerrada");
}

/* ---------- WhatsApp ---------- */
function waNumber(){return String(S.tienda.whatsapp||"").replace(/\D/g,"")}
function waLink(p,z,n){
  var num=waNumber();if(!num)return "#";
  var url="";try{url=location.href.split("#")[0]+"#/p/"+p.id;if(url.indexOf("http")!==0)url=""}catch(e){}
  var txt="Hola, quiero ordenar:\n• "+p.nombre+(p.marca?" ("+p.marca+")":"")+"\n• Talla: "+z+"\n• Cantidad: "+n+"\n• Total: "+money(p.precio*n)+(url?"\n"+url:"");
  return "https://wa.me/"+num+"?text="+encodeURIComponent(txt);
}
function waGeneral(){var num=waNumber();return num?"https://wa.me/"+num+"?text="+encodeURIComponent("Hola, quisiera más información sobre el calzado."):"#"}

/* ---------- Render ---------- */
var ICO={wa:'<svg viewBox="0 0 24 24" style="fill:var(--ok);stroke:none"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.500 6.500 0 01-3.200-2.800c-.2-.4.2-.4.7-1.300.1-.2 0-.3 0-.5l-.7-1.600c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.300-.9.900-.9 2.200s.9 2.500 1 2.700c.1.200 1.800 2.800 4.400 3.900 1.600.7 2.200.7 3 .6.500-.1 1.400-.6 1.600-1.200.2-.6.2-1.100.1-1.200l-.5-.3z"/></svg>',
 back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
 search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'};

function adminBar(){
  if(!isAdmin())return "";
  return '<div class="adminbar glass"><b>Modo administrador</b><div class="grp"><button class="btn pri sm press" data-act="new">+ Nuevo artículo</button><button class="btn neu-sm sm press" data-act="settings">Ajustes</button><button class="btn neu-sm sm press" data-act="preview">Ver como cliente</button><button class="btn neu-sm sm press" data-act="logout">Salir</button></div></div>';
}
function previewPill(){return (admin&&preview)?'<button class="btn pri floatpill press" data-act="unpreview">Volver al modo administrador</button>':""}

function render(){
  var el=$("#app");document.title=S.tienda.nombre;el.classList.remove("page-enter");void el.offsetWidth;el.classList.add("page-enter");
  if(route.n==="p"){var p=findP(route.id);if(p&&(p.visible||isAdmin()))return renderDetail(el,p);route={n:"home"}}
  renderHome(el);
}
function renderHome(el){
  var t=S.tienda;
  el.innerHTML='<header class="top glass"><div class="row"><div><div class="logo">'+esc(t.nombre)+'</div><div class="city">'+esc(t.ciudad)+'</div></div><a class="circle neu-sm press" id="hwa" href="'+waGeneral()+'" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">'+ICO.wa+'</a></div>'+
  '<form class="search neu-in" id="sform" role="search">'+ICO.search+'<input id="q" type="search" placeholder="Buscar zapatos" aria-label="Buscar zapatos" value="'+esc(q)+'" autocomplete="off"></form></header>'+
  '<div class="wrap">'+adminBar()+'<section class="hero-banner"><div class="hero-copy"><img class="brand-lockup" src="/pcueca-banner.png" alt="Pcueca Sport: zapatos que aguantan la masticada"><span class="eyebrow">PCUECA SPORT · ZAPATOS CON ACTITUD</span><h1>¡Aguantan la<br><em>masticada!</em></h1><p>'+(esc(t.bienvenida||'Calzado con personalidad, resistencia y estilo para cada aventura.'))+'</p><div class="delivery-note">⌖ Domicilios en todo el perímetro de Santa Marta</div><a class="btn pri press" href="#catalogo">Ver la colección <span>↗</span></a></div><div class="hero-orbit"><div class="orbit-ring"></div><div class="hero-shoe hero-real-shoe"><div class="shoe-glow"></div><img src="/pcueca-emblema.png" alt="PcuecaSport perros y zapatos"><span class="bite-mark">✦</span></div><span class="hero-float f1">✦ Resistente</span><span class="hero-float f2">★ Favoritos</span></div></section><section class="brand-gallery"><img src="/pcueca-poster.png" alt="PcuecaSport en su tienda ilustrada"><div><span class="eyebrow">LA HISTORIA PCUECA</span><h2>Hechos para aguantarlo todo.</h2><p>Una marca con carácter, humor y zapatos listos para cualquier aventura.</p></div></section></div>'+
  '<nav class="cats" id="cats" aria-label="Categorías"></nav>'+
  '<main class="wrap" id="catalogo"><div class="section-heading"><div><span class="eyebrow">SELECCIÓN CURADA</span><h2>Encuentra tu próximo par</h2></div><span class="catalog-count" id="catalog-count"></span></div><div class="grid" id="grid"></div></main>'+
  '<div class="wrap"><footer><div class="box neu"><h4>'+esc(t.nombre)+'</h4>'+(t.direccion?'<p>'+esc(t.direccion)+', '+esc(t.ciudad)+'</p>':'<p>'+esc(t.ciudad)+'</p>')+(t.horario?'<p>'+esc(t.horario)+'</p>':'')+'<p style="margin-top:14px"><a class="btn wa press" id="fwa" href="'+waGeneral()+'" target="_blank" rel="noopener">Escribir por WhatsApp</a></p>'+(admin?'':'<p style="margin-top:6px"><button class="btn neu-sm sm press" data-act="login" type="button">Acceso administrador</button></p>')+'</div></footer></div>'+previewPill();
  renderCats();renderGrid();
}
function visibles(){return S.productos.filter(function(p){return p.visible||isAdmin()})}
function renderCats(){
  var set=["Todo"];visibles().forEach(function(p){if(set.indexOf(p.categoria)<0)set.push(p.categoria)});
  if(set.indexOf(cat)<0)cat="Todo";
  $("#cats").innerHTML=set.map(function(c){return '<button class="neu-sm press'+(c===cat?' on':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>'}).join("");
}
function cardHTML(p){
  var tot=totalU(p),low=tot>0&&tot<=5,img=p.fotos&&p.fotos[0]?'<img src="'+p.fotos[0]+'" alt="'+esc(p.nombre)+'" loading="lazy">':illu(p);
  var off=p.precioAntes>p.precio?Math.round((1-p.precio/p.precioAntes)*100):0;
  var tags=(!p.visible?'<span class="tag gray">Oculto</span>':'')+(tot===0?'<span class="tag gray">Agotado</span>':(low?'<span class="tag warn">Pocas unidades</span>':''))+(off&&tot>0?'<span class="tag">-'+off+'%</span>':'');
  return '<article class="card neu in" data-id="'+esc(p.id)+'"><a href="#/p/'+esc(p.id)+'" data-go="'+esc(p.id)+'" aria-label="Ver '+esc(p.nombre)+'"><div class="pic neu-in">'+img+'<div class="tags">'+tags+'</div></div>'+
  '<div class="meta"><h3>'+esc(p.nombre)+'</h3><div class="brandn">'+esc(p.marca||p.categoria)+'</div><div class="price">'+money(p.precio)+(p.precioAntes>p.precio?'<span class="old">'+money(p.precioAntes)+'</span>':'')+'</div></div></a>'+
  (isAdmin()?'<div class="arow"><button class="neu-sm press" data-act="edit" data-id="'+esc(p.id)+'">Editar</button><button class="neu-sm press" data-act="toggle" data-id="'+esc(p.id)+'">'+(p.visible?'Ocultar':'Publicar')+'</button><button class="neu-sm press danger" data-act="del" data-id="'+esc(p.id)+'">Eliminar</button></div>':'')+'</article>';
}
function renderGrid(){
  var qq=q.trim().toLowerCase();
  var l=visibles().filter(function(p){
    if(cat!=="Todo"&&p.categoria!==cat)return false;
    if(qq&&(p.nombre+" "+p.marca+" "+p.categoria+" "+p.para).toLowerCase().indexOf(qq)<0)return false;
    return true;
  });
  var g=$("#grid");
  if(l.length)g.innerHTML=l.map(cardHTML).join("");
  else g.innerHTML='<div class="empty neu-in">'+(S.productos.length?'No encontramos artículos con esa búsqueda.':'Aún no hay artículos publicados.'+(isAdmin()?' Usa “Nuevo artículo” para crear el primero.':''))+'</div>';
}

function renderDetail(el,p){
  var t=S.tienda,tot=totalU(p),tallas=sortSizes(p.tallas);
  var first=tallas.filter(function(x){return +x.u>0})[0];
  ord={z:first?first.t:null,q:1};
  var fotos=p.fotos&&p.fotos.length?p.fotos:null;
  var slides=fotos?fotos.map(function(s,i){return '<div class="slide"><img src="'+s+'" alt="'+esc(p.nombre)+' foto '+(i+1)+'" data-zoom="'+i+'"></div>'}).join(''):'<div class="slide ill">'+illu(p)+'</div>';
  var thumbs=fotos&&fotos.length>1?'<div class="thumbs" id="thumbs">'+fotos.map(function(s,i){return '<button class="neu-sm'+(i===0?' on':'')+'" data-th="'+i+'" aria-label="Ver foto '+(i+1)+'"><img src="'+s+'" alt=""></button>'}).join('')+'</div>':'';
  var off=p.precioAntes>p.precio?Math.round((1-p.precio/p.precioAntes)*100):0;
  el.innerHTML='<header class="top glass"><div class="row"><a class="back neu-sm press" href="#/" data-go="">'+ICO.back+' Volver</a><div class="logo" style="font-size:26px">'+esc(t.nombre)+'</div><span style="width:44px"></span></div></header>'+
  '<div class="wrap">'+adminBar()+'<div class="detail"><section aria-label="Fotos"><div class="gal neu" id="gal">'+slides+'</div>'+thumbs+'</section>'+
  '<section class="info"><h1>'+esc(p.nombre)+'</h1><div class="bn">'+esc([p.marca,p.categoria,p.para].filter(Boolean).join(" · "))+(!p.visible?' · Oculto para clientes':'')+'</div>'+
  '<div class="bigprice">'+money(p.precio)+(p.precioAntes>p.precio?'<span class="old">'+money(p.precioAntes)+'</span><span class="off">-'+off+'%</span>':'')+'</div>'+
  (p.descripcion?'<p class="desc">'+esc(p.descripcion)+'</p>':'')+
  '<div class="lbl">Talla</div><div class="sizes" id="sizes">'+tallas.map(function(x){return '<button class="neu-sm press'+(+x.u<=0?' out':'')+'" data-z="'+esc(x.t)+'" '+(+x.u<=0?'disabled ':'')+'aria-label="Talla '+esc(x.t)+(+x.u<=0?' agotada':'')+'">'+esc(x.t)+'</button>'}).join('')+'</div><div class="stocknote" id="snote"></div>'+
  '<div class="lbl">Cantidad</div><div class="qtyrow"><button class="neu-sm press" id="qm" aria-label="Quitar una">−</button><b id="qv">1</b><button class="neu-sm press" id="qp" aria-label="Agregar una">+</button></div>'+
  '<div class="totalrow"><span>Total</span><span id="tot">'+money(p.precio)+'</span></div>'+
  '<a class="btn wa press" id="order" href="#" target="_blank" rel="noopener">Ordenar ahora por WhatsApp</a><div class="hint" id="ohint"></div>'+
  '</section></div></div>'+previewPill();
  var gal=$("#gal"),th=$("#thumbs");
  if(gal&&th)gal.addEventListener("scroll",function(){var i=Math.round(gal.scrollLeft/gal.clientWidth);Array.prototype.forEach.call(th.children,function(b,k){b.classList.toggle("on",k===i)})},{passive:true});
  updateOrder(p);
}
function updateOrder(p){
  var u=0;if(ord.z!==null){var r=p.tallas.filter(function(x){return String(x.t)===String(ord.z)})[0];u=r?+r.u:0}
  if(ord.q>u)ord.q=Math.max(1,u);if(ord.q<1)ord.q=1;
  Array.prototype.forEach.call(document.querySelectorAll("#sizes button"),function(b){b.classList.toggle("on",String(b.dataset.z)===String(ord.z))});
  $("#qv").textContent=ord.q;$("#tot").textContent=money(p.precio*ord.q);
  var n=$("#snote"),o=$("#order"),h=$("#ohint");
  if(ord.z===null){n.textContent="Todas las tallas están agotadas.";n.className="stocknote warn";o.classList.add("dis");o.removeAttribute("href");o.textContent="Sin unidades";h.textContent="";return}
  n.textContent=u<=5?"Quedan "+u+(u===1?" unidad":" unidades")+" en la talla "+ord.z:"Disponible en la talla "+ord.z;n.className="stocknote"+(u<=5?" warn":"");
  o.classList.remove("dis");o.textContent="Ordenar ahora por WhatsApp";
  if(waNumber()){o.href=waLink(p,ord.z,ord.q);h.textContent="Se abrirá WhatsApp con tu pedido listo para enviar."}
  else{o.href="#";h.textContent=isAdmin()?"Falta tu número de WhatsApp: agrégalo en Ajustes.":"La tienda aún no configura su WhatsApp."}
  $("#qm").style.opacity=ord.q<=1?.4:1;$("#qp").style.opacity=ord.q>=u?.4:1;
}

/* ---------- Navegación ---------- */
function parseHash(){var m=(location.hash||"").match(/^#\/p\/([\w-]+)/);route=m?{n:"p",id:m[1]}:{n:"home"}}
function go(id){
  route=id?{n:"p",id:id}:{n:"home"};
  try{location.hash=id?"#/p/"+id:"#/"}catch(e){}
  render();window.scrollTo(0,0);
}
window.addEventListener("hashchange",function(){var prev=JSON.stringify(route);parseHash();if(JSON.stringify(route)!==prev){render();window.scrollTo(0,0)}});

/* ---------- Hojas (modales) ---------- */
function openSheet(title,body,foot){
  closeSheet(true);
  var r=document.createElement("div");r.id="sheetroot";
  r.innerHTML='<div class="scrim" id="scrim"></div><section class="sheet glass" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><h3>'+esc(title)+'</h3><button class="circle neu-sm press" data-act="close" aria-label="Cerrar"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:var(--brand);fill:none;stroke-width:2.4;stroke-linecap:round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="sbody">'+body+'</div><div class="sfoot">'+foot+'</div></section>';
  document.body.appendChild(r);
  requestAnimationFrame(function(){requestAnimationFrame(function(){$("#scrim").classList.add("on");$(".sheet",r).classList.add("on")})});
}
function closeSheet(now){
  var r=$("#sheetroot");if(!r)return;
  if(now){r.remove();return}
  F=null;
  $("#scrim").classList.remove("on");$(".sheet",r).classList.remove("on");setTimeout(function(){r.remove()},450);
}

/* ---------- Formulario de artículo ---------- */
function blank(){return {id:null,nombre:"",marca:"",categoria:"Tenis",para:"Unisex",descripcion:"",precio:"",precioAntes:"",tallas:[{t:"",u:""}],fotos:[],visible:true,ilu:null}}
function openProduct(p){
  F=p?JSON.parse(JSON.stringify(p)):blank();
  if(p){F.precio=String(p.precio);F.precioAntes=p.precioAntes?String(p.precioAntes):"";F.tallas=F.tallas.length?F.tallas:[{t:"",u:""}]}
  var opt=function(l,v){return l.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>'}).join("")};
  var body='<div class="field"><label for="f-nombre">Nombre del artículo</label><input class="inp" id="f-nombre" data-k="nombre" value="'+esc(F.nombre)+'" placeholder="Ej. Tenis casuales Cloud" maxlength="90"></div>'+
  '<div class="two"><div class="field"><label for="f-marca">Marca</label><input class="inp" id="f-marca" data-k="marca" value="'+esc(F.marca)+'" maxlength="40"></div>'+
  '<div class="field"><label for="f-cat">Categoría</label><select class="inp" id="f-cat" data-k="categoria">'+opt(CATS,F.categoria)+'</select></div></div>'+
  '<div class="field"><label for="f-para">Para</label><select class="inp" id="f-para" data-k="para">'+opt(PARA,F.para)+'</select></div>'+
  '<div class="field"><label for="f-desc">Descripción</label><textarea class="inp" id="f-desc" data-k="descripcion" maxlength="900" placeholder="Material, comodidad, cuidados…">'+esc(F.descripcion)+'</textarea></div>'+
  '<div class="two"><div class="field"><label for="f-precio">Precio (COP)</label><input class="inp" id="f-precio" data-k="precio" inputmode="numeric" value="'+esc(F.precio)+'" placeholder="189900"></div>'+
  '<div class="field"><label for="f-antes">Precio anterior</label><input class="inp" id="f-antes" data-k="precioAntes" inputmode="numeric" value="'+esc(F.precioAntes)+'" placeholder="Opcional"></div></div>'+
  '<div class="field"><span class="fl">Tallas y unidades disponibles</span><div id="srows"></div><button class="btn neu-sm sm press" data-act="addsize" type="button">+ Agregar talla</button>'+
  '<div class="range"><div><small>Desde</small><input class="inp" id="r-a" inputmode="numeric" placeholder="36"></div><div><small>Hasta</small><input class="inp" id="r-b" inputmode="numeric" placeholder="42"></div><div><small>Unidades c/u</small><input class="inp" id="r-u" inputmode="numeric" placeholder="2"></div><button class="btn neu-sm sm press" data-act="range" type="button">Generar</button></div>'+
  '<small>Con “Generar” creas varias tallas de una vez (por ejemplo del 36 al 42).</small></div>'+
  '<div class="field"><span class="fl">Fotos (hasta 6)</span><input type="file" id="f-files" accept="image/*" multiple class="inp" style="padding:10px 12px"><small>La primera foto es la portada. Se reducen automáticamente. Si no subes fotos se muestra una ilustración.</small><div class="photos" id="photos"></div></div>'+
  '<div class="field"><label class="check"><input type="checkbox" data-k="visible" '+(F.visible?'checked':'')+'> Visible para los clientes</label></div><div class="ferr" id="ferr" role="alert"></div>';
  var label=p?"Guardar y publicar":"Publicar artículo";
  openSheet(p?"Editar artículo":"Nuevo artículo",body,'<button class="btn neu-sm press" data-act="close" type="button">Cancelar</button><button class="btn pri press" id="fsave" data-act="save" data-label="'+label+'" type="button">'+label+'</button>');
  renderSizes();renderPhotos();
}
function renderSizes(){
  $("#srows").innerHTML=F.tallas.map(function(r,i){return '<div class="srow"><input class="inp" data-i="'+i+'" data-f="t" value="'+esc(r.t)+'" placeholder="Talla (38)" aria-label="Talla" maxlength="10"><input class="inp" data-i="'+i+'" data-f="u" value="'+esc(r.u)+'" inputmode="numeric" placeholder="Unidades" aria-label="Unidades"><button data-act="rmsize" data-i="'+i+'" type="button" aria-label="Quitar talla">✕</button></div>'}).join("");
}
function renderPhotos(){
  $("#photos").innerHTML=F.fotos.map(function(s,i){return '<div class="ph neu-in"><img src="'+s+'" alt="Foto '+(i+1)+'">'+(i===0?'<span class="cov">Portada</span>':'')+'<div class="acts">'+(i>0?'<button data-act="cover" data-i="'+i+'" type="button" aria-label="Hacer portada">★</button>':'')+'<button data-act="rmphoto" data-i="'+i+'" type="button" aria-label="Quitar foto">✕</button></div></div>'}).join("");
}
function compress(file,max,quality){
  return new Promise(function(res,rej){
    var fr=new FileReader();fr.onerror=rej;
    fr.onload=function(){var im=new Image();im.onerror=rej;im.onload=function(){
      var s=Math.min(1,max/Math.max(im.width,im.height)),w=Math.round(im.width*s),h=Math.round(im.height*s),c=document.createElement("canvas");
      c.width=w;c.height=h;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);res(c.toDataURL("image/jpeg",quality))};im.src=fr.result};
    fr.readAsDataURL(file);
  });
}
async function addPhotos(files){
  var err=$("#ferr"),n=0;
  for(var i=0;i<files.length;i++){
    if(F.fotos.length>=6){err.textContent="Máximo 6 fotos por artículo.";break}
    try{F.fotos.push(await compress(files[i],1000,.72));n++}catch(e){err.textContent="No se pudo leer una de las imágenes."}
  }
  renderPhotos();$("#f-files").value="";
}
function saveProduct(){
  var err=$("#ferr");err.textContent="";
  var nombre=F.nombre.trim();if(!nombre){err.textContent="Escribe el nombre del artículo.";$("#f-nombre").focus();return}
  var precio=parseInt(String(F.precio).replace(/\D/g,""),10)||0;if(precio<=0){err.textContent="Escribe un precio válido.";$("#f-precio").focus();return}
  var antes=parseInt(String(F.precioAntes).replace(/\D/g,""),10)||0;
  var tallas=F.tallas.filter(function(r){return String(r.t).trim()!==""}).map(function(r){return {t:String(r.t).trim(),u:Math.max(0,parseInt(r.u,10)||0)}});
  if(!tallas.length){err.textContent="Agrega al menos una talla (usa “Única” si no aplica).";return}
  var seen={};for(var i=0;i<tallas.length;i++){if(seen[tallas[i].t.toLowerCase()]){err.textContent="La talla "+tallas[i].t+" está repetida.";return}seen[tallas[i].t.toLowerCase()]=1}
  var item={id:F.id||("p"+Date.now().toString(36)),nombre:nombre,marca:F.marca.trim(),categoria:F.categoria,para:F.para,descripcion:F.descripcion.trim(),precio:precio,precioAntes:antes>precio?antes:0,tallas:sortSizes(tallas),fotos:F.fotos.slice(),visible:!!F.visible};
  if(!item.fotos.length&&F.ilu)item.ilu=F.ilu;
  var list=S.productos.slice(),ix=-1;list.forEach(function(p,k){if(p.id===item.id)ix=k});
  if(ix>=0)list[ix]=item;else list.unshift(item);
  var next=JSON.parse(JSON.stringify(S));next.productos=list;
  commit(next,ix>=0?"Artículo actualizado":"Artículo publicado");
}

/* ---------- Ajustes de tienda ---------- */
function openSettings(){
  var t=S.tienda,f=function(id,l,v,ph,extra){return '<div class="field"><label for="s-'+id+'">'+l+'</label><input class="inp" id="s-'+id+'" value="'+esc(v)+'" placeholder="'+esc(ph||"")+'" '+(extra||"")+'></div>'};
  var body=f("nombre","Nombre de la tienda",t.nombre,"",'maxlength="50"')+f("ciudad","Ciudad",t.ciudad,"",'maxlength="40"')+
  f("wa","WhatsApp para pedidos",t.whatsapp,"573001234567",'inputmode="numeric"')+'<small style="display:block;margin:-6px 0 8px;color:var(--ink-soft)">Escríbelo con el indicativo del país y sin signos ni espacios. Ejemplo para Colombia: 573001234567.</small>'+
  f("dir","Dirección",t.direccion,"Calle 1 # 2-3",'maxlength="90"')+f("hor","Horario",t.horario,"Lunes a sábado, 9:00 a 18:00",'maxlength="90"')+
  '<div class="field"><label for="s-bien">Mensaje de bienvenida</label><textarea class="inp" id="s-bien" maxlength="200">'+esc(t.bienvenida)+'</textarea></div><div class="ferr" id="ferr" role="alert"></div>';
  openSheet("Ajustes de la tienda",body,'<button class="btn neu-sm press" data-act="close" type="button">Cancelar</button><button class="btn pri press" id="fsave" data-act="savesettings" data-label="Guardar" type="button">Guardar</button>');
}
function saveSettings(){
  var wa=$("#s-wa").value.replace(/\D/g,"");
  if(wa&&wa.length<8){$("#ferr").textContent="El número de WhatsApp parece incompleto.";return}
  var nombre=$("#s-nombre").value.trim();if(!nombre){$("#ferr").textContent="La tienda necesita un nombre.";return}
  var next=JSON.parse(JSON.stringify(S));
  next.tienda={nombre:nombre,ciudad:$("#s-ciudad").value.trim(),whatsapp:wa,direccion:$("#s-dir").value.trim(),horario:$("#s-hor").value.trim(),bienvenida:$("#s-bien").value.trim()};
  commit(next,"Ajustes guardados");
}

/* ---------- Eventos ---------- */
document.addEventListener("input",function(e){
  var t=e.target;
  if(t.id==="q"){q=t.value;renderGrid();return}
  if(!F)return;
  if(t.dataset&&t.dataset.k){F[t.dataset.k]=t.type==="checkbox"?t.checked:t.value;return}
  if(t.dataset&&t.dataset.f){F.tallas[+t.dataset.i][t.dataset.f]=t.value}
});
document.addEventListener("change",function(e){
  var t=e.target;
  if(F&&t.dataset&&t.dataset.k){F[t.dataset.k]=t.type==="checkbox"?t.checked:t.value}
  if(t.id==="f-files"&&F){addPhotos(Array.prototype.slice.call(t.files))}
});
document.addEventListener("submit",function(e){if(e.target.id==="sform"){e.preventDefault();var i=$("#q");if(i)i.blur()}});
document.addEventListener("click",async function(e){
  var t=e.target;
  var go_=t.closest("[data-go]");
  if(go_&&!t.closest("[data-act]")){e.preventDefault();go(go_.dataset.go||null);return}
  var cb=t.closest("[data-cat]");if(cb){cat=cb.dataset.cat;renderCats();renderGrid();return}
  var z=t.closest("#sizes button");
  if(z&&!z.disabled){ord.z=z.dataset.z;ord.q=1;updateOrder(findP(route.id));return}
  if(t.closest("#qm")){ord.q--;updateOrder(findP(route.id));return}
  if(t.closest("#qp")){ord.q++;updateOrder(findP(route.id));return}
  var ord_=t.closest("#order");
  if(ord_&&!waNumber()){e.preventDefault();toast(isAdmin()?"Configura tu WhatsApp en Ajustes":"La tienda aún no configura su WhatsApp");return}
  if(t.closest("#hwa,#fwa")&&!waNumber()){e.preventDefault();toast(isAdmin()?"Configura tu WhatsApp en Ajustes":"La tienda aún no configura su WhatsApp");return}
  var th=t.closest("[data-th]");if(th){var g=$("#gal");g.scrollTo({left:g.clientWidth*(+th.dataset.th),behavior:"smooth"});return}
  var zm=t.closest("[data-zoom]");
  if(zm){var p0=findP(route.id);var lb=document.createElement("div");lb.className="lightbox";lb.innerHTML='<img src="'+p0.fotos[+zm.dataset.zoom]+'" alt="Foto ampliada">';lb.onclick=function(){lb.remove()};document.body.appendChild(lb);return}
  if(t.id==="scrim"){if(!busy)closeSheet();return}
  var b=t.closest("[data-act]");if(!b)return;
  var a=b.dataset.act,id=b.dataset.id;
  if(a==="close"){if(!busy)closeSheet()}
  else if(a==="login"){openLogin()}
  else if(a==="dologin"){if(!busy)doLogin()}
  else if(a==="logout"){doLogout()}
  else if(a==="new"){openProduct(null)}
  else if(a==="edit"){openProduct(findP(id))}
  else if(a==="settings"){openSettings()}
  else if(a==="preview"){preview=true;render()}
  else if(a==="unpreview"){preview=false;render()}
  else if(a==="addsize"){F.tallas.push({t:"",u:""});renderSizes()}
  else if(a==="rmsize"){F.tallas.splice(+b.dataset.i,1);if(!F.tallas.length)F.tallas.push({t:"",u:""});renderSizes()}
  else if(a==="range"){
    var x=parseInt($("#r-a").value,10),y=parseInt($("#r-b").value,10),u=parseInt($("#r-u").value,10)||0;
    if(isNaN(x)||isNaN(y)||y<x||y-x>30){$("#ferr").textContent="Revisa el rango de tallas (ej. 36 a 42).";return}
    $("#ferr").textContent="";
    F.tallas=F.tallas.filter(function(r){return String(r.t).trim()!==""});
    for(var n=x;n<=y;n++){if(!F.tallas.some(function(r){return String(r.t).trim()===String(n)}))F.tallas.push({t:String(n),u:String(u)})}
    renderSizes();
  }
  else if(a==="rmphoto"){F.fotos.splice(+b.dataset.i,1);renderPhotos()}
  else if(a==="cover"){var i=+b.dataset.i,s=F.fotos.splice(i,1)[0];F.fotos.unshift(s);renderPhotos()}
  else if(a==="save"){if(!busy)saveProduct()}
  else if(a==="savesettings"){if(!busy)saveSettings()}
  else if(a==="toggle"){
    var next=JSON.parse(JSON.stringify(S));next.productos.forEach(function(p){if(p.id===id)p.visible=!p.visible});
    var np=next.productos.filter(function(p){return p.id===id})[0];commit(next,np.visible?"Artículo publicado":"Artículo oculto");
  }
  else if(a==="del"){
    var pp=findP(id);
    if(await askConfirm("¿Eliminar “"+pp.nombre+"”? Esta acción no se puede deshacer.","Eliminar")){
      var n2=JSON.parse(JSON.stringify(S));n2.productos=n2.productos.filter(function(p){return p.id!==id});commit(n2,"Artículo eliminado");
    }
  }
});
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="pw"&&!busy){e.preventDefault();doLogin();return}if(e.key==="Escape"&&!busy){closeSheet();var l=$(".lightbox");if(l)l.remove()}});

/* ---------- Inicio ---------- */
parseHash();
$("#app").innerHTML='<p style="text-align:center;padding:80px 20px;color:var(--ink-soft)">Cargando tienda…</p>';
(async function(){
  try{var m=await api("/api/me");admin=!!m.admin}catch(e){}
  try{S=await api("/api/store")}catch(e){toast("No se pudo cargar la tienda")}
  render();
})();
})();
