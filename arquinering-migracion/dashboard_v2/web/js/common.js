/* Helpers compartidos: formato es-AR, fetch, paleta. */
const PALETA = {
  verde:'#00843B', rojo:'#C00000', amarillo:'#FFD400', azul:'#3a7bd5',
  gris:'#F2F2F2', grisTxt:'#5a615e', negro:'#000'
};

const _nf0 = new Intl.NumberFormat('es-AR',{maximumFractionDigits:0});
const _nf1 = new Intl.NumberFormat('es-AR',{maximumFractionDigits:1});
const _nf2 = new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const NBSP = ' ';

/* $ compacto para headline: 994.598.033 -> "$994,60 M" · negativos con −, sin cortes */
function money(x){
  if(x===null||x===undefined||isNaN(x)) return '—';
  const s = x<0?'−':'';
  return s+'$'+_nf2.format(Math.abs(x)/1e6)+NBSP+'M';
}
/* $ completo con separador de miles (tablas auditables): "$176.000" / "−$2.017.474" */
function pesos(x){
  if(x===null||x===undefined||isNaN(x)) return '—';
  const s = x<0?'−':'';
  return s+'$'+_nf0.format(Math.abs(x));
}
function pct(x,dec=1){
  if(x===null||x===undefined||isNaN(x)) return '—';
  return (dec?_nf1:_nf0).format(x*100)+'%';
}
/* fecha nivel movimiento: dd/mm/aaaa (parseo por partes = sin corrimiento de huso) */
function fecha(iso){
  if(!iso) return '—';
  const p = String(iso).slice(0,10).split('-');
  if(p.length===3) return `${p[2]}/${p[1]}/${p[0]}`;
  const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('es-AR');
}
/* mes calendario: "mmm aaaa" (UTC para no correr el día) */
function mesAnio(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('es-AR',{month:'short',year:'numeric',timeZone:'UTC'});
}
/* pill de razón del semáforo — acepta string (legacy) o {txt, sev} */
function pill(r){
  const txt = (r && r.txt!==undefined) ? r.txt : r;
  const sev = (r && r.sev) ? r.sev : '';
  return el('span',{class:'pill '+sev}, txt);
}
/* fecha del dato (mtime del Excel en epoch segundos) → "dd/mm/aaaa hh:mm" */
function fechaDato(mtime){
  if(!mtime) return '—';
  const d = new Date(mtime*1000);
  if(isNaN(d)) return '—';
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+
    ' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}
async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok){ const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
  return r.json();
}
function el(tag, attrs={}, ...kids){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k==='class') n.className=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on')) n.addEventListener(k.slice(2),v);
    else if(v!==null&&v!==undefined) n.setAttribute(k,v);
  }
  for(const kid of kids){ if(kid!=null) n.append(kid.nodeType?kid:document.createTextNode(kid)); }
  return n;
}
