let allNews=[];
let sound=localStorage.getItem('soundEnabled')==='1';
let lastBreakingKey=localStorage.getItem('lastBreakingKey')||'';
let map, zoneLayer;
let normalPollBusy=false, breakingPollBusy=false;

const zones=[
 {name:'إسرائيل / تل أبيب',pos:[32.0853,34.7818],base:78,kind:'تصعيد ومتابعة صواريخ',color:'#ff244d'},
 {name:'شمال إسرائيل / حيفا',pos:[32.794,34.9896],base:62,kind:'تحذير شمالي',color:'#ff8f2f'},
 {name:'إيران / طهران',pos:[35.6892,51.389],base:74,kind:'مركز سياسي/عسكري',color:'#ff244d'},
 {name:'مضيق هرمز',pos:[26.566,56.25],base:70,kind:'نفط وملاحة',color:'#ff244d'},
 {name:'لبنان / بيروت',pos:[33.8938,35.5018],base:55,kind:'جبهة شمالية',color:'#ff8f2f'},
 {name:'سوريا / دمشق',pos:[33.5138,36.2765],base:48,kind:'مراقبة إقليمية',color:'#ffd166'},
 {name:'واشنطن',pos:[38.9072,-77.0369],base:42,kind:'قرار سياسي',color:'#00e5ff'},
 {name:'الخليج',pos:[25.2854,51.531],base:50,kind:'أسواق وقواعد',color:'#ffd166'}
];

function $(id){return document.getElementById(id)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtDate(d){try{return new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}).format(new Date(d))}catch{return '--'}}
function updateClock(){ $('clock').textContent=new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()) }
setInterval(updateClock,1000); updateClock();

function initMap(){
 map=L.map('map',{zoomControl:false,attributionControl:false}).setView([31.7,43.5],4);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
 zoneLayer=L.layerGroup().addTo(map);
 drawZones();
}
function drawZones(){
 if(!zoneLayer) return; zoneLayer.clearLayers();
 zones.forEach(z=>{
   const pulse=L.circle(z.pos,{radius:85000+z.base*1500,color:z.color,fillColor:z.color,fillOpacity:.20,weight:2}).addTo(zoneLayer);
   pulse.bindPopup(`<b>${z.name}</b><br>${z.kind}<br>مؤشر توتر تقديري: ${z.base}%`);
   L.marker(z.pos,{icon:L.divIcon({className:'zoneLabel',html:escapeHtml(z.name.split('/')[0].trim()),iconSize:[90,30]})}).addTo(zoneLayer);
 });
}

function severityClass(n){return n.severity>=70?'sevHigh':n.severity>=50?'sevMed':'sevLow'}
function isMissileLaunch(n){
 const text=`${n.title||''} ${n.summary||''}`.toLowerCase();
 const missile=/(صاروخ|صواريخ|صاروخي|إطلاق صاروخ|اطلاق صاروخ|أطلقت|اطلقت|missile|missiles|rocket|rockets|launch|launched|barrage|salvo)/i;
 const event=/(عاجل|breaking|أطلقت|اطلقت|إطلاق|اطلاق|launch|launched|fired|incoming|صفارات|sirens|اعتراض|intercept|استهداف|targeted|toward|نحو|باتجاه)/i;
 return missile.test(text)&&event.test(text);
}
function isBreaking(n){
 const text=`${n.title||''} ${n.summary||''}`.toLowerCase();
 return isMissileLaunch(n)||n.severity>=72||/(عاجل|breaking|missile|missiles|rocket|attack|strike|airstrike|قصف|هجوم|صاروخ|صواريخ|انفجار|ضربة|اعتراض|صفارات|إطلاق)/i.test(text);
}

