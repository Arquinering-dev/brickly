/* Industrial Integrity — P0 Fundaciones.
   Shell (sidebar navy + topbar + grilla 8/4) + componentes base reutilizables,
   renderizados con datos REALES de una obra (lee /api/obras/GDR del reader). */

/* ---------- iconos (SVG monocromo stroke, on-brand) ---------- */
const ICONS = {
  portfolio:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  dashboard:'<path d="M3 13a9 9 0 0 1 18 0"/><path d="M12 13l4-3"/><circle cx="12" cy="13" r="1.4"/>',
  budget:'<line x1="4" y1="20" x2="4" y2="11"/><line x1="10" y1="20" x2="10" y2="5"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="2" y1="20" x2="20" y2="20"/>',
  cash:'<path d="M3 16l5-5 4 3 6-7"/><path d="M21 7v4h-4"/>',
  progress:'<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  resources:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.8"/>',
  report:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.4a2 2 0 0 1 0-4h.2A1.6 1.6 0 0 0 6 8.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H11a1.6 1.6 0 0 0 1-1.5V4a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V11a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>',
  export:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
};
function icon(name){
  return el('span',{class:'ic-wrap', html:
    `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`}).firstChild;
}

/* ---------- navegación (7 módulos; el activo se pasa por arg) ---------- */
const NAV = [
  {id:'portfolio', icon:'portfolio', label:'Portfolio'},
  {id:'dashboard', icon:'dashboard', label:'Dashboard'},
  {id:'control',   icon:'budget',    label:'Control Ppto'},
  {id:'cash',      icon:'cash',      label:'Flujo de Caja'},
  {id:'avance',    icon:'progress',  label:'Avance y Cert.'},
  {id:'recursos',  icon:'resources', label:'Compromisos y Recursos'},
  {id:'reporte',   icon:'report',    label:'Reporte Ejec.'},
];

function mesLabel(iso){ if(!iso) return '';
  const d=new Date(iso); return isNaN(d)?iso:
    d.toLocaleDateString('es-AR',{month:'short',year:'2-digit',timeZone:'UTC'}).replace(/\sde\s/,' ').replace('.',''); }
function sidebar(active, obraCode){
  const base = obraCode?('/ds/obra/'+obraCode):null;
  const href = {portfolio:'/ds', dashboard:base, control:base?(base+'/control'):null,
    cash:base?(base+'/cash'):null, avance:base?(base+'/avance'):null,
    recursos:base?(base+'/recursos'):null, reporte:base?(base+'/reporte'):null};
  const nav = el('nav',{class:'ds-nav'});
  for(const it of NAV){
    nav.append(el('a',{class:it.id===active?'active':'', 'data-id':it.id, href:href[it.id]||null},
      icon(it.icon), el('span',{}, it.label)));
  }
  return el('aside',{class:'ds-sidebar'},
    el('div',{class:'ds-logo'}, el('span',{class:'mark'},'A'), el('span',{},'Arquinering')),
    el('div',{class:'ds-navlabel'}, 'Control de Gestión'),
    nav,
    el('div',{class:'ds-side-foot'},
      el('div',{class:'ds-user'}, el('span',{class:'av'},'PP'),
        el('div',{}, el('div',{style:'color:#fff'},'Pedro P.'), el('div',{style:'font-size:11px'},'Socio')))));
}

function topbar(crumbMain, crumbTail){
  return el('header',{class:'ds-topbar'},
    el('div',{class:'ds-crumb'}, el('span',{class:'dim'},'Arquinering'),
      el('span',{class:'sep'},'/'), el('span',{}, crumbMain),
      crumbTail?el('span',{class:'sep'},'/'):null, crumbTail?el('span',{class:'dim'}, crumbTail):null),
    el('div',{class:'ds-search'}, icon('search'),
      el('input',{type:'text', placeholder:'Buscar rubro, contrato, certificado…'})),
    el('div',{class:'ds-top-actions'},
      el('button',{class:'ds-iconbtn', title:'Alertas'}, icon('bell')),
      el('button',{class:'ds-iconbtn', title:'Config'}, icon('gear')),
      el('button',{class:'btn btn-primary'}, icon('export'), 'Exportar')));
}