function renderNews(){
 let q=$('search').value.trim().toLowerCase();
 let cat=$('category').value;
 let min=$('severityFilter').value;
 let list=allNews.filter(n=>(!q||(`${n.title} ${n.summary} ${n.source}`.toLowerCase().includes(q)))&&(cat==='all'||n.category===cat||n.country===cat)&&(min==='all'||n.severity>=Number(min)));
 if($('last5').classList.contains('active')){const now=Date.now();list=list.filter(n=>now-new Date(n.published).getTime()<5*60*1000)}
 $('newsList').innerHTML=list.length?list.map(n=>`<article class="news ${n.severity>=70?'hot':''}">
  <div class="newsTop"><span class="badge ${severityClass(n)}">خطورة ${n.severity}%</span><span class="badge">ثقة ${n.credibility}%</span>${isMissileLaunch(n)?'<span class="badge sevHigh">تحذير صواريخ</span>':''}</div>
  <h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary||'لا يوجد ملخص متاح.')}</p>
  <div class="meta"><span>${escapeHtml(n.source||'مصدر')}</span><span>${escapeHtml(n.category||'عام')}</span><span>${fmtDate(n.published)}</span><span>${escapeHtml(n.country||'إقليمي')}</span></div>
  <a target="_blank" href="${escapeHtml(n.url||'#')}">فتح المصدر الأصلي</a>
 </article>`).join(''):'<div class="loader">لا توجد أخبار مطابقة للفلتر الآن.</div>'
}
function renderSide(){
 const hot=allNews.filter(n=>n.severity>=70).length;
 const avg=Math.round(allNews.reduce((a,b)=>a+(b.severity||0),0)/(allNews.length||1));
 $('tensionScore').textContent=avg; $('tensionLabel').textContent=avg>=70?'خطر مرتفع':avg>=50?'توتر متوسط':'مراقبة';
 const dash=553-(553*avg/100); $('dialProgress').style.strokeDashoffset=dash;
 $('dialProgress').style.stroke=avg>=70?'#ff244d':avg>=50?'#ffd166':'#40f19b';
 $('newsCount').textContent=allNews.length; $('hotCount').textContent=hot; $('lastUpdate').textContent=new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit'}).format(new Date());
 const counts={}; allNews.forEach(n=>counts[n.source]=(counts[n.source]||0)+1); const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]; $('topSource').textContent=top?top[0]:'--';
 $('ticker').textContent=allNews.slice(0,10).map(n=>'⚡ '+n.title).join('     •     ')||'لا توجد أخبار الآن';
 $('timeline').innerHTML=allNews.slice(0,8).map(n=>`<div class="timeItem"><b>${escapeHtml(n.title.slice(0,72))}${n.title.length>72?'…':''}</b><small>${fmtDate(n.published)} — ${escapeHtml(n.source||'')}</small></div>`).join('')||'<p>لا يوجد Timeline</p>';
 $('compare').innerHTML=Object.entries(counts).slice(0,5).map(([s,c])=>`<div class="compareItem"><b>${escapeHtml(s)}</b><p>${c} خبر. قارن العنوان والتفاصيل قبل تصديق الرواية.</p></div>`).join('')||'<p>لا توجد مصادر.</p>';
 const byDay={}; allNews.forEach(n=>{const k=new Date(n.published).toLocaleDateString('ar'); byDay[k]=(byDay[k]||0)+1}); $('archive').innerHTML=Object.entries(byDay).map(([d,c])=>`<div class="archiveItem"><b>${d}</b><p>${c} خبر محفوظ</p></div>`).join('')||'<p>لا يوجد أرشيف</p>';
 $('pulseList').innerHTML=makePulse(avg,hot);
}
function makePulse(avg,hot){
 const items=[];
 items.push(`<div class="pulse"><b>${avg>=70?'🔥 تصعيد قوي':avg>=50?'⚠️ توتر متوسط':'🟢 مراقبة هادئة'}</b><small>مؤشر التوتر الآن ${avg}% بناءً على الكلمات العاجلة والخطورة.</small></div>`);
 items.push(`<div class="pulse"><b>🚨 ${hot} خبر عالي الخطورة</b><small>الأخبار العالية تظهر بتوهج أحمر.</small></div>`);
 const missile=allNews.filter(isMissileLaunch).length; items.push(`<div class="pulse"><b>🛡️ ${missile} خبر صواريخ/اعتراض</b><small>لا يوجد مسار توقعي. فقط تنبيه وخريطة مناطق.</small></div>`);
 const recent=allNews.slice(0,3).map(n=>`<div class="pulse"><b>${escapeHtml(n.category||'خبر')}</b><small>${escapeHtml(n.title.slice(0,95))}${n.title.length>95?'…':''}</small></div>`).join('');
 return items.join('')+recent;
}

function showBreakingAlert(n,force=false){
 if(!n) return; const key=(n.url||n.title||'').slice(0,180); if(!force&&key&&key===lastBreakingKey)return;
 lastBreakingKey=key; localStorage.setItem('lastBreakingKey',key);
 $('alertTitle').textContent=(isMissileLaunch(n)?'تحذير صواريخ — خبر من مصدر إخباري':'خبر عاجل')+'\n'+(n.title||'عاجل');
 $('alertSummary').textContent=n.summary||'تفاصيل الخبر من المصدر.';
 $('alertMeta').textContent=`${n.source||''} • ${n.category||''} • خطورة ${n.severity||0}% • ${fmtDate(n.published)}`;
 $('alertOpen').href=n.url||'#'; $('breakingOverlay').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'});
 if(sound) emergencySiren(); else beep(); if(sound) readBreaking(); setTimeout(()=>{$('breakingOverlay')?.classList.add('hidden')},12000);
}
function emergencySiren(){try{const a=new AudioContext();let t=a.currentTime;[560,940,560,940,560,940,560,940,560].forEach((f,i)=>{const o=a.createOscillator();const g=a.createGain();o.type='sawtooth';o.connect(g);g.connect(a.destination);o.frequency.value=f;g.gain.setValueAtTime(.0001,t+i*.24);g.gain.exponentialRampToValueAtTime(.14,t+i*.24+.04);g.gain.exponentialRampToValueAtTime(.0001,t+i*.24+.22);o.start(t+i*.24);o.stop(t+i*.24+.24)});setTimeout(()=>a.close(),2600)}catch{}}
function beep(){try{const a=new AudioContext();const o=a.createOscillator();const g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.05;o.start();setTimeout(()=>{o.stop();a.close()},220)}catch{}}