/* ================= COMPONENTES BASE REUTILIZABLES ================= */
function dsKpi(label, value, opts={}){
  return el('div',{class:'ds-kpi'+(opts.accent?' accent '+opts.accent:'')},
    el('div',{class:'k'}, opts.tip?dsItip(opts.tip):null, label),
    el('div',{class:'v '+(opts.vcls||'')}, value),
    opts.delta?el('div',{class:'delta '+(opts.deltaDir||'')}, opts.delta):null,
    opts.sub?el('div',{class:'sub'}, opts.sub):null);
}
function dsCard(title, opts={}, ...content){
  const head = el('div',{class:'ds-card-head'},
    el('h3',{}, title), opts.sub?el('span',{class:'sub'}, opts.sub):null,
    el('div',{class:'actions'}, opts.tip?dsItip(opts.tip):null, opts.action||null));
  const body = el('div',{class:'ds-card-body'+(opts.flush?' flush':'')});
  content.forEach(c=>c&&body.append(c));
  return el('div',{class:'ds-card'}, head, body);
}
function dsTable(cols, rows, opts={}){
  const thead = el('thead',{}, el('tr',{}, ...cols.map(c=>
    el('th',{class:c.num?'num':''}, c.label))));
  const tbody = el('tbody',{});
  for(const r of rows){
    const kids = opts.children ? opts.children(r) : null;
    const tr = el('tr', opts.rowAttrs?opts.rowAttrs(r):{});
    cols.forEach((c,ci)=>{
      if(ci===0 && kids && kids.length){
        const tog = el('span',{class:'tg'},'▸');
        tr.append(el('td',{class:c.num?'num':''}, tog, c.cell(r))); tr._tog=tog;
      } else tr.append(el('td',{class:c.num?'num':''}, c.cell(r)));
    });
    tbody.append(tr);
    if(kids && kids.length){
      const ktr = kids.map(k=> k._grp
        ? el('tr',{class:'child grp-head',style:'display:none'},
            el('td',{colspan:String(opts.childCols.length)}, k._grp))
        : el('tr',{class:'child',style:'display:none'},
            ...opts.childCols.map(cc=>el('td',{class:cc.num?'num':''}, cc.cell(k)))));
      ktr.forEach(t=>tbody.append(t));
      tr.classList.add('grp'); tr.style.cursor='pointer';
      tr.addEventListener('click',()=>{ const open=ktr[0].style.display!=='none';
        ktr.forEach(t=>t.style.display=open?'none':''); if(tr._tog) tr._tog.textContent=open?'▸':'▾'; });
    }
  }
  if(opts.total) tbody.append(opts.total);
  return el('table',{class:'ds-table'}, thead, tbody);
}
function agrupar(items, keyFn, sumFn){
  const m=new Map();
  for(const it of items){ const k=keyFn(it)||'(sin dato)';
    if(!m.has(k)) m.set(k,{key:k,items:[],s1:0,s2:0,n:0});
    const g=m.get(k); g.items.push(it); g.n++; const [a,b]=sumFn(it); g.s1+=a; g.s2+=b; }
  return [...m.values()];
}
function dsDot(level){ return el('span',{class:'dot '+(level||'verde')}); }
function dotLabel(level, txt){ return el('span',{class:'dot-label'}, dsDot(level), txt); }
function dsBar(actual, planned, level){
  const a = Math.min(Math.max(actual||0,0),1);
  const bar = el('div',{class:'dbar'}, el('i',{class:level||'', style:`width:${a*100}%`}));
  if(planned!=null) bar.append(el('span',{class:'plan', style:`left:${Math.min(planned,1)*100}%`}));
  return bar;
}
function barCell(actual, planned, level){
  return el('div',{class:'bar-cell'}, dsBar(actual,planned,level),
    el('span',{class:'pctv'}, pct(actual,0)));
}
function spill(level, txt){ return el('span',{class:'spill '+level}, dsDot(level), txt); }
function dsItip(txt, align){
  if(!txt) return null;
  return el('span',{class:'itip'+(align==='left'?' l':''), tabindex:'0', onclick:e=>e.stopPropagation()},
    el('span',{class:'itip-i'},'i'), el('span',{class:'itip-pop'}, txt));
}
function dsWip(title, note){
  return el('div',{class:'ds-wip'},
    el('span',{class:'tag'},'WIP · dato no disponible aún'),
    el('div',{class:'title'}, title),
    el('div',{class:'note'}, note));
}
function sparkline(vals, w=200, h=36){
  const xs = (vals&&vals.length>1) ? vals : [0,0];
  const mn=Math.min(...xs,0), mx=Math.max(...xs,0), rng=(mx-mn)||1, pad=3;
  const X=i=> pad + i*(w-2*pad)/((xs.length-1)||1);
  const Y=v=> h-pad - ((v-mn)/rng)*(h-2*pad);
  const dline = xs.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  const zy = Y(0).toFixed(1);
  const dots = xs.map((v,i)=>v<0?`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.2" fill="#ba1a1a"/>`:'').join('');
  return el('span',{class:'spark', html:
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`+
    `<line x1="0" y1="${zy}" x2="${w}" y2="${zy}" stroke="#c5c6cd" stroke-width="1" stroke-dasharray="3 3"/>`+
    `<path d="${dline}" fill="none" stroke="#091426" stroke-width="1.6"/>${dots}</svg>`});
}
function sumRow(label, value, opts={}){
  return el('div',{class:'sumrow'},
    opts.dot?dsDot(opts.dot):null,
    el('span',{class:'lab'}, label),
    el('span',{class:'val '+(opts.vcls||'')}, value));
}

/* ================= SHOWCASE con datos reales ================= */
const SEV2LVL = {critico:'rojo', atencion:'amarillo', info:'verde'};
function consumoLvl(p){ return p>1?'crit':(p>0.85?'warn':'ok'); }
function consumoDotLvl(p){ return p>1?'rojo':(p>0.85?'amarillo':'verde'); }
// margen ppto por tarea/rubro = PV ÷ Costo. Referencia = margen global de la obra (auto-calibra).
let _margenRef = null;
function margenDotLvl(m){ return m<1 ? 'rojo' : ((_margenRef && m < _margenRef*0.98) ? 'amarillo' : 'verde'); }
function margenCell(m){
  if(m==null) return el('span',{class:'muted-note'},'—');
  return el('span',{class:'mgn', title:'Margen ppto = Precio venta ÷ Costo'},
    dsDot(margenDotLvl(m)), ' '+m.toFixed(2).replace('.',',')+'×');
}
// proporción Blanco/Negro de un {blanco, negro}; null si no hay datos
function bnPct(bn){
  bn=bn||{}; const b=bn.blanco||0, n=bn.negro||0, tot=b+n;
  if(tot<=0) return null;
  return 'B '+pct(b/tot,0)+' · N '+pct(n/tot,0);
}

/* card KPI con dos métricas en barra (avance + consumo), con leyenda "i" */
function dsKpiDual(title, rows, tip){
  return el('div',{class:'ds-kpi dual'},
    el('div',{class:'k'}, tip?dsItip(tip):null, title),
    ...rows.map(rw=>el('div',{class:'pf-bar'},
      el('div',{class:'lbl'}, el('span',{}, rw.label),
        el('span',{class:'mono', style:rw.crit?'color:var(--crit)':''}, rw.pct)),
      dsBar(rw.actual, rw.planned, rw.level))));
}
/* link "ver módulo →" reusable (navega al módulo de detalle) */
function verModulo(code, mod){
  return el('a',{class:'card-link', href:'/ds/obra/'+encodeURIComponent(code)+'/'+mod},
    'ver módulo ', el('span',{},'→'));
}
/* Banner de gaps de datos (huecos que deben verse, no rellenarse en silencio).
   d.data_gaps = [{tipo, sev: critico|atencion, detalle}]. */
function gapsBanner(gaps){
  if(!gaps || !gaps.length) return null;
  const peor = gaps.some(g=>g.sev==='critico') ? 'crit' : 'warn';
  return el('div',{class:'ds-gaps '+peor},
    el('div',{class:'ds-gaps-h'},
      el('span',{class:'ds-gaps-i'}, peor==='crit'?'🔴':'🟡'),
      'Gaps de datos · '+gaps.length,
      dsItip('Datos que faltan o no concilian. No se rellenan con cero/nominal en silencio: se muestran para gestionarlos.')),
    ...gaps.map(g=>el('div',{class:'ds-gap'},
      dsDot(SEV2LVL[g.sev]||'amarillo'), el('span',{}, g.detalle))));
}

async function renderDashboard(code){
  const app = document.getElementById('app');
  let d;
  try{ d = await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error leyendo la obra: '+e.message)); return; }
  const m=d.meta, r=d.resumen, cp=d.control_ppto;
  const cons=r.consumido_pct||0, av=r.avance_fisico_pct||0, tt=r.tiempo_transcurrido_pct||0;

  // KPI row (4 cards): Presupuesto · Avance+Consumo (unificada) · Resultado+Valle · Margen
  const kpis = el('div',{class:'kpi-row'},
    dsKpi('Presupuesto costo', money(r.ppto_costo),
      {accent:'', sub:'venta '+money(r.ppto_venta),
       tip:'Costo presupuestado de la obra (lo que financia el fideicomiso) y su precio de venta (lo que Arquinering certifica y factura).'}),
    dsKpiDual('Avance físico / Consumo ppto', [
      {label:'Avance físico', pct:pct(av,0), actual:av, planned:tt, level:'nav'},
      {label:'Consumo ppto', pct:pct(cons,0), actual:cons, planned:1, level:consumoLvl(cons), crit:cons>1},
    ], 'Avance físico = certificado ÷ presupuesto de venta (ponderado por etapa); la marca de la barra es el % de tiempo transcurrido. Consumo ppto = gasto deflactado por CAC ÷ presupuesto de costo; la marca es el 100% (verde <85%, naranja 85–100%, rojo >100%).'),
    dsKpi('Resultado acum.', money(r.resultado_acumulado),
      {accent:r.resultado_acumulado<0?'crit':'ok', vcls:r.resultado_acumulado<0?'crit':'ok',
       sub:'valle de caja '+money(r.caja_valle),
       tip:'Resultado acumulado = ingresos − egresos, mes a mes corrido. Valle de caja = el mínimo de ese acumulado = pico de financiamiento que la obra necesita en su peor momento.'}),
    dsKpi('Margen de obra', pct(r.margen_pct,0),
      {accent:r.margen_pct<0?'crit':'ok', vcls:r.margen_pct<0?'crit':'',
       sub:money(r.ppto_venta-r.ppto_costo)+' · venta − costo',
       tip:'Margen presupuestado = (precio de venta − costo) ÷ precio de venta. Es la rentabilidad planificada de la obra.'}));

  // --- Control Presupuestario AGRUPADO EN BLOQUES (Obra/rubro + Generales + Directos + Indirectos) ---
  const bloques = cp.bloques || [];
  const consF = b => { const st=b.subtotal||{}; return st.consumido_pct!=null?st.consumido_pct:(st.acum_descontado>0?1.2:0); };
  const tPres = bloques.reduce((a,b)=>a+((b.subtotal||{}).presupuestado||0),0);
  const tGast = bloques.reduce((a,b)=>a+((b.subtotal||{}).acum_descontado||0),0);
  const totalRow = el('tr',{class:'total'},
    el('td',{},'TOTAL'), el('td',{class:'num'}, pesos(tPres)),
    el('td',{class:'num'}, pesos(tGast)), el('td',{}, pct(tPres?tGast/tPres:0,0)));
  const bloqueTabla = dsTable([
    {label:'Bloque', cell:b=>el('span',{}, b.nombre,
       b.key==='obra'?el('span',{class:'meta-id', style:'margin-left:7px'},'rubros'):null)},
    {label:'Presupuestado', num:true, cell:b=>pesos((b.subtotal||{}).presupuestado)},
    {label:'Gastado (defl.)', num:true, cell:b=>pesos((b.subtotal||{}).acum_descontado)},
    {label:'Consumo', cell:b=>{const f=consF(b); return barCell(f,1,consumoLvl(f));}},
  ], bloques, {total:totalRow,
     rowAttrs:b=>({class:'rowlink', title:'Ver detalle por rubro/cuenta en Control Ppto',
       onclick:()=>location.href='/ds/obra/'+encodeURIComponent(code)+'/control'})});
  const controlCard = dsCard('Control Presupuestario', {sub:'por bloque · clic → detalle',
      action: verModulo(code,'control'),
      tip:'El presupuesto se controla en bloques. "Costo de Obra" suma los rubros de obra (rama 53); su gasto deflactado es el mismo número que el Consumo ppto de arriba. Gastos Generales / Directos / Indirectos se presupuestan aparte (1_GGBB). Consumo = gastado deflactado ÷ presupuestado.'},
    bloqueTabla);

  // panel derecho: Alertas
  const alertCard = dsCard('Alertas', {sub:({verde:'En control',amarillo:'Atención',rojo:'Riesgo'}[d.semaforo.nivel])},
    el('div',{}, ...d.semaforo.razones.map(rz=>
      el('div',{class:'alert-item'}, dsDot(SEV2LVL[rz.sev]||'verde'),
        el('div',{}, el('div',{class:'txt'}, rz.txt),
          el('div',{class:'sev'}, ({critico:'Crítico',atencion:'Atención',info:'Info'}[rz.sev]||'')))))));

  // --- Flujo de Caja (sección propia, ancho completo, con "ver módulo") ---
  const cf=d.cash_flow||{}, S=cf.series||{}, acum=S.resultado_acumulado||[];
  const cobradoAcum=(S.ingresos||[]).reduce((a,v)=>a+(v||0),0);
  const egresosAcum=(S.total_egresos||[]).reduce((a,v)=>a+(v||0),0);
  const cashCard = dsCard('Flujo de Caja', {sub:'resultado acumulado · ingresos vs egresos',
      action: verModulo(code,'cash'),
      tip:'Resultado acumulado mes a mes. La línea baja a rojo en los meses con caja negativa (pico de financiamiento = valle). El detalle mensual y el drill por mes están en el módulo.'},
    el('div',{class:'dash-split'},
      el('div',{class:'dash-split-main'},
        el('div',{class:'bignum '+(r.resultado_acumulado<0?'crit':'ok')}, money(r.resultado_acumulado)),
        el('div',{class:'muted-note', style:'margin:2px 0 8px'}, 'resultado acumulado actual'),
        sparkline(acum, 360, 48)),
      el('div',{class:'dash-split-side'},
        sumRow('Cobrado (ingresos acum.)', money(cobradoAcum), {dot:'verde'}),
        sumRow('Egresos acumulados', money(egresosAcum), {}),
        sumRow('Valle de caja', money(r.caja_valle), {dot:r.caja_valle<0?'rojo':'verde', vcls:r.caja_valle<0?'crit':''}),
        sumRow('Meses con caja < 0', String(r.meses_negativos||0), {dot:r.meses_negativos?'amarillo':'verde'}))));

  // --- Certificación y Facturación (sección propia, debajo del flujo, con "ver módulo") ---
  const ce=d.certificaciones||{};
  const certCard = dsCard('Certificación y Facturación', {sub:'avance certificado · cert → factura → cobro',
      action: verModulo(code,'avance'),
      tip:'Certificado de avance = certificación de obra ejecutada (no incluye el anticipo). El anticipo se factura/cobra aparte y se recupera vía desacopio en cada certificación. El flujo cert→factura→cobro y el detalle por OC están en el módulo.'},
    el('div',{class:'dash-split'},
      el('div',{class:'dash-split-main'},
        el('div',{class:'bignum'}, money(ce.certificado_avance)),
        el('div',{class:'muted-note', style:'margin:2px 0 8px'}, 'certificado de avance · '+pct(av,0)+' físico')),
      el('div',{class:'dash-split-side'},
        sumRow('Anticipo (facturado/cobrado)', money(ce.anticipo), {}),
        sumRow('Pendiente de facturar', money(ce.certificado_pendiente), {dot:ce.certificado_pendiente>0?'amarillo':'verde'}),
        sumRow('Pendiente de cobro', money(ce.facturado_pendiente), {dot:ce.facturado_pendiente>0?'amarillo':'verde'}),
        sumRow('Cobrado', money(ce.cobrado), {dot:'verde', vcls:'ok'}))));

  // ensamble
  const content = el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{}, m.nombre||m.code),
        el('div',{class:'subtitle'}, (m.estado||'')+' · ',
          el('span',{class:'meta-id'}, 'datos al '+fechaDato(m.mtime)))),
      el('div',{style:'display:flex;gap:10px'},
        el('button',{class:'btn btn-secondary'}, 'Filtros'),
        el('button',{class:'btn btn-warning'}, icon('export'), 'Reporte'))),
    gapsBanner(d.data_gaps),
    kpis,
    el('div',{class:'grid-8-4'}, controlCard, alertCard),
    el('div',{class:'stack-md', style:'margin-top:var(--md)'}, cashCard, certCard),
    el('div',{style:'margin-top:24px;font-size:11px;color:var(--on-surface-variant);font-family:var(--font-mono)'},
      'DASHBOARD · datos reales del Resumen v8 ('+(m.archivo||'')+') vía reader. Sin datos ficticios.'));

  app.innerHTML='';
  app.append(sidebar('dashboard', m.code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code, 'Dashboard'), content));
}

/* ================= MÓDULO PORTFOLIO (multi-obra) ================= */
function aggStrip(obras){
  const ok = obras.filter(o=>!o.error);
  const sum = k => ok.reduce((a,o)=>a+(o[k]||0),0);
  const aten = ok.filter(o=>['rojo','amarillo'].includes((o.semaforo||{}).nivel)).length;
  const res = sum('resultado_acumulado');
  const stat=(k,v,cls='')=>el('div',{class:'pf-stat'}, el('div',{class:'k'},k), el('div',{class:'v '+cls}, v));
  return el('div',{class:'pf-agg'},
    stat('Obras', String(ok.length)),
    stat('Cartera (ppto venta)', money(sum('ppto_venta'))),
    stat('Cobrado', money(sum('cobrado'))),
    stat('Resultado acum.', money(res), res<0?'crit':'ok'),
    stat('Requieren atención', String(aten), aten?'crit':'ok'));
}
function portfolioCard(o){
  if(o.error){
    return el('div',{class:'ds-card pf-obra', style:'cursor:default'},
      el('div',{class:'ds-card-body'},
        el('div',{class:'pf-obra-head'}, el('span',{class:'nom'}, o.nombre||o.code)),
        el('div',{class:'muted-note', style:'color:var(--crit);margin-top:8px'}, '⚠ '+o.error)));
  }
  const sem=o.semaforo||{nivel:'verde',razones:[]};
  const lvl={verde:'ok',amarillo:'warn',rojo:'crit'}[sem.nivel];
  const lab={verde:'En control',amarillo:'Atención',rojo:'Riesgo'}[sem.nivel];
  const av=o.avance_fisico_pct||0, tt=o.tiempo_transcurrido_pct||0, cons=o.consumido_pct||0, res=o.resultado_acumulado||0;
  const razTxt=(sem.razones||[]).map(r=>r.txt||r).join(' · ');
  return el('div',{class:'ds-card pf-obra', onclick:()=>location.href='/ds/obra/'+o.code},
    el('div',{class:'ds-card-body'},
      el('div',{class:'pf-obra-head'},
        el('div',{style:'flex:1'},
          el('span',{class:'nom'}, o.nombre),
          el('span',{class:'meta-id'}, (o.code||'')+(o.estado?' · '+o.estado:'')+(o.apertura_fiscal?' · '+o.apertura_fiscal:''))),
        spill(lvl, lab)),
      el('div',{class:'pf-bar'},
        el('div',{class:'lbl'}, el('span',{},'Avance físico vs tiempo'),
          el('span',{}, el('b',{class:'mono'}, pct(av,0)),' / ', el('span',{class:'mono'}, pct(tt,0)))),
        dsBar(av, tt, 'nav')),
      el('div',{class:'pf-bar'},
        el('div',{class:'lbl'}, el('span',{},'Consumo ppto'), el('span',{class:'mono'}, pct(cons,0))),
        dsBar(cons, 1, consumoLvl(cons))),
      el('div',{class:'pf-figs'},
        el('div',{}, el('div',{class:'k'},'Ppto costo'), el('div',{class:'v'}, money(o.ppto_costo))),
        el('div',{}, el('div',{class:'k'},'Cobrado'), el('div',{class:'v'}, money(o.cobrado))),
        el('div',{}, el('div',{class:'k'},'Resultado'), el('div',{class:'v '+(res<0?'crit':'ok')}, money(res)))),
      razTxt?el('div',{style:'margin-top:11px;display:flex;align-items:center;gap:6px'},
        dsItip(razTxt,'left'), el('span',{class:'muted-note'}, (sem.razones||[]).length+' alerta(s)')):null));
}
async function renderPortfolio(){
  const app=document.getElementById('app');
  let obras;
  try{ ({obras}=await getJSON('/api/obras')); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const ok=obras.filter(o=>!o.error);
  const defaultCode=(ok[0]||obras[0]||{}).code;
  const order={rojo:2,amarillo:1,verde:0};
  const sorted=obras.slice().sort((a,b)=>(order[(b.semaforo||{}).nivel]||0)-(order[(a.semaforo||{}).nivel]||0));
  const mts=obras.map(o=>o.mtime).filter(Boolean); const last=mts.length?Math.max(...mts):null;
  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{},'Cartera de Obras'),
        el('div',{class:'subtitle'}, ok.length+' obras · ',
          el('span',{class:'meta-id'}, last?('datos al '+fechaDato(last)):''))),
      el('div',{}, el('button',{class:'btn btn-warning'}, icon('export'), 'Reporte de cartera'))),
    aggStrip(obras),
    el('div',{class:'pf-grid'}, ...sorted.map(portfolioCard)));
  app.innerHTML='';
  app.append(sidebar('portfolio', defaultCode), el('div',{class:'ds-main'}, topbar('Cartera de Obras'), content));
}

/* ================= MÓDULO CONTROL PPTO ================= */
function dsKpiWip(label, note){
  return el('div',{class:'ds-kpi wip'},
    el('div',{class:'k'}, el('span',{class:'wtag'},'WIP'), label),
    el('div',{class:'v muted'},'—'),
    el('div',{class:'sub'}, note));
}
async function renderControl(code){
  const app=document.getElementById('app');
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const m=d.meta, cp=d.control_ppto, t=cp.total||{}, subc=d.subcontratos||{};
  const bloques=cp.bloques||[{key:'obra',nombre:'Costo de Obra',controlable:true,rubros:cp.rubros,subtotal:t}];
  const consF=x=>x.presupuestado?x.acum_descontado/x.presupuestado:(x.acum_descontado>0?1.2:0);
  const obraB=bloques.find(b=>b.key==='obra')||{rubros:[],subtotal:t};
  const desvTot=(obraB.rubros||[]).reduce((a,x)=>a+(x.desvio>0?x.desvio:0),0);

  const kpis=el('div',{class:'kpi-row'},
    dsKpi('Presupuesto', money(t.presupuestado), {sub:'costo controlable (obra)'}),
    dsKpiWip('Current Forecast (EAC)','estimación al cierre — dato pendiente'),
    dsKpi('Comprometido', money(subc.comprometido),
      {sub:'subcontratos', tip:'Comprometido en subcontratos (órdenes en firme). El comprometido a nivel rubro general es un dato recomendado a conseguir.'}),
    dsKpi('Gastado (defl.)', money(t.acum_descontado),
      {accent:consumoLvl((t.acum_descontado)/(t.presupuestado||1)), sub:'desvío acum. '+money(desvTot)}));

  // --- bloque OBRA (directo controlable): tabla completa + drill ---
  const so=obraB.subtotal||{}, consO=so.presupuestado?so.acum_descontado/so.presupuestado:0;
  _margenRef = cp.margen_obra || null;
  const obraTotal=el('tr',{class:'total'},
    el('td',{},'SUBTOTAL OBRA'), el('td',{},''),
    el('td',{class:'num'},pesos(so.presupuestado)), el('td',{class:'num'},pesos(so.acum_descontado)),
    el('td',{class:'num'},pesos(so.saldo)), el('td',{}, pct(consO,0)),
    el('td',{}, so.desvio>0?el('span',{class:'neg'},pesos(so.desvio)):'—'), el('td',{},''),
    el('td',{}, _margenRef?margenCell(_margenRef):''), el('td',{},''));
  const obraCard=dsCard('Costo de Obra', {sub:'directo controlable · orden de etapa · clic en un rubro → tareas y composición',
      tip:'Consumo = gasto deflactado ÷ presupuestado (verde <85%, naranja 85–100%, rojo >100%). Avance s/cert = certificado ÷ ppto venta, por rubro. Margen ppto = precio de venta ÷ costo (por rubro MT); referencia = margen global de la obra. Presupuesto de obra desde 1_Presupuesto.'},
    dsTable([
      {label:'Rubro', cell:x=>x.rubro},
      {label:'', cell:x=>el('span',{class:'meta-id'}, x.tipo)},
      {label:'Presupuestado', num:true, cell:x=>pesos(x.presupuestado)},
      {label:'Gastado (defl.)', num:true, cell:x=>pesos(x.acum_descontado)},
      {label:'Saldo', num:true, cell:x=>el('span',{class:x.saldo<0?'neg':''}, pesos(x.saldo))},
      {label:'Consumo', cell:x=>{const f=consF(x); return barCell(f,1,consumoLvl(f));}},
      {label:'Desvío', num:true, cell:x=>x.desvio>0?el('span',{class:'neg'},pesos(x.desvio)):'—'},
      {label:'Avance s/cert', cell:x=>x.avance_cert_pct==null?el('span',{class:'muted-note'},'—'):barCell(x.avance_cert_pct,null,'nav')},
      {label:'Margen ppto', cell:x=>margenCell(x.margen_pct)},
      {label:'', cell:x=>el('span',{}, dsDot(x.semaforo),' ›')},
    ], obraB.rubros, {total:obraTotal,
      rowAttrs:x=>({class:'rowlink', title:'Ver tareas y composición', onclick:()=>openRubroDrawer(code,x.rubro,x.tipo)})}));

  // --- bloques GGBB (Gastos Generales / Directos / Indirectos): MISMO formato que Costo de Obra
  //     (Presupuestado / Gastado / Saldo / Consumo / Desvío, sin avance s/cert). Presupuesto =
  //     líneas de 1_GGBB por sección; Gastado = 2_Gastos_DirInd + cuentas indirectas de Tezamat. ---
  function ggbbCard(b){
    const s=b.subtotal||{}, consB=s.presupuestado?s.acum_descontado/s.presupuestado:0;
    const rubros=b.rubros||[];
    const sub='Presupuesto '+money(s.presupuestado)+' · gastado '+money(s.acum_descontado)+' · consumido '+pct(consB,0);
    const totalRow=el('tr',{class:'total'},
      el('td',{},'SUBTOTAL'),
      el('td',{class:'num'},pesos(s.presupuestado)), el('td',{class:'num'},pesos(s.acum_descontado)),
      el('td',{class:'num'},pesos(s.saldo)), el('td',{}, pct(consB,0)),
      el('td',{}, s.desvio>0?el('span',{class:'neg'},pesos(s.desvio)):'—'));
    const gChild=[
      {cell:c=>el('span',{}, el('span',{class:'meta-id'},'cuenta'),' ', c.cuenta)},
      {num:true, cell:c=>''},
      {num:true, cell:c=>pesos(c.descontado)},
      {cell:c=>''}, {cell:c=>''}, {cell:c=>''}];
    return dsCard(b.nombre, {sub,
        tip:'Costos por fuera de la obra (se aplican al precio de venta vía coeficiente de GGBB). Presupuesto = líneas de 1_GGBB por sección. Gastado = 2_Gastos_DirInd + cuentas indirectas de Tezamat, deflactado por CAC y mapeado a su línea de presupuesto. Desplegá una línea (▸) para ver qué cuentas Tezamat la componen. Consumo = gastado deflactado ÷ presupuestado (verde <85%, naranja 85–100%, rojo >100%).'},
      dsTable([
        {label:'Concepto', cell:x=>x.sin_ppto?el('span',{}, x.rubro, ' ', el('span',{class:'meta-id'},'sin ppto')):x.rubro},
        {label:'Presupuestado', num:true, cell:x=>pesos(x.presupuestado)},
        {label:'Gastado (defl.)', num:true, cell:x=>pesos(x.acum_descontado)},
        {label:'Saldo', num:true, cell:x=>el('span',{class:x.saldo<0?'neg':''}, pesos(x.saldo))},
        {label:'Consumo', cell:x=>{const f=consF(x); return barCell(f,1,consumoLvl(f));}},
        {label:'Desvío', num:true, cell:x=>x.desvio>0?el('span',{class:'neg'},pesos(x.desvio)):'—'},
      ], rubros, {total:totalRow, children:x=>x.gastos||[], childCols:gChild}));
  }
  const monitorCards=bloques.filter(b=>b.tipo==='ggbb').map(ggbbCard);

  const td=cp.top_desvios||[];
  const desvCard=dsCard('Top desvíos', {sub:'gasto sobre presupuesto · sólo costo de obra'},
    td.length? el('div',{}, ...td.map(x=>el('div',{class:'sumrow'},
      dsDot(x.material?'rojo':'amarillo'), el('span',{class:'lab'}, x.rubro+' '+(x.tipo||'')),
      el('span',{class:'val crit'}, money(x.desvio)))))
    : el('div',{class:'muted-note'},'Sin desvíos presupuestarios.'));
  const wip=dsWip('Budget vs EAC por categoría',
    'Presupuesto vs estimación al cierre, por rubro. Slot estructural listo: se conecta cuando llegue el forecast (EAC).');

  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{},'Control Presupuestario'),
        el('div',{class:'subtitle'}, (m.nombre||m.code)+' · ',
          el('span',{class:'meta-id'},'por bloque de cuenta · clic en un rubro de obra → tareas y composición'))),
      el('div',{}, el('button',{class:'btn btn-secondary'},'Filtros'))),
    kpis,
    el('div',{class:'grid-8-4'},
      el('div',{class:'stack-md'}, obraCard, ...monitorCards),
      el('div',{class:'stack-md'}, desvCard, wip)));
  app.innerHTML='';
  app.append(sidebar('control', code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code,'Control Ppto'), content));
  const h=location.hash.match(/^#drill=(.+)\|([^|]+)$/);
  if(h) openRubroDrawer(code, decodeURIComponent(h[1]), decodeURIComponent(h[2]));
}

/* ---- drawer de drill: rubro → tareas/composición/gastos ---- */
function ensureDrawer(){
  let ov=document.getElementById('ds-dov');
  if(ov) return ov;
  ov=el('div',{class:'ds-dov', id:'ds-dov', onclick:closeDrawer});
  const dw=el('div',{class:'ds-drawer', id:'ds-drawer', onclick:e=>e.stopPropagation()});
  ov.append(dw); document.body.append(ov);
  return ov;
}
function openDrawerShell(){ ensureDrawer().classList.add('open'); return document.getElementById('ds-drawer'); }
function closeDrawer(){ const ov=document.getElementById('ds-dov'); if(ov) ov.classList.remove('open'); }
async function openRubroDrawer(code, rubro, tipo){
  const dw=openDrawerShell(); dw.innerHTML='';
  dw.append(el('div',{class:'ds-dhead'},
    el('div',{}, el('div',{class:'rt'}, rubro), el('div',{class:'st'},'Tipo '+tipo)),
    el('button',{class:'dx', onclick:closeDrawer},'✕')));
  dw.append(el('div',{class:'ds-dbody'}, el('div',{class:'muted-note'},'cargando…')));
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)+'/rubro?rubro='+encodeURIComponent(rubro)+'&tipo='+encodeURIComponent(tipo)); }
  catch(e){ dw.querySelector('.ds-dbody').replaceWith(el('div',{class:'ds-dbody', style:'color:#ba1a1a'},'Error: '+e.message)); return; }
  renderRubroDrawer(dw, d);
}
function reconChip(label, rc){
  if(!rc) return null;
  if(rc.ok) return el('span',{class:'rchip ok'}, label+' ✓');
  return el('span',{class:'rchip warn'}, label+' Δ '+money(Math.abs(rc.delta)));
}
function dInsightText(d){
  const s=d.subtotales, over=s.sobregiro>0, c=s.consumido_pct||0; let t;
  if(over) t=`Sobregiro de ${money(s.sobregiro)}: gastaste el ${pct(c,0)} del presupuesto.`;
  else if(c<0.02) t=`Rubro casi sin ejecución (${pct(c,0)} consumido). Saldo ${money(s.saldo)}.`;
  else t=`Consumiste ${pct(c,0)} del presupuesto. Saldo disponible ${money(s.saldo)}.`;
  if(d.concentracion&&d.concentracion[0]&&d.concentracion[0].pct>=0.3)
    t+=` Se concentra en ${d.concentracion[0].proveedor} (${pct(d.concentracion[0].pct,0)}).`;
  return t;
}
function tareaCell(t){
  const n=el('span',{},
    t.item?el('b',{class:'tcode'}, t.item):null,
    t.item?' ':'', t.descripcion);
  if(t.insumos&&t.insumos.length){ if(t.comp_ok===false)
    n.append(el('span',{class:'compd', title:`Composición ${pesos(t.comp_total)} ≠ monto ${pesos(t.monto)}`},'Δ '+pesos(Math.abs(t.comp_total-t.monto)))); }
  else n.append(el('span',{class:'compn'},'cotizado directo'));
  return n;
}
/* Agrupa los insumos de una tarea por tipo (MT, MO/ALB, MO/OTR) con un encabezado por grupo.
   Devuelve una lista plana con marcadores {_grp} que dsTable renderiza como fila-encabezado. */
const _INSUMO_GRUPOS=[
  ['MAT','MT · Materiales'],
  ['ALB','MO/ALB · Mano de obra propia (UOCRA)'],
  ['OTR','MO/OTR · Mano de obra subcontratada'],
];
function insumoKey(i){
  const tp=(i.tipo||'').toUpperCase(), sub=(i.subtipo||'').toUpperCase();
  if(tp==='MAT') return 'MAT';
  if(tp==='MO') return sub==='ALB'?'ALB':'OTR';
  return 'OTR';
}
/* Orden numérico por código de tarea (3.1, 3.2, …, 3.14, 3.15; no alfabético). Sin código → al final. */
function _itemParts(s){ return s ? String(s).split('.').map(n=>parseInt(n,10)||0) : null; }
function cmpTareaCodigo(a,b){
  const pa=_itemParts(a.item), pb=_itemParts(b.item);
  if(!pa&&!pb) return (b.monto||0)-(a.monto||0);  // ambas sin código → por monto
  if(!pa) return 1; if(!pb) return -1;
  const n=Math.max(pa.length,pb.length);
  for(let i=0;i<n;i++){ const x=pa[i]??-1, y=pb[i]??-1; if(x!==y) return x-y; }
  return 0;
}
function groupInsumos(insumos){
  const out=[]; const usados=new Set();
  for(const [key,label] of _INSUMO_GRUPOS){
    const grp=insumos.filter(i=>insumoKey(i)===key).sort((a,b)=>b.monto-a.monto);
    if(grp.length){ out.push({_grp:label}); grp.forEach(i=>{usados.add(i); out.push(i);}); }
  }
  const resto=insumos.filter(i=>!usados.has(i)).sort((a,b)=>b.monto-a.monto);
  if(resto.length){ out.push({_grp:'Otros'}); out.push(...resto); }
  return out;
}
function fig3(k,v,neg){ return el('div',{class:'f'}, el('div',{class:'k'},k), el('div',{class:'v'+(neg?' crit':'')},v)); }
function metric(k,v,sub){ return el('div',{class:'m'}, el('span',{class:'k'},k),
  el('span',{class:'v'}, v, sub?el('small',{},' · '+sub):null)); }
function fmtCant(c){ return (c==null||isNaN(c))?'':(+c).toLocaleString('es-AR',{maximumFractionDigits:2}); }
function renderRubroDrawer(dw, d){
  const s=d.subtotales, rc=d.reconciliacion, cc=consumoLvl(s.consumido_pct||0);
  const body=el('div',{class:'ds-dbody'});
  if(s.sobregiro>0) body.append(el('div',{class:'ds-banner'},'⚠ SOBREGIRO · '+money(s.sobregiro)+' por encima del presupuesto'));
  body.append(el('div',{class:'ds-consumo'},
    el('div',{class:'top'},
      el('span',{class:'lab'},'Consumo del presupuesto ', dsItip(dInsightText(d),'left')),
      el('span',{class:'big '+cc}, s.consumido_pct==null?'—':pct(s.consumido_pct,0))),
    dsBar(s.consumido_pct||0, 1, cc),
    el('div',{class:'ds-figs3'},
      fig3('Presupuesto', pesos(s.presupuestado)),
      fig3('Gastado (defl.)', pesos(s.descontado)),
      fig3('Saldo', pesos(s.saldo), s.saldo<0))));
  body.append(el('div',{class:'ds-metrics'},
    metric('Gasto nominal (caja)', pesos(s.real)),
    metric('Efecto inflación (CAC)', pesos(s.inflacion_monto), s.inflacion_pct!=null?pct(s.inflacion_pct,0):null)));
  const chips=el('div',{class:'ds-recon'});
  [['Presupuesto',rc.presupuesto],['Gasto real',rc.real],['Deflactado',rc.descontado]]
    .forEach(([l,r])=>{const c=reconChip(l,r); if(c) chips.append(c);});
  if((rc.real&&!rc.real.ok)||(rc.descontado&&!rc.descontado.ok))
    chips.append(dsItip('El detalle se calcula desde los ledgers (2_Gastos + 2_Quincenas). Si no coincide con Control_Ppto, la hoja de control de esta obra está pendiente de actualización.','left'));
  body.append(chips);
  // tareas + composición
  body.append(el('div',{class:'ds-sectitle'}, `Presupuesto · ${d.presupuesto.length} tarea(s)`));
  const tChild=[
    {cell:i=>el('span',{class:'insumo-desc'}, i.desc||'(insumo)',
       i.unidad?el('span',{class:'meta-id', style:'margin-left:6px'}, i.unidad):null)},
    {num:true, cell:i=>fmtCant(i.cant)}, {num:true, cell:i=>pesos(i.monto)}, {cell:i=>''}, {cell:i=>''}];
  const tTot=el('tr',{class:'total'}, el('td',{},'Subtotal'), el('td',{},''), el('td',{class:'num'},pesos(s.presupuestado)), el('td',{class:'num'},'100%'), el('td',{}, _margenRef?margenCell(_margenRef):''));
  body.append(dsTable([
    {label:'Tarea', cell:t=>tareaCell(t)},
    {label:'Cant', num:true, cell:t=>fmtCant(t.cant)},
    {label:'Monto', num:true, cell:t=>pesos(t.monto)},
    {label:'%', num:true, cell:t=>pct(t.pct,0)},
    {label:'Margen', cell:t=>margenCell(t.margen)},
  ], (d.presupuesto||[]).slice().sort(cmpTareaCodigo), {total:tTot, children:t=>groupInsumos(t.insumos||[]), childCols:tChild}));
  // gastos agrupados
  body.append(el('div',{class:'ds-sectitle'}, `Gastos incurridos · ${d.gastos.length} mov.`));
  const grupos=agrupar(d.gastos, g=>g.proveedor||g.concepto, g=>[g.descontado,g.real]).sort((a,b)=>b.s1-a.s1);
  const gChild=[
    {cell:k=>fecha(k.fecha)+(k.concepto?(' · '+k.concepto):'')+(k.fuente==='Quincena'?' (quincena)':'')},
    {num:true, cell:k=>pesos(k.descontado)}, {num:true, cell:k=>pesos(k.real)}];
  const gTot=el('tr',{class:'total'}, el('td',{},'Subtotal'), el('td',{class:'num'},pesos(s.descontado)), el('td',{class:'num'},pesos(s.real)));
  body.append(dsTable([
    {label:'Proveedor / concepto', cell:g=>g.key},
    {label:'Deflactado', num:true, cell:g=>pesos(g.s1)},
    {label:'Nominal', num:true, cell:g=>pesos(g.s2)},
  ], grupos, {total:gTot, children:g=>g.items.slice().sort((a,b)=>b.descontado-a.descontado), childCols:gChild}));
  dw.querySelector('.ds-dbody').replaceWith(body);
}

/* ================= MÓDULO FLUJO DE CAJA ================= */
async function renderCash(code){
  const app=document.getElementById('app');
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const m=d.meta, r=d.resumen, cf=d.cash_flow||{}, S=cf.series||{}, meses=cf.meses||[];
  const egresosAcum=(S.total_egresos||[]).reduce((a,v)=>a+(v||0),0);

  const kpis=el('div',{class:'kpi-row'},
    dsKpi('Resultado acumulado', money(r.resultado_acumulado),
      {accent:r.resultado_acumulado<0?'crit':'ok', vcls:r.resultado_acumulado<0?'crit':'ok', sub:'posición de caja actual',
       tip:'Resultado acumulado = ingresos − egresos, mes a mes corrido. Es la posición de caja de la obra a hoy.'}),
    dsKpi('Cobrado', money(r.cobrado),
      {sub: r.cobrado_conciliado>0 ? ('conciliado a cert '+money(r.cobrado_conciliado)) : 'sin conciliar a cert aún',
       tip:'Cobrado = ingresos reales acreditados en Tezamat (la plata que entró). El subtítulo muestra la parte ya conciliada a una certificación del circuito Cert_*. Si dice "sin conciliar", hay cobros en Tezamat que todavía no se ligaron a un certificado (aparece en Gaps de datos).'}),
    dsKpi('Egresos', money(egresosAcum),
      {sub:'nominal · plata que salió',
       tip:'Egresos acumulados a valor nominal (la plata que efectivamente salió de caja). Para el control presupuestario se usa el gasto DEFLACTADO por CAC (moneda constante); acá es nominal porque es flujo de caja real.'}),
    dsKpi('Valle de caja', money(r.caja_valle),
      {accent:r.caja_valle<0?'crit':'ok', vcls:r.caja_valle<0?'crit':'',
       sub:r.caja_valle_mes?('mín. '+mesLabel(r.caja_valle_mes)):'',
       tip:'Mínimo del resultado acumulado = pico de financiamiento necesario.'}));

  const chartCard=dsCard('Flujo de Caja mensual', {sub:'ingresos / egresos (nominal) · resultado acumulado',
    tip:'Barras: ingresos (verde) y egresos del mes a valor nominal — egresos de Tezamat (rojo) + gastos directos/indirectos por fuera de Tezamat (rojo claro). Línea: resultado acumulado (rojo donde la caja queda negativa). Clic en un mes para ver el detalle.'},
    el('div',{class:'ds-chart'}, el('canvas',{id:'dscf'})));
  setTimeout(()=>renderCashChart(code, cf), 0);

  const valleCard=dsCard('Liquidez', {},
    el('div',{class:'bignum '+(r.caja_valle<0?'crit':'ok')}, money(r.caja_valle)),
    el('div',{class:'muted-note', style:'margin:2px 0 9px'}, 'valle de caja'+(r.caja_valle_mes?(' · '+mesLabel(r.caja_valle_mes)):'')),
    sumRow('Meses con caja < 0', String(r.meses_negativos||0), {dot:r.meses_negativos?'amarillo':'verde'}),
    sumRow('Negativos próximos', String(r.meses_neg_futuros||0), {dot:r.meses_neg_futuros?'rojo':'verde'}));
  const wip=dsWip('Curva planificada vs real',
    'Línea benchmark "vs Planned" — necesita la curva de desembolso/avance planificado. El slot está listo en el chart, se conecta cuando llegue el dato.');

  const ingMes=(S.ingresos||[]).map((v,i)=>({mes:meses[i], v:(v||0)+((S.ingresos_cac||[])[i]||0)})).filter(x=>x.v);
  const egrMes=(S.total_egresos||[]).map((v,i)=>({mes:meses[i], v:v||0})).filter(x=>x.v);
  const inflow=dsCard('Ingresos por mes', {sub:'cobros del fideicomiso (nominal)'},
    dsTable([{label:'Mes', cell:x=>mesAnio(x.mes)},{label:'Ingreso', num:true, cell:x=>pesos(x.v)}], ingMes));
  const outflow=dsCard('Egresos por mes', {sub:'nominal · clic → detalle del mes'},
    dsTable([{label:'Mes', cell:x=>mesAnio(x.mes)},{label:'Egreso', num:true, cell:x=>pesos(x.v)}],
      egrMes, {rowAttrs:x=>({class:'rowlink', title:'Ver egresos del mes', onclick:()=>openMesDrawer(code, x.mes)})}));

  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{},'Flujo de Caja'),
        el('div',{class:'subtitle'}, (m.nombre||m.code)+' · ',
          el('span',{class:'meta-id'},'ingresos vs egresos · resultado acumulado'))),
      el('div',{}, el('button',{class:'btn btn-secondary'},'Filtros'))),
    gapsBanner(d.data_gaps),
    kpis,
    el('div',{class:'grid-8-4'}, chartCard, el('div',{class:'stack-md'}, valleCard, wip)),
    el('div',{class:'ds-cols2', style:'margin-top:16px'}, inflow, outflow));
  app.innerHTML='';
  app.append(sidebar('cash', code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code,'Flujo de Caja'), content));
  const h=location.hash.match(/^#mes=(.+)$/); if(h) openMesDrawer(code, decodeURIComponent(h[1]));
}
function cssVar(name, fallback){
  try{ const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v||fallback; }
  catch(e){ return fallback; }
}
function renderCashChart(code, cf){
  const ctx=document.getElementById('dscf'); if(!ctx||!window.Chart) return;
  const S=cf.series||{}, meses=cf.meses||[];
  const ing=(S.ingresos||[]).map((v,i)=>(v||0)+((S.ingresos_cac||[])[i]||0));
  const egr=(S.egresos||[]).map(v=>-(v||0));                                   // egresos Tezamat
  const dirind=(S.gastos_directos||[]).map((v,i)=>-((v||0)+((S.gastos_indirectos||[])[i]||0)));  // por fuera de Tezamat
  const acum=S.resultado_acumulado||[];
  const C={ok:cssVar('--ok','#00a472'), crit:cssVar('--crit','#ba1a1a'),
           navy:cssVar('--primary','#091426'), grid:cssVar('--surface-low','#eef1f7')};
  new Chart(ctx,{ data:{labels:meses.map(mesLabel), datasets:[
    {type:'bar', label:'Ingresos', data:ing, backgroundColor:C.ok, stack:'f', order:3},
    {type:'bar', label:'Egresos (Tezamat)', data:egr, backgroundColor:C.crit, stack:'f', order:3},
    {type:'bar', label:'Gastos Dir/Ind', data:dirind, backgroundColor:'rgba(186,26,26,.42)', stack:'f', order:3},
    {type:'line', label:'Resultado acum.', data:acum, borderColor:C.navy, backgroundColor:C.navy,
      borderWidth:2, tension:.25, order:1, pointRadius:acum.map(v=>v<0?3:2),
      pointBackgroundColor:acum.map(v=>v<0?C.crit:C.navy),
      segment:{borderColor:c=>(c.p0.parsed.y<0||c.p1.parsed.y<0)?C.crit:C.navy}}]},
    options:{responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      onHover:(e,els)=>{e.native.target.style.cursor=els.length?'pointer':'default';},
      onClick:(e,els,chart)=>{const p=chart.getElementsAtEventForMode(e,'index',{intersect:false},true); if(p.length) openMesDrawer(code, meses[p[0].index]);},
      scales:{y:{stacked:true, ticks:{callback:v=>'$'+(v/1e6).toLocaleString('es-AR',{maximumFractionDigits:0})+'M', font:{family:'JetBrains Mono'}}, grid:{color:C.grid}},
        x:{stacked:true, grid:{display:false}, ticks:{font:{family:'JetBrains Mono'}}}},
      plugins:{legend:{position:'bottom', labels:{font:{family:'Inter'}, boxWidth:12}},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+pesos(Math.abs(c.parsed.y))}}}}});
}
async function openMesDrawer(code, mes){
  const dw=openDrawerShell(); dw.innerHTML='';
  dw.append(el('div',{class:'ds-dhead'},
    el('div',{}, el('div',{class:'rt'}, mesAnio(mes)), el('div',{class:'st'},'Egresos del mes')),
    el('button',{class:'dx', onclick:closeDrawer},'✕')));
  dw.append(el('div',{class:'ds-dbody'}, el('div',{class:'muted-note'},'cargando…')));
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)+'/mes?mes='+encodeURIComponent(mes)); }
  catch(e){ dw.querySelector('.ds-dbody').replaceWith(el('div',{class:'ds-dbody', style:'color:#ba1a1a'},'Error: '+e.message)); return; }
  const body=el('div',{class:'ds-dbody'});
  body.append(el('div',{class:'ds-figs3'},
    fig3('Egreso (defl.)', pesos(d.total_descontado)),
    fig3('Nominal', pesos(d.total_real)),
    fig3('Movimientos', String(d.n_movimientos))));
  body.append(el('div',{class:'ds-sectitle'}, 'Egresos por rubro'));
  const rTot=el('tr',{class:'total'}, el('td',{},'Total'), el('td',{class:'num'},pesos(d.total_descontado)),
    el('td',{class:'num'},pesos(d.total_real)), el('td',{class:'num'},''));
  body.append(dsTable([
    {label:'Rubro', cell:x=>x.rubro},
    {label:'Deflactado', num:true, cell:x=>pesos(x.descontado)},
    {label:'Nominal', num:true, cell:x=>pesos(x.real)},
    {label:'Mov.', num:true, cell:x=>String(x.n)},
  ], d.rubros, {total:rTot}));
  body.append(el('div',{class:'ds-sectitle'}, 'Movimientos · '+d.movimientos.length));
  const grupos=agrupar(d.movimientos, g=>g.proveedor||g.concepto, g=>[g.descontado,g.real]).sort((a,b)=>b.s1-a.s1);
  const gChild=[{cell:k=>(k.rubro||'')+(k.concepto?(' · '+k.concepto):'')},{num:true,cell:k=>pesos(k.descontado)},{num:true,cell:k=>pesos(k.real)}];
  body.append(dsTable([
    {label:'Proveedor / concepto', cell:g=>g.key},
    {label:'Deflactado', num:true, cell:g=>pesos(g.s1)},
    {label:'Nominal', num:true, cell:g=>pesos(g.s2)},
  ], grupos, {children:g=>g.items.slice().sort((a,b)=>b.descontado-a.descontado), childCols:gChild}));
  dw.querySelector('.ds-dbody').replaceWith(body);
}

/* ================= MÓDULO AVANCE Y CERTIFICACIONES ================= */
function estadoBadge(e){
  const n=(e||'').toLowerCase();
  return spill(n==='cobrado'?'ok':(n==='facturado'?'warn':'info'), e||'—');
}
function pstep(label, monto, level){
  return el('div',{class:'pstep '+level}, el('div',{class:'pk'}, label), el('div',{class:'pv'}, money(monto)));
}
async function renderAvance(code){
  const app=document.getElementById('app');
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const m=d.meta, r=d.resumen, ce=d.certificaciones||{}, ae=d.avance_etapa||{};
  const certs=(ce.items||[]).slice().sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));

  const tareasSub = r.tareas_total
    ? `${r.tareas_completas} de ${r.tareas_total} tareas al 100%`
    : 'sin tareas cargadas';
  const fb=ce.facturado_bn||{blanco:0,negro:0}, cb=ce.cobrado_bn||{blanco:0,negro:0};
  const pendBN = bnPct({blanco:(fb.blanco||0)-(cb.blanco||0), negro:(fb.negro||0)-(cb.negro||0)});

  // fila 1: avance físico · certificado de avance · total facturado
  const kpis1=el('div',{class:'kpi-row'},
    dsKpi('Avance físico', pct(r.avance_fisico_pct,0),
      {accent:'ok', sub:'financiero (cert÷venta) '+pct(r.avance_financiero_pct,0)+' · '+tareasSub,
       tip:'Hay DOS medidas y conviene no confundirlas. (1) AVANCE FÍSICO (número grande): % de obra ejecutada medido en obra, de Cert_Control_OC — es el avance "real". (2) AVANCE FINANCIERO (subtítulo): certificado de avance ÷ presupuesto de venta — la plata certificada sobre la venta. Difieren cuando hay adicionales certificados sin tarea de presupuesto (sube el financiero) o avance medido que todavía no se certificó (sube el físico). El subtítulo también cuenta las tareas al 100% sobre el total.'}),
    dsKpi('Certificado de avance', money(ce.certificado_avance),
      {sub:'más '+money(ce.anticipo)+' de anticipo · Total = '+money(ce.total_certificado),
       tip:'Certificación de obra ejecutada (sin el anticipo). El anticipo se factura/cobra aparte y se recupera vía desacopio en cada certificación; el Total es la suma de ambos.'}),
    dsKpi('Total facturado', money(ce.facturado),
      {accent:'info', sub: bnPct(fb) || 'sin facturación cargada',
       tip:'Total facturado al cliente — incluye con factura (Blanco) y sin factura (Negro). La proporción B/N sale de Cert_Facturacion.'}));

  // fila 2: avance s/certificar (Gap A) · cert s/facturar (Gap B) · facturado s/cobrar · cobrado
  const kpis2=el('div',{class:'kpi-row'},
    dsKpi('Avance pendiente de certificar', money(ce.avance_sin_certificar),
      {accent:(ce.avance_sin_certificar||0)>0?'warn':'ok', sub:'avance del JO sin certificar',
       tip:'Avance físico ya reportado por el Jefe de Obra (Cert_App_Output) que Admin todavía NO convirtió en certificación (falta completar % B/N, desacopio, IVA, TC). Es el eslabón previo a "Certificado de avance".'}),
    dsKpi('Cert. pendiente de facturar', money(ce.certificado_pendiente),
      {accent:(ce.certificado_pendiente||0)>0?'info':'ok', sub:'certificado sin factura',
       tip:'Certificaciones ya armadas por Admin (con B/N, desacopio, IVA, TC) que todavía no tienen comprobante emitido. = Certificado − Facturado.'}),
    dsKpi('Facturado pendiente de cobro', money(ce.facturado_pendiente),
      {accent:(ce.facturado_pendiente||0)>0?'warn':'ok', sub: pendBN || 'facturado sin cobrar',
       tip:'Comprobantes emitidos que todavía no se cobraron. = Facturado − Cobrado.'}),
    dsKpi('Cobrado (conciliado)', money(ce.cobrado),
      {accent:'ok', sub: bnPct(cb) || 'sin cobros conciliados aún',
       tip:'Cobros del circuito Cert_* CONCILIADOS a una certificación (con su B/N). Es la vista de certificación; puede ser menor que el "Cobrado" del Flujo de Caja, que muestra TODA la plata acreditada en Tezamat (conciliada o no). La diferencia se reporta en Gaps de datos.'}));

  const et=ae.items||[], etT=ae.total||{};
  const ftot=(e,k)=>{const o=(e.fiscal||{})[k]||{}; return (o.blanco||0)+(o.negro||0);};
  const baseT=e=>ftot(e,'anticipo')+ftot(e,'avance');   // base neta (anticipo + avance), neto de desacopio
  const sumc=fn=>et.reduce((a,e)=>a+fn(e),0);
  const etTable=dsTable([
    {label:'OC', cell:e=>e.etapa},
    {label:'Descripción', cell:e=>e.descripcion||'—'},
    {label:'Ppto Venta', num:true, cell:e=>pesos(e.ppto_venta)},
    {label:'Avance', cell:e=>barCell(e.avance_pct, null, 'nav')},
    {label:'Monto Base Cert.', num:true, cell:e=>pesos(baseT(e))},
    {label:'CAC', num:true, cell:e=>pesos(ftot(e,'cac'))},
    {label:'IVA', num:true, cell:e=>pesos(ftot(e,'iva'))},
    {label:'Cert. Total', num:true, cell:e=>pesos(e.certificado)},
  ], et, {total:el('tr',{class:'total'},
      el('td',{},'TOTAL'), el('td',{},''),
      el('td',{class:'num'},pesos(etT.ppto_venta)), el('td',{}, pct(etT.avance_pct,0)),
      el('td',{class:'num'},pesos(sumc(baseT))), el('td',{class:'num'},pesos(sumc(e=>ftot(e,'cac')))),
      el('td',{class:'num'},pesos(sumc(e=>ftot(e,'iva')))), el('td',{class:'num'},pesos(etT.certificado))),
    rowAttrs:e=>({class:'rowlink', title:'Ver detalle de la OC', onclick:()=>openEtapaDrawer(code, e)})});

  // última certificación de cada OC (excluye anticipos), para "recientes"
  const ultPorOC={};
  for(const c of (ce.items||[])){
    if(/-ANT$/i.test(c.id)) continue;
    const k=c.concepto||c.id, cur=ultPorOC[k];
    if(!cur || String(c.fecha||'')>String(cur.fecha||'') || (String(c.fecha||'')===String(cur.fecha||'') && c.id>cur.id)) ultPorOC[k]=c;
  }
  const ultimas=Object.values(ultPorOC).sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));
  const recent=dsCard('Última certificación por OC', {sub:ultimas.length+' OC con certificación',
      tip:'Se muestra sólo la certificación más reciente de cada Orden de Compra (OC) — no todas. Para el detalle completo, ver "Detalle de certificados" abajo.'},
    ultimas.length? el('div',{}, ...ultimas.map(c=>el('div',{class:'certrow', onclick:()=>openCertDrawer(code,c)},
      el('div',{}, el('div',{class:'cid'}, c.id), el('div',{class:'cdate'}, fecha(c.fecha))),
      el('div',{class:'cright'}, el('div',{class:'camt'}, money(c.total)), estadoBadge(c.estado)))))
    : el('div',{class:'muted-note'},'Sin certificados emitidos.'));

  const ledger=dsCard('Detalle de certificados', {sub:'agrupado por OC · clic → trazabilidad cert → factura → cobro'},
    dsTable([
      {label:'ID', cell:c=>c.id},
      {label:'Fecha', cell:c=>fecha(c.fecha)},
      {label:'Tipo', cell:c=>el('span',{class:'meta-id'}, c.tipo_fiscal)},
      {label:'Concepto', cell:c=>c.concepto},
      {label:'Base', num:true, cell:c=>pesos(c.base)},
      {label:'Total', num:true, cell:c=>pesos(c.total)},
      {label:'Estado', cell:c=>estadoBadge(c.estado)},
      {label:'Cobrado', num:true, cell:c=>pesos(c.monto_cobrado)},
      {label:'Saldo', num:true, cell:c=>el('span',{class:c.saldo<0?'neg':''}, pesos(c.saldo))},
    ], ce.items||[], {rowAttrs:c=>({class:'rowlink', title:'Ver trazabilidad', onclick:()=>openCertDrawer(code,c)})}));

  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{},'Avance y Certificaciones'),
        el('div',{class:'subtitle'}, (m.nombre||m.code)+' · ',
          el('span',{class:'meta-id'},'etapas · flujo cert → factura → cobro'))),
      el('div',{}, el('button',{class:'btn btn-warning'}, icon('export'),'Nueva certificación'))),
    gapsBanner(d.data_gaps),
    kpis1, el('div',{style:'height:12px'}), kpis2,
    el('div',{style:'margin-top:16px'},
      dsCard('Avance por etapa', {sub:'por OC · base + CAC + IVA = Cert. Avance · clic → detalle',
        tip:'Avance = % físico ejecutado (ponderado por precio de venta). Monto Base Cert. = trabajo certificado a precio de presupuesto (neto de desacopio); sumándole CAC e IVA da la Cert. Avance (total certificado, incluye anticipo). La base es comparable al Ppto Venta. El desglose B/N y el avance por tarea están en el detalle (clic en la fila).'}, etTable)),
    el('div',{class:'grid-8-4', style:'margin-top:16px'},
      el('div',{}, ledger),
      el('div',{class:'stack-md'}, recent)));
  app.innerHTML='';
  app.append(sidebar('avance', code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code,'Avance y Cert.'), content));
  const h=location.hash.match(/^#(etapa|cert)=(.+)$/);
  if(h){ if(h[1]==='etapa'){ const e=(ae.items||[]).find(x=>x.etapa===decodeURIComponent(h[2])); if(e) openEtapaDrawer(code, e); }
    else { const c=(ce.items||[]).find(x=>x.id===decodeURIComponent(h[2])); if(c) openCertDrawer(code,c); } }
}
async function openEtapaDrawer(code, e){
  e = e || {};
  const etapa = e.etapa || e;   // tolera string (compat) u objeto
  const dw=openDrawerShell(); dw.innerHTML='';
  dw.append(el('div',{class:'ds-dhead'},
    el('div',{}, el('div',{class:'rt'}, (e.id_oc||etapa)),
      el('div',{class:'st'}, (e.descripcion||'Detalle de la OC'))),
    el('button',{class:'dx', onclick:closeDrawer},'✕')));
  const body=el('div',{class:'ds-dbody'});

  // recap de la OC: figs + matriz aditiva del total certificado por tipo fiscal
  if(e.ppto_venta!=null){
    body.append(el('div',{class:'ds-figs4'},
      fig3('PPTO Venta', pesos(e.ppto_venta)),
      fig3('Total certificado', pesos(e.certificado)),
      fig3('% avance', pct(e.avance_pct,0)),
      fig3('Certificaciones', String(e.n_certs||0))));
    const F=e.fiscal||{};
    // rows base (a precio ppto) + ajustes (CAC/IVA) → suman al total certificado
    const baseRow=(label,o)=>({label, b:(o&&o.blanco)||0, n:(o&&o.negro)||0, adj:false});
    const adjRow=(label,o)=>({label, b:(o&&o.blanco)||0, n:(o&&o.negro)||0, adj:true});
    const rows=[
      baseRow('Anticipo', F.anticipo),
      baseRow('Certif. de avance', F.avance),
      adjRow('+ Ajuste CAC', F.cac),
      adjRow('+ IVA', F.iva),
    ];
    const tB=rows.reduce((a,r)=>a+r.b,0), tN=rows.reduce((a,r)=>a+r.n,0);
    const mc=(v,adj)=> adj? el('span',{class:'fiadj'}, pesos(v)) : pesos(v);
    const lc=(r)=> r.adj? el('span',{class:'fiadj'}, r.label) : r.label;
    body.append(el('div',{class:'ds-sectitle'}, 'Certificación financiera al cliente ',
      dsItip('Lo que se certifica/factura al fideicomiso: base (a precio de ppto) + anticipo + CAC + IVA, abierto en Blanco/Negro. Es distinto del avance físico por tarea de más abajo.')));
    body.append(dsTable([
      {label:'Componente', cell:r=>lc(r)},
      {label:'Blanco', num:true, cell:r=>mc(r.b, r.adj)},
      {label:'Negro', num:true, cell:r=>mc(r.n, r.adj)},
      {label:'Total', num:true, cell:r=>mc(r.b+r.n, r.adj)},
    ], rows, {total:el('tr',{class:'total'},
        el('td',{},'TOTAL certificado'), el('td',{class:'num'},pesos(tB)),
        el('td',{class:'num'},pesos(tN)), el('td',{class:'num'},pesos(tB+tN)))}));
  }

  body.append(el('div',{class:'ds-sectitle'}, 'cargando partidas…'));
  dw.querySelector('.ds-dbody')?.replaceWith(body) || dw.append(body);
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)+'/etapa?etapa='+encodeURIComponent(etapa)); }
  catch(err){ body.lastChild.textContent='Error: '+err.message; return; }
  const s=d.subtotales||{};
  if(!d.partidas.length){
    // OC sin desglose en 1_Presupuesto (p.ej. adicionales) — T3-2
    body.lastChild.replaceWith(el('div',{class:'muted-note', style:'padding:10px 0'},
      'Esta OC no está desglosada en 1_Presupuesto (p. ej. adicionales): el certificado se trackea a nivel OC, sin avance por tarea.'));
    return;
  }
  body.lastChild.replaceWith(el('div',{class:'ds-sectitle'},
    'Avance físico por tarea · valorizado a precio de venta ',
    dsItip('Avance físico de cada tarea × su precio de venta (1_Presupuesto). NO coincide con la "Certificación financiera" de arriba: esa incluye anticipo, CAC e IVA y adelanta el anticipo vía desacopio. Por eso los totales difieren mientras la OC no esté al 100% — convergen al cerrar.')));
  body.append(dsTable([
    {label:'Cód', cell:p=>el('span',{class:'meta-id'}, p.cod||'—')},
    {label:'Partida', cell:p=>p.descripcion},
    {label:'Ppto venta', num:true, cell:p=>pesos(p.ppto_venta)},
    {label:'Avance físico $', num:true, cell:p=>pesos(p.certificado)},
    {label:'Avance', cell:p=>barCell(p.avance_pct, null, 'nav')},
  ], d.partidas, {total:el('tr',{class:'total'}, el('td',{},'Total'), el('td',{},''), el('td',{class:'num'},pesos(s.ppto_venta)),
      el('td',{class:'num'},pesos(s.certificado)), el('td',{}, pct(s.avance_pct,0)))}));
}
function flowStep(label, val, sub, done){
  return el('div',{class:'fstep'+(done?' done':'')}, el('div',{class:'fk'}, label),
    el('div',{class:'fv'}, val), el('div',{class:'fsub'}, sub));
}
function brkTable(rows){
  return el('table',{class:'ds-table brk'}, el('tbody',{}, ...rows.map(([k,v,bold])=>
    el('tr',{class:bold?'total':''}, el('td',{}, k), el('td',{class:'num'+(v<0?' neg':'')}, pesos(v))))));
}
async function openCertDrawer(code, it){
  const dw=openDrawerShell(); dw.innerHTML='';
  const cobrado=(it.monto_cobrado||0)>=((it.total||0)-1);
  dw.append(el('div',{class:'ds-dhead'},
    el('div',{}, el('div',{class:'rt'}, it.id), el('div',{class:'st'}, fecha(it.fecha)+' · '+(it.tipo_fiscal||''))),
    el('button',{class:'dx', onclick:closeDrawer},'✕')));
  const body=el('div',{class:'ds-dbody'});
  body.append(el('div',{style:'margin-bottom:15px;display:flex;align-items:center;gap:9px'},
    estadoBadge(it.estado), it.concepto?el('span',{class:'muted-note'}, it.concepto):null));
  body.append(el('div',{class:'ds-flow'},
    flowStep('Certificado', money(it.total), fecha(it.fecha), true),
    flowStep('Facturado', money(it.facturado), (it.facturado>1?'':'pendiente'), it.facturado>1),
    flowStep('Cobrado', money(it.monto_cobrado), it.fecha_cobro?fecha(it.fecha_cobro):(cobrado?'ok':'pendiente'), cobrado)));

  // desglose por tipo fiscal (Blanco / Negro / Total): % fact, base, CAC, %IVA, IVA, USD, facturado, cobrado
  const pB=(it.partes||[]).find(p=>/^b/i.test(p.tipo))||{}, pN=(it.partes||[]).find(p=>/^n/i.test(p.tipo))||{};
  const arr=x=>x?pesos(x):'—', usd=x=>x?('US$ '+Math.round(x).toLocaleString('es-AR')):'—', pc=x=>x?pct(x,0):'—';
  const compRows=[
    {c:'% facturación', b:pc(pB.pct_fact), n:pc(pN.pct_fact), t:'100%', pct:true},
    {c:'Importe base (a precio ppto)', b:arr(pB.base), n:arr(pN.base), t:arr(it.base)},
    {c:'+ Ajuste CAC', b:arr(pB.cac), n:arr(pN.cac), t:arr(it.cac)},
    {c:'% IVA', b:pc(pB.pct_iva), n:pc(pN.pct_iva), t:'', pct:true},
    {c:'+ IVA', b:arr(pB.iva), n:arr(pN.iva), t:arr(it.iva)},
    {c:'= Total certificado', b:arr(pB.total), n:arr(pN.total), t:arr(it.total), tot:true},
    {c:'Monto en USD (U$)', b:usd(pB.usd), n:usd(pN.usd), t:usd(it.usd)},
    {c:'Facturado', b:arr(pB.facturado), n:arr(pN.facturado), t:arr(it.facturado)},
    {c:'Sin facturar', b:arr((pB.total||0)-(pB.facturado||0)), n:arr((pN.total||0)-(pN.facturado||0)), t:arr(it.sin_facturar)},
    {c:'Cobrado', b:arr(pB.cobrado), n:arr(pN.cobrado), t:arr(it.monto_cobrado)},
  ];
  body.append(el('div',{class:'ds-sectitle'},'Desglose por tipo fiscal'));
  body.append(dsTable([
    {label:'Concepto', cell:x=>x.tot?el('b',{},x.c):(x.pct?el('span',{class:'muted-note'},x.c):x.c)},
    {label:'Blanco', num:true, cell:x=>x.tot?el('b',{},x.b):x.b},
    {label:'Negro', num:true, cell:x=>x.tot?el('b',{},x.n):x.n},
    {label:'Total', num:true, cell:x=>x.tot?el('b',{},x.t):x.t},
  ], compRows));
  // parámetros de cálculo
  const params=[];
  if(it.cac_ratio) params.push('Índice actualización CAC: '+(+it.cac_ratio).toLocaleString('es-AR',{minimumFractionDigits:4,maximumFractionDigits:4}));
  if(it.tc_usd) params.push('TC USD (MEP): $'+Math.round(it.tc_usd).toLocaleString('es-AR'));
  if(it.retenciones) params.push('Retenciones: '+money(it.retenciones));
  if(params.length) body.append(el('div',{class:'muted-note', style:'margin:8px 0 4px'}, params.join('  ·  ')));

  // tareas que compusieron este certificado (Cert_App_Output)
  const tsec=el('div',{class:'ds-sectitle'},'cargando tareas de la certificación…');
  body.append(tsec);
  dw.append(body);
  try{
    const cd=await getJSON('/api/obras/'+encodeURIComponent(code)+'/cert?id='+encodeURIComponent(it.id));
    const ts=cd.tareas||[];
    tsec.textContent='Tareas de esta certificación · '+ts.length;
    if(ts.length) body.append(dsTable([
      {label:'Cód', cell:t=>el('span',{class:'meta-id'}, t.cod)},
      {label:'Tarea', cell:t=>t.descripcion||'—'},
      {label:'% actual', num:true, cell:t=>pct(t.pct_actual,0)},
      {label:'% acum', num:true, cell:t=>pct(t.pct_total,0)},
      {label:'$ base', num:true, cell:t=>pesos(t.base)},
    ], ts, {total:el('tr',{class:'total'}, el('td',{},'Total'), el('td',{},''), el('td',{},''), el('td',{},''),
        el('td',{class:'num'},pesos((cd.subtotales||{}).base||0)))}));
    else body.append(el('div',{class:'muted-note'},'Sin tareas registradas para esta certificación (ej. anticipo).'));
  }catch(err){ tsec.textContent='No se pudieron cargar las tareas: '+err.message; }
}

/* ================= MÓDULO COMPROMISOS Y RECURSOS ================= */
function dsStat(k,v,cls=''){ return el('div',{class:'pf-stat'}, el('div',{class:'k'},k), el('div',{class:'v '+cls}, v)); }
function secHeader(title, sub){ return el('div',{class:'ds-sech'}, el('span',{}, title), sub?el('span',{class:'cnt'}, sub):null); }
function hs(x){ return (x==null||isNaN(x))?'—':(+x).toLocaleString('es-AR',{maximumFractionDigits:0})+' h'; }
const RIESGO2LVL={rojo:'crit',amarillo:'warn',verde:'ok',sin_datos:'neutro'};
async function renderRecursos(code){
  const app=document.getElementById('app');
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const m=d.meta, sc=d.subcontratos||{}, j=d.jornales||{};

  // --- Subcontratos ---
  const scStats=el('div',{class:'pf-agg'},
    dsStat('Comprometido', money(sc.comprometido)),
    dsStat('Pagado', money(sc.pagado)),
    dsStat('Saldo', money(sc.saldo), sc.saldo<0?'crit':''),
    dsStat('En riesgo', String(sc.en_riesgo||0), sc.en_riesgo?'crit':'ok'));
  const scTable=dsTable([
    {label:'Contrato', cell:s=>el('span',{class:'meta-id'}, s.contrato)},
    {label:'Proveedor', cell:s=>s.proveedor},
    {label:'Rubro', cell:s=>s.rubro},
    {label:'Presupuesto', num:true, cell:s=>pesos(s.presupuesto)},
    {label:'Pagado', num:true, cell:s=>pesos(s.pagado)},
    {label:'Saldo', num:true, cell:s=>el('span',{class:s.saldo<0?'neg':''}, pesos(s.saldo))},
    {label:'Consumo', cell:s=> s.riesgo==='sin_datos'
        ? el('span',{class:'muted-note'},'sin datos')
        : barCell(s.consumo_pct, 1, RIESGO2LVL[s.riesgo]||'ok')},
    {label:'', cell:s=>el('span',{}, dsDot(s.riesgo),' ›')},
  ], sc.items||[], {total:el('tr',{class:'total'},
      el('td',{},'TOTAL'), el('td',{},''), el('td',{},''),
      el('td',{class:'num'},pesos(sc.comprometido)), el('td',{class:'num'},pesos(sc.pagado)),
      el('td',{class:'num'},pesos(sc.saldo)), el('td',{},''), el('td',{},'')),
    rowAttrs:s=>({class:'rowlink', title:'Ver pagos del contrato', onclick:()=>openSubcDrawer(code, s.contrato)})});

  // --- Mano de Obra (UOCRA) ---
  const jCons=j.horas_ppto?j.horas_acum/j.horas_ppto:0;
  const jSinPpto=!j.horas_ppto && j.horas_acum>0;
  const jStats=el('div',{class:'pf-agg'},
    dsStat('Horas ppto', hs(j.horas_ppto)),
    dsStat('Horas acum.', hs(j.horas_acum)),
    dsStat('Consumo', jSinPpto?'—':pct(jCons,0), jCons>1.05?'crit':''),
    dsStat('Rubros', String((j.rubros||[]).length)));
  const consCell=(ppto,acum)=> !ppto
    ? el('span',{class:'muted-note'}, acum>0?'sin ppto':'—')
    : (()=>{const f=acum/ppto; return barCell(f, 1, f>1.05?'crit':'nav');})();
  const jTable=dsTable([
    {label:'Rubro', cell:x=>x.rubro},
    {label:'Horas ppto', num:true, cell:x=>hs(x.horas_ppto)},
    {label:'Horas acum.', num:true, cell:x=>hs(x.horas_acum)},
    {label:'Consumo', cell:x=>consCell(x.horas_ppto, x.horas_acum)},
  ], j.rubros||[], {total:el('tr',{class:'total'}, el('td',{},'TOTAL'),
      el('td',{class:'num'},hs(j.horas_ppto)), el('td',{class:'num'},hs(j.horas_acum)), el('td',{},jSinPpto?'—':pct(jCons,0))),
    children:x=>x.categorias||[], childCols:[
      {cell:c=>c.categoria},
      {num:true, cell:c=>hs(c.horas_ppto)},
      {num:true, cell:c=>hs(c.horas_acum)},
      {cell:c=>consCell(c.horas_ppto, c.horas_acum)}]});

  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{},'Compromisos y Recursos'),
        el('div',{class:'subtitle'}, (m.nombre||m.code)+' · ',
          el('span',{class:'meta-id'},'subcontratos · mano de obra UOCRA'))),
      el('div',{}, el('button',{class:'btn btn-secondary'},'Filtros'))),
    gapsBanner(d.data_gaps),
    secHeader('Subcontratos', (sc.items||[]).length+' contratos'),
    scStats,
    dsCard('Contratos', {sub:'consumo y riesgo · clic → pagos',
      tip:'Consumo = pagado ÷ presupuesto. Rojo si saldo negativo, naranja si >80% consumido.'}, scTable),
    secHeader('Mano de Obra · UOCRA', (j.rubros||[]).length+' rubros'),
    jStats,
    dsCard('Horas-hombre por rubro', {sub:'presupuestadas vs acumuladas · desplegar → categorías'}, jTable));
  app.innerHTML='';
  app.append(sidebar('recursos', code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code,'Compromisos y Recursos'), content));
  const h=location.hash.match(/^#subc=(.+)$/); if(h) openSubcDrawer(code, decodeURIComponent(h[1]));
}
async function openSubcDrawer(code, contrato){
  const dw=openDrawerShell(); dw.innerHTML='';
  dw.append(el('div',{class:'ds-dhead'},
    el('div',{}, el('div',{class:'rt'}, contrato), el('div',{class:'st'},'Pagos del contrato')),
    el('button',{class:'dx', onclick:closeDrawer},'✕')));
  dw.append(el('div',{class:'ds-dbody'}, el('div',{class:'muted-note'},'cargando…')));
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)+'/subcontrato?contrato='+encodeURIComponent(contrato)); }
  catch(e){ dw.querySelector('.ds-dbody').replaceWith(el('div',{class:'ds-dbody', style:'color:#ba1a1a'},'Error: '+e.message)); return; }
  const s=d.subtotales||{}, body=el('div',{class:'ds-dbody'});
  if(d.proveedor||d.rubro) body.append(el('div',{class:'muted-note', style:'margin-bottom:12px'},
    [d.proveedor, d.rubro].filter(Boolean).join(' · ')));
  const cc=consumoLvl(s.consumido_pct||0);
  body.append(el('div',{class:'ds-consumo'},
    el('div',{class:'top'}, el('span',{class:'lab'},'Consumo del contrato'),
      el('span',{class:'big '+cc}, s.consumido_pct==null?'—':pct(s.consumido_pct,0))),
    dsBar(s.consumido_pct||0, 1, cc),
    el('div',{class:'ds-figs3'},
      fig3('Presupuesto', pesos(s.presupuesto)),
      fig3('Pagado (base)', pesos(s.base)),
      fig3('Saldo', pesos(s.saldo), (s.saldo||0)<0))));
  body.append(el('div',{class:'ds-sectitle'}, 'Pagos · '+d.pagos.length));
  const hasCS=(d.pagos||[]).some(p=>p.cargas>0);   // CS sólo descuenta gasto, no saldo (SPEC §4)
  const pcols=[
    {label:'Fecha', cell:p=>fecha(p.fecha)},
    {label:'Proveedor / concepto', cell:p=>p.proveedor||p.concepto||'—'},
    {label:'Base', num:true, cell:p=>pesos(p.base)},
    {label:'CAC', num:true, cell:p=>pesos(p.cac)}];
  if(hasCS) pcols.push({label:'CS', num:true, cell:p=>pesos(p.cargas)});
  pcols.push({label:'Nominal', num:true, cell:p=>pesos(p.real)});
  const ptot=[el('td',{},'Total'), el('td',{},''), el('td',{class:'num'},pesos(s.base)), el('td',{class:'num'},pesos(s.cac))];
  if(hasCS) ptot.push(el('td',{class:'num'},pesos(s.cargas||0)));
  ptot.push(el('td',{class:'num'},pesos(s.real)));
  body.append(dsTable(pcols, d.pagos, {total:el('tr',{class:'total'}, ...ptot)}));
  dw.querySelector('.ds-dbody').replaceWith(body);
}

/* ================= MÓDULO REPORTE EJECUTIVO (FIDEICOMISO) ================= */
function mgmtNote(sev, txt){
  const map={critico:{l:'crit',t:'Riesgo'},atencion:{l:'warn',t:'Atención'},info:{l:'info',t:'Info'},hito:{l:'ok',t:'Hito alcanzado'}};
  const x=map[sev]||map.info;
  return el('div',{class:'mnote '+x.l}, el('div',{class:'mhead'}, x.t), el('div',{class:'mtxt'}, txt));
}
async function renderReporte(code){
  const app=document.getElementById('app');
  let d;
  try{ d=await getJSON('/api/obras/'+encodeURIComponent(code)); }
  catch(e){ app.innerHTML=''; app.append(el('div',{style:'padding:40px;color:#ba1a1a'},'Error: '+e.message)); return; }
  const m=d.meta, r=d.resumen, ae=d.avance_etapa||{};

  const kpis=el('div',{class:'kpi-row'},
    dsKpi('Inversión total', money(r.ppto_costo),
      {accent:'', sub:'precio de venta '+money(r.ppto_venta),
       tip:'Costo presupuestado de la obra (lo que financia el fideicomiso). El precio de venta es lo que Arquinering certifica y factura.'}),
    dsKpi('Avance físico', pct(r.avance_fisico_pct,0), {accent:'ok', sub:'certificado ponderado'}),
    dsKpi('Salud financiera', money(r.resultado_acumulado),
      {accent:r.resultado_acumulado<0?'crit':'ok', vcls:r.resultado_acumulado<0?'crit':'ok',
       sub:'margen ppto '+pct(r.margen_pct,0)}));

  // desglose financiero
  const dRows=[
    ['Presupuesto de costo', r.ppto_costo],
    ['Precio de venta (al fideicomiso)', r.ppto_venta],
    ['Gastado (deflactado)', r.gasto_deflactado],
    ['Anticipo (facturado al cliente)', r.anticipo],
    ['Certificado de avance (sin anticipo)', r.certificado_avance],
    ['Cobrado', r.cobrado],
    ['Saldo a cobrar', r.saldo_cobrar],
  ];
  const desglose=dsCard('Desglose financiero al fideicomiso', {sub:'presupuesto vs ejecución'},
    dsTable([{label:'Concepto', cell:x=>x[0]},{label:'Monto', num:true, cell:x=>pesos(x[1])}],
      dRows, {total:el('tr',{class:'total'}, el('td',{},'Resultado acumulado'),
        el('td',{class:'num '+(r.resultado_acumulado<0?'neg':'pos')}, pesos(r.resultado_acumulado)))}));

  // chart: avance por etapa (certificación financiera)
  const chart=dsCard('Avance físico vs certificación financiera', {sub:'% certificado por etapa',
    tip:'Certificación financiera = certificado ÷ ppto venta por etapa. El overlay de avance físico medido (independiente) es un dato recomendado a conseguir — el slot está listo.'},
    el('div',{class:'ds-chart-tall'}, el('canvas',{id:'dsrep'})));
  setTimeout(()=>renderRepChart(ae), 0);

  // management notes (derivadas del semáforo + hitos)
  const notes=[];
  (d.semaforo.razones||[]).forEach(rz=>notes.push([rz.sev, rz.txt]));
  (ae.items||[]).filter(e=>(e.avance_pct||0)>=0.999 && e.ppto_venta>0)
    .forEach(e=>notes.push(['hito', e.etapa+' — certificada al 100%']));
  const notesCard=dsCard('Management Notes', {sub:'derivadas de los datos · '+notes.length},
    notes.length? el('div',{}, ...notes.map(n=>mgmtNote(n[0], n[1]))) : el('div',{class:'muted-note'},'Sin observaciones.'));

  const content=el('div',{class:'ds-content'},
    el('div',{class:'ds-pagehead'},
      el('div',{}, el('h1',{}, m.nombre||m.code),
        el('div',{class:'subtitle'}, 'Reporte ejecutivo para fideicomiso · ',
          el('span',{class:'meta-id'}, (m.estado||'')+' · datos al '+fechaDato(m.mtime)))),
      el('div',{style:'display:flex;gap:9px'},
        el('button',{class:'btn btn-secondary'}, 'Compartir'),
        el('button',{class:'btn btn-primary'}, icon('export'), 'Descargar PDF'))),
    kpis,
    el('div',{class:'grid-8-4'},
      el('div',{class:'stack-md'}, desglose, chart),
      notesCard));
  app.innerHTML='';
  app.append(sidebar('reporte', code), el('div',{class:'ds-main'}, topbar(m.nombre||m.code,'Reporte Ejec.'), content));
}
function renderRepChart(ae){
  const ctx=document.getElementById('dsrep'); if(!ctx||!window.Chart) return;
  const items=(ae.items||[]).filter(e=>e.ppto_venta>0);
  new Chart(ctx,{ type:'bar', data:{labels:items.map(e=>e.etapa), datasets:[
    {label:'Certificación financiera', data:items.map(e=>(e.avance_pct||0)*100), backgroundColor:'#091426', borderRadius:2, barThickness:'flex', maxBarThickness:16}]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false,
      scales:{x:{max:100, ticks:{callback:v=>v+'%', font:{family:'JetBrains Mono'}}, grid:{color:'#eef1f7'}},
        y:{ticks:{font:{family:'Inter', size:11}}, grid:{display:false}}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>'Certificado '+pct(c.parsed.x/100,0)}}}}});
}

/* ================= router ================= */
function route(){
  let m = location.pathname.match(/^\/ds\/obra\/([^\/]+)\/([^\/]+)/);
  if(m){ const code=decodeURIComponent(m[1]);
    if(m[2]==='control') return renderControl(code);
    if(m[2]==='cash') return renderCash(code);
    if(m[2]==='avance') return renderAvance(code);
    if(m[2]==='recursos') return renderRecursos(code);
    if(m[2]==='reporte') return renderReporte(code);
    return renderDashboard(code);
  }
  m = location.pathname.match(/^\/ds\/obra\/([^\/]+)/);
  if(m) return renderDashboard(decodeURIComponent(m[1]));
  renderPortfolio();
}
route();