let selectedVoiceName=localStorage.getItem('selectedVoiceName')||'';
function populateVoices(){const select=$('voiceSelect'); if(!select||!('speechSynthesis'in window))return; const voices=speechSynthesis.getVoices(); const preferred=voices.filter(v=>/ar|arabic|he|english|en/i.test(`${v.lang} ${v.name}`)); const list=preferred.length?preferred:voices; select.innerHTML=list.length?list.map(v=>`<option value="${escapeHtml(v.name)}" ${v.name===selectedVoiceName?'selected':''}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join(''):'<option>لا توجد أصوات متاحة</option>'; if(!selectedVoiceName&&list[0]){selectedVoiceName=list[0].name;localStorage.setItem('selectedVoiceName',selectedVoiceName)}}
function voiceParams(){const style=$('voiceStyle')?.value||'news'; if(style==='deep')return{rate:.78,pitch:.72,volume:1}; if(style==='fast')return{rate:1.18,pitch:1.02,volume:1}; if(style==='calm')return{rate:.88,pitch:.92,volume:.95}; return{rate:.98,pitch:.88,volume:1}}
function speakArabic(text){if(!('speechSynthesis'in window))return alert('المتصفح لا يدعم قراءة الصوت'); speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); const voices=speechSynthesis.getVoices(); const chosen=voices.find(v=>v.name===selectedVoiceName)||voices.find(v=>/^ar/i.test(v.lang))||voices.find(v=>/Arabic/i.test(v.name))||voices[0]; if(chosen)u.voice=chosen; u.lang=chosen?.lang||'ar-SA'; const p=voiceParams(); u.rate=p.rate; u.pitch=p.pitch; u.volume=p.volume; speechSynthesis.speak(u)}
function readBreaking(){speakArabic(`${$('alertTitle').textContent}. ${$('alertSummary').textContent}`)}
function readTop(){const n=allNews[0]; if(n)speakArabic(`${n.title}. ${n.summary||''}`)}

async function loadNews(){
 if(normalPollBusy)return; normalPollBusy=true;
 try{
  $('newsList').innerHTML='<div class="loader">يتم جلب الأخبار بسرعة...</div>';
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),6500);
  const r=await fetch('/api/news',{signal:controller.signal,cache:'no-store'}); clearTimeout(timer); const data=await r.json();
  if(!data.ok) throw new Error(data.error||'فشل الجلب');
  allNews=data.news||[]; $('sourceHealth').textContent=data.warnings?.length?`مصادر تعمل مع ${data.warnings.length} تحذير`:'مصادر RSS تعمل';
  renderSide(); renderNews(); const urgent=allNews.find(isBreaking); if(urgent)showBreakingAlert(urgent); else if(sound&&allNews[0])beep();
 }catch(e){$('newsList').innerHTML=`<div class="loader">تعذر جلب الأخبار بسرعة الآن، لكن الموقع لم يعلق.<br><small>${e.name==='AbortError'?'انتهت مهلة الاتصال بالمصادر.':escapeHtml(e.message)}</small><br><button onclick="loadNews()">إعادة المحاولة</button> <button onclick="location.href='/api/debug'">فحص الاتصال</button></div>`}
 finally{normalPollBusy=false}
}
async function checkBreakingNow(){
 if(breakingPollBusy)return; breakingPollBusy=true;
 try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);const r=await fetch('/api/breaking',{signal:controller.signal,cache:'no-store'});clearTimeout(timer);const data=await r.json();$('radarStatus').textContent=data.hasBreaking?'رصد عاجل':'يراقب العاجل';$('radarTime').textContent=new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());if(data.ok&&data.hasBreaking&&data.item)showBreakingAlert(data.item)}catch(e){$('radarStatus').textContent='إعادة محاولة'}finally{breakingPollBusy=false}
}
async function loadMarkets(){try{const r=await fetch('/api/markets');const data=await r.json();$('markets').innerHTML=(data.markets||[]).map(m=>`<div class="market"><b>${escapeHtml(m.name)}</b><p>${escapeHtml(m.value)}</p><small>${escapeHtml(m.impact)}</small></div>`).join('')}catch{$('markets').innerHTML='<p>لوحة الاقتصاد تعمل بدون أسعار مباشرة. جرّب تحديث الصفحة.</p>'}}

populateVoices(); if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=populateVoices}
$('voiceSelect').onchange=()=>{selectedVoiceName=$('voiceSelect').value;localStorage.setItem('selectedVoiceName',selectedVoiceName)};
$('testVoiceBtn').onclick=()=>speakArabic('تجربة صوت وور روم إكس. سيتم قراءة الأخبار العاجلة عند تفعيل الصوت.');
$('stopVoiceBtn').onclick=()=>speechSynthesis.cancel();
$('refreshBtn').onclick=()=>{loadNews();checkBreakingNow()};
$('debugBtn').onclick=()=>location.href='/api/debug';
$('soundBtn').onclick=()=>{sound=!sound;localStorage.setItem('soundEnabled',sound?'1':'0');$('soundBtn').textContent=sound?'🔔 الصوت شغال':'🔕 الصوت'};
$('readBtn').onclick=readTop; $('search').oninput=renderNews; $('category').onchange=renderNews; $('severityFilter').onchange=renderNews;
$('last5').onclick=()=>{$('last5').classList.toggle('active');renderNews()}; $('emergency').onclick=()=>document.body.classList.toggle('emergencyOnly'); $('focusBtn').onclick=()=>document.body.classList.toggle('focusMode');
$('closeAlert').onclick=()=>$('breakingOverlay').classList.add('hidden'); $('alertRead').onclick=readBreaking; $('breakingOverlay').addEventListener('click',e=>{if(e.target.id==='breakingOverlay')$('breakingOverlay').classList.add('hidden')});
$('testAlertBtn').onclick=()=>showBreakingAlert({title:'اختبار واجهة العاجل الجديدة',summary:'هذا اختبار فقط للتصميم والصوت. لا يوجد مسار توقعي في هذه النسخة.',source:'اختبار النظام',category:'عام',severity:96,credibility:100,published:new Date().toISOString(),url:'#'},true);
$('soundBtn').textContent=sound?'🔔 الصوت شغال':'🔕 الصوت';
initMap(); loadNews(); loadMarkets(); checkBreakingNow(); setInterval(checkBreakingNow,7000); setInterval(loadNews,30000);
