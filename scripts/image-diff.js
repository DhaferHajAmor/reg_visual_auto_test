(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const dropzones = $$('.dropzone');
  const canvas = $('#diffCanvas');
  const diffStatus = document.getElementById('diffStatus');
  const maskCanvas = document.getElementById('maskCanvas');
  const ctx = canvas.getContext('2d');
  const mctx = maskCanvas ? maskCanvas.getContext('2d') : null;
  const PREF_KEY = 'VD::diffPrefs';
  const MASK_KEY = 'VD::diffMasks';
  let lastW = 0, lastH = 0;
  const thresholdInput = $('#threshold');
  const thresholdVal = document.getElementById('thresholdVal');
  const thresholdLabelText = document.getElementById('thresholdLabelText');
  const diffModeSel = document.getElementById('diffMode');
  const diffColorInput = $('#diffColor');
  const lumaOnly = document.getElementById('lumaOnly');
  const blur1 = document.getElementById('blur1');
  const edgeTol = document.getElementById('edgeTol');
  const runBtn = $('#runDiff');
  const swapBtn = $('#swapImages');
  const clearBtn = $('#clearImages');

  const state = { A:null, B:null };
  const objectURLs = { A:null, B:null }; // track blob URLs for cleanup
  let hasDiff = false; // diff executed at least once
  let hasDiffPixels = false; // any differing pixels
  function showWarn(msg){
    if(diffStatus){ diffStatus.textContent=msg; diffStatus.style.display='block'; diffStatus.style.color='#b26b00'; }
    else { alert(msg.replace(/^⚠️\s*/,'')); }
  }
  // Buttons references & state helpers
  const downloadBtn = document.getElementById('downloadDiff');
  const maskToggle = document.getElementById('maskToggle');
  const maskClear = document.getElementById('maskClear');
  const resetPrefsBtn = document.getElementById('resetPrefs');
  function setBlocked(el, blocked){ if(!el) return; if(blocked){ el.classList.add('blocked'); el.setAttribute('aria-disabled','true'); } else { el.classList.remove('blocked'); el.removeAttribute('aria-disabled'); } }
  function updateButtons(){
    const bothLoaded = !!(state.A && state.B);
    if(runBtn){
      if(!bothLoaded || running){
        runBtn.classList.add('blocked');
        runBtn.setAttribute('disabled','');
      } else {
        runBtn.classList.remove('blocked');
        runBtn.removeAttribute('disabled');
      }
    }
  // Swap & Clear now enabled as soon as both images are loaded (even before first diff)
  setBlocked(swapBtn, !bothLoaded);
  setBlocked(clearBtn, !bothLoaded);
  // Mask add toggle requires a diff WITH visual differences; clear requires at least one mask
  const diffWithPixels = hasDiff && hasDiffPixels;
  setBlocked(maskToggle, !diffWithPixels);
  setBlocked(maskClear, !(diffWithPixels && masks && masks.length>0));
  // Download also only when there are differing pixels
  setBlocked(downloadBtn, !(hasDiff && hasDiffPixels));
  // Reset preferences must always remain active regardless of state
  setBlocked(resetPrefsBtn, false);
  }
  if(downloadBtn){ downloadBtn.classList.add('blocked'); }
  updateButtons();

  function fileToImage(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
  // Do not revoke the object URL immediately; it is reused for the preview <img> element.
  // We can optionally revoke later when images are cleared.
  img.onload = () => { /* URL.revokeObjectURL(url); */ resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function setCanvasSize(w,h){
    canvas.width = w; canvas.height = h;
    if(maskCanvas){ maskCanvas.width = w; maskCanvas.height = h; }
    if(w!==lastW || h!==lastH){ restoreMasksForSize(w,h); lastW=w; lastH=h; }
  }

  function drawPreview(img, side){
    const dz = dropzones.find(d => d.dataset.side===side);
    const tag = dz.querySelector('img');
    tag.src = img.src;
  }

  async function handleFiles(files, side){
    const file = files && files[0];
    if(!file) return;
    const img = await fileToImage(file);
  // Store URL for cleanup (src currently a blob:... from fileToImage)
  objectURLs[side] = img.src;
  state[side] = img; drawPreview(img, side); hasDiff=false; hasDiffPixels=false; updateButtons();
  }

  dropzones.forEach(dz => {
    const input = dz.querySelector('input[type=file]');
    const fname = dz.querySelector('.fname');
    const pick = dz.querySelector('.pick');
    if(pick){ pick.addEventListener('click', ()=> { if(!input) return; try{ input.value=''; }catch(_){} input.click(); }); }
    input.addEventListener('change', e => handleFiles(e.target.files, dz.dataset.side));
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files, dz.dataset.side); });
    input.addEventListener('change', ()=>{ fname && (fname.textContent = input.files && input.files[0] ? input.files[0].name : ''); });
  });

  // Mask state
  const masks = []; // array of {x,y,w,h}
  let drawing = false; let start = null;
  let selectedIndex = -1; let moving = false; let moveOffset = {x:0,y:0};
  function drawMasks(){ if(!mctx) return; mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); mctx.save(); mctx.fillStyle = 'rgba(255,255,255,0.25)'; mctx.strokeStyle = 'rgba(255,255,255,0.6)'; mctx.lineWidth = 1.5; masks.forEach((r,idx)=>{ mctx.fillRect(r.x,r.y,r.w,r.h); mctx.strokeRect(r.x,r.y,r.w,r.h); if(idx===selectedIndex){ mctx.strokeStyle='rgba(122,162,255,0.9)'; mctx.setLineDash([6,4]); mctx.strokeRect(r.x-2,r.y-2,r.w+4,r.h+4); mctx.setLineDash([]); mctx.strokeStyle='rgba(255,255,255,0.6)'; } }); mctx.restore(); }
  function pointInRect(x,y,r){ return x>=r.x && y>=r.y && x<r.x+r.w && y<r.y+r.h; }
  function saveMasks(){ try{ localStorage.setItem(MASK_KEY, JSON.stringify({ w: canvas.width, h: canvas.height, rects: masks })); }catch(_){} }
  function restoreMasksForSize(w,h){ try{ const saved = JSON.parse(localStorage.getItem(MASK_KEY)||'null'); if(!saved||!saved.rects){ drawMasks(); updateButtons(); return; } const sx = saved.w? (w/saved.w):1; const sy = saved.h? (h/saved.h):1; masks.length=0; saved.rects.forEach(r=>masks.push({ x: Math.round(r.x*sx), y: Math.round(r.y*sy), w: Math.round(r.w*sx), h: Math.round(r.h*sy) })); drawMasks(); updateButtons(); }catch(_){ drawMasks(); updateButtons(); } }

  let running = false;
  function runDiff(){
  if(running) return; running = true; runBtn.setAttribute('disabled','');
  if(!state.A || !state.B){ alert('Veuillez charger les deux images (A et B).'); running=false; runBtn.removeAttribute('disabled'); return; }
    const w = Math.max(state.A.naturalWidth, state.B.naturalWidth);
    const h = Math.max(state.A.naturalHeight, state.B.naturalHeight);
    setCanvasSize(w,h);

    // Draw both on hidden buffers for pixel access
    const bufA = document.createElement('canvas'); bufA.width=w; bufA.height=h;
    const bufB = document.createElement('canvas'); bufB.width=w; bufB.height=h;
    const cA = bufA.getContext('2d'); const cB = bufB.getContext('2d');
    cA.clearRect(0,0,w,h); cB.clearRect(0,0,w,h);
    cA.drawImage(state.A, 0, 0);
    cB.drawImage(state.B, 0, 0);

  let dA = cA.getImageData(0,0,w,h); let dB = cB.getImageData(0,0,w,h);
  // Optional 1px box blur to reduce AA noise
  if(blur1 && blur1.checked){ dA = boxBlur1(dA,w,h); dB = boxBlur1(dB,w,h); }
    const out = ctx.createImageData(w,h);
  const tPct = Math.max(0, Math.min(100, parseInt(thresholdInput.value, 10) || 0));
  const mode = (diffModeSel && diffModeSel.value) || 'pixel';
  const t = mode==='pixel' ? Math.round((tPct/100) * 255) : 1 - (tPct/100); // SSIM threshold: 1.0 identical -> flag if ssim < t
    const color = hexToRgb(diffColorInput.value || '#ff0055');

  let diffCount = 0;
  if(mode==='pixel'){
    for(let i=0; i<dA.data.length; i+=4){
      const px = (i/4) % w; const py = Math.floor((i/4)/w);
      // skip masked pixels
      if(masks.length && masks.some(r=>pointInRect(px,py,r))){
        // show faint background from B unchanged to indicate ignored
        out.data[i] = dB.data[i] * 0.6;
        out.data[i+1] = dB.data[i+1] * 0.6;
        out.data[i+2] = dB.data[i+2] * 0.6;
        out.data[i+3] = 255;
        continue;
      }
      // luminance vs RGB diff
      let maxDiff;
      if(lumaOnly && lumaOnly.checked){
        const lA = 0.2126*dA.data[i] + 0.7152*dA.data[i+1] + 0.0722*dA.data[i+2];
        const lB = 0.2126*dB.data[i] + 0.7152*dB.data[i+1] + 0.0722*dB.data[i+2];
        maxDiff = Math.abs(lA - lB);
      } else {
        const r = Math.abs(dA.data[i] - dB.data[i]);
        const g = Math.abs(dA.data[i+1] - dB.data[i+1]);
        const b = Math.abs(dA.data[i+2] - dB.data[i+2]);
        const a = Math.abs(dA.data[i+3] - dB.data[i+3]);
        maxDiff = Math.max(r,g,b,a);
      }
      // Edge-aware tolerance: reduce sensitivity near strong edges
      if(edgeTol && edgeTol.checked){
        const gx = grad(dA, i, 1) + grad(dB, i, 1);
        const gy = grad(dA, i, w) + grad(dB, i, w);
        const mag = Math.min(255, Math.hypot(gx, gy));
        // Raise the threshold locally up to +30% on strong edges
        const tLocal = t * (1 + 0.3*(mag/255));
        if(maxDiff <= tLocal){
          out.data[i] = dB.data[i] * 0.6; out.data[i+1] = dB.data[i+1] * 0.6; out.data[i+2] = dB.data[i+2] * 0.6; out.data[i+3] = 255; continue;
        }
      }
      if(maxDiff > t){
        diffCount++;
        out.data[i] = color.r;
        out.data[i+1] = color.g;
        out.data[i+2] = color.b;
        out.data[i+3] = 255;
      } else {
        // faint background from B
        out.data[i] = dB.data[i] * 0.6;
        out.data[i+1] = dB.data[i+1] * 0.6;
        out.data[i+2] = dB.data[i+2] * 0.6;
        out.data[i+3] = 255;
      }
    }
  } else {
    // SSIM mode: compute per-pixel SSIM using a small window (e.g., 5x5)
    const win = 5; const half = Math.floor(win/2);
    // Precompute luminance arrays for speed
    const YA = new Float32Array(w*h), YB = new Float32Array(w*h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4; YA[y*w+x]=0.2126*dA.data[i]+0.7152*dA.data[i+1]+0.0722*dA.data[i+2];
        YB[y*w+x]=0.2126*dB.data[i]+0.7152*dB.data[i+1]+0.0722*dB.data[i+2];
      }
    }
    const C1 = 6.5025, C2 = 58.5225; // standard SSIM constants (scaled)
    function ssimAt(x,y){
      let muA=0, muB=0, n=0;
      for(let dy=-half; dy<=half; dy++) for(let dx=-half; dx<=half; dx++){
        const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; muA+=YA[ny*w+nx]; muB+=YB[ny*w+nx]; n++; }
      muA/=n; muB/=n; let varA=0,varB=0,cov=0;
      for(let dy=-half; dy<=half; dy++) for(let dx=-half; dx<=half; dx++){
        const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const a=YA[ny*w+nx]-muA; const b=YB[ny*w+nx]-muB; varA+=a*a; varB+=b*b; cov+=a*b; }
      varA/=(n-1); varB/=(n-1); cov/=(n-1);
      const num = (2*muA*muB + C1) * (2*cov + C2);
      const den = (muA*muA + muB*muB + C1) * (varA + varB + C2);
      return den!==0 ? (num/den) : 1;
    }
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=(y*w+x)*4;
        if(masks.length && masks.some(r=>pointInRect(x,y,r))){
          out.data[idx]=dB.data[idx]*0.6; out.data[idx+1]=dB.data[idx+1]*0.6; out.data[idx+2]=dB.data[idx+2]*0.6; out.data[idx+3]=255; continue;
        }
        const s = ssimAt(x,y);
        if(s < t){ diffCount++; out.data[idx]=color.r; out.data[idx+1]=color.g; out.data[idx+2]=color.b; out.data[idx+3]=255; }
        else { out.data[idx]=dB.data[idx]*0.6; out.data[idx+1]=dB.data[idx+1]*0.6; out.data[idx+2]=dB.data[idx+2]*0.6; out.data[idx+3]=255; }
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  // Update status UI
  if(diffStatus){
    diffStatus.style.display='block';
    diffStatus.style.textAlign='center';
    diffStatus.style.fontWeight='600';
    if(diffCount===0){
      diffStatus.textContent = 'Aucune différence détectée avec le seuil choisi.';
      diffStatus.style.color = '#0b6e32'; // vert foncé
      diffStatus.style.background='';
    } else {
      const total = (out.width||w) * (out.height||h);
      const pct = Math.min(100, ((diffCount/total)*100).toFixed(3));
      diffStatus.textContent = `${diffCount.toLocaleString()} pixels différents (~${pct}%)`;
      diffStatus.style.color = '#b00020'; // rouge
    }
  }
  hasDiff = true; hasDiffPixels = diffCount>0; updateButtons();
  running = false; runBtn.removeAttribute('disabled');
  }

  // Simple 1px box blur
  function boxBlur1(imgData,w,h){
    const src = imgData.data; const out = new ImageData(w,h); const dst = out.data;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        let r=0,g=0,b=0,a=0,cnt=0; for(let dy=-1;dy<=1;dy++){ for(let dx=-1;dx<=1;dx++){
          const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const j=(ny*w+nx)*4;
          r+=src[j]; g+=src[j+1]; b+=src[j+2]; a+=src[j+3]; cnt++;
        }}
        const i=(y*w+x)*4; dst[i]=r/cnt; dst[i+1]=g/cnt; dst[i+2]=b/cnt; dst[i+3]=a/cnt;
      }
    }
    return out;
  }

  // Gradient magnitude helpers (Sobel-lite along x/y using neighbors)
  function grad(data,i,step){
    const d=data.data; const i1=i-4*step, i2=i+4*step;
    const c1 = i1>=0 ? (d[i1]+d[i1+1]+d[i1+2])/3 : d[i];
    const c2 = i2<d.length ? (d[i2]+d[i2+1]+d[i2+2])/3 : d[i];
    return c2 - c1;
  }

  function hexToRgb(hex){
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if(!m) return {r:255,g:0,b:85};
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }

  // Preferences persistence and threshold label + mode label
  function savePrefs(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify({ threshold: Math.max(0, Math.min(100, parseInt(thresholdInput.value,10)||0)), color: diffColorInput.value||'#ff0055', luma: !!(lumaOnly&&lumaOnly.checked), blur: !!(blur1&&blur1.checked), edge: !!(edgeTol&&edgeTol.checked) })); }catch(_){} }
  function loadPrefs(){ try{ const v = JSON.parse(localStorage.getItem(PREF_KEY)||'null'); if(!v) return; if(typeof v.threshold==='number'){ thresholdInput.value=String(v.threshold); if(thresholdVal) thresholdVal.textContent=v.threshold+'%'; } if(typeof v.color==='string'){ diffColorInput.value=v.color; } if(lumaOnly) lumaOnly.checked=!!v.luma; if(blur1) blur1.checked=!!v.blur; if(edgeTol) edgeTol.checked=!!v.edge; }catch(_){} }
  loadPrefs();
  if(thresholdVal){ const sync = ()=> { const t = Math.max(0, Math.min(100, parseInt(thresholdInput.value,10)||0)); thresholdVal.textContent = t + '%'; savePrefs(); }; thresholdInput.addEventListener('input', sync); sync(); }
  diffColorInput.addEventListener('change', savePrefs);
  lumaOnly && lumaOnly.addEventListener('change', savePrefs);
  blur1 && blur1.addEventListener('change', savePrefs);
  edgeTol && edgeTol.addEventListener('change', savePrefs);
  if(diffModeSel){ const updateLabel=()=>{ thresholdLabelText && (thresholdLabelText.textContent = diffModeSel.value==='pixel' ? 'Seuil' : 'Seuil SSIM'); }; diffModeSel.addEventListener('change', updateLabel); updateLabel(); }

  // Reset preferences button
  (function(){
    const btn = document.getElementById('resetPrefs');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      try{ localStorage.removeItem(PREF_KEY); }catch(_){}
      thresholdInput.value = '8'; if(thresholdVal) thresholdVal.textContent='8%';
      diffColorInput.value = '#ff0055';
      if(lumaOnly) lumaOnly.checked = false;
      if(blur1) blur1.checked = false;
      if(edgeTol) edgeTol.checked = false;
    });
  })();

  runBtn.addEventListener('click', runDiff);
  swapBtn.addEventListener('click', () => {
    if(!(state.A && state.B)){ showWarn('⚠️ Chargez deux images avant d\'inverser.'); return; }
    const t = state.A; state.A = state.B; state.B = t;
    drawPreview(state.A,'A'); drawPreview(state.B,'B');
    // also swap filenames in UI if present
    const zones = dropzones.reduce((acc,dz)=>{ acc[dz.dataset.side]=dz; return acc; },{});
    const nameA = zones['A'].querySelector('.fname'); const nameB = zones['B'].querySelector('.fname');
    if(nameA && nameB){ const tn = nameA.textContent; nameA.textContent = nameB.textContent; nameB.textContent = tn; }
    // Invalidate previous diff (must be rerun after inversion)
    hasDiff=false; hasDiffPixels=false;
    if(diffStatus){ diffStatus.textContent='Images inversées : relancez le diff.'; diffStatus.style.display='block'; diffStatus.style.color='#b26b00'; }
    updateButtons();
  });
  clearBtn.addEventListener('click', () => {
    if(!(state.A || state.B)){ showWarn('⚠️ Aucune image à effacer.'); return; }
  // Revoke existing object URLs
  ['A','B'].forEach(k=>{ if(objectURLs[k]){ try{ URL.revokeObjectURL(objectURLs[k]); }catch(_){ } objectURLs[k]=null; } });
    state.A=null; state.B=null; hasDiff=false; hasDiffPixels=false; updateButtons();
    // Clear previews and filenames
    $$('.dropzone img').forEach(i=>i.removeAttribute('src'));
    $$('.dropzone .fname').forEach(n=>n.textContent='');
    // Reset file inputs so selecting same file again will fire change
    $$('.dropzone input[type=file]').forEach(inp=>{ try{ inp.value=''; }catch(_){} });
    // Reset canvases
    setCanvasSize(800,400);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); }
    // Reset masks/tool state
    if(typeof masks!=='undefined'){ masks.length=0; }
    if(typeof drawing!=='undefined'){ drawing=false; }
    if(typeof moving!=='undefined'){ moving=false; }
    if(typeof selectedIndex!=='undefined'){ selectedIndex=-1; }
    if(maskCanvas){ maskCanvas.classList.remove('drawing','moving'); }
  if(typeof maskToggle!=='undefined' && maskToggle){ maskToggle.textContent='Ignorer une zone'; }
  try{ localStorage.removeItem('VD::diffMasks'); }catch(_){}
    if(diffStatus){ diffStatus.textContent=''; diffStatus.style.display='none'; }
  });

  // Download diff result (only active when hasDiff && hasDiffPixels via gating)
  if(downloadBtn){
    downloadBtn.addEventListener('click', () => {
      if(!(hasDiff && hasDiffPixels)){
        showWarn('⚠️ Générez un diff avec des différences avant de télécharger.');
        return;
      }
      try {
        // Export only the diff canvas (masked zones already visually dimmed there)
        const outName = `diff-${new Date().toISOString().replace(/[:T]/g,'-').replace(/\..+/, '')}.png`;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = outName;
        a.click();
      } catch(e){
        showWarn('⚠️ Échec export: '+ e);
      }
    });
  }

  // Mask UI wiring
  // (maskToggle, maskClear already defined above)
  if(maskCanvas && maskToggle){
    maskToggle.addEventListener('click', ()=>{
      if(!(hasDiff && hasDiffPixels)){
        if(diffStatus){
          diffStatus.textContent='⚠️ Les zones ignorées ne sont disponibles que si un diff avec des différences est affiché.';
          diffStatus.style.display='block'; diffStatus.style.color='#b26b00';
        } else { alert('Aucune différence visuelle : les zones ignorées sont inactives.'); }
        return;
      }
      drawing = !drawing; selectedIndex = -1; moving = false;
      maskCanvas.classList.toggle('drawing', drawing);
      maskCanvas.classList.remove('moving');
      maskToggle.textContent = drawing ? 'Terminer zones ignorées' : 'Ignorer une zone';
      drawMasks();
  updateButtons();
    });
  maskClear && maskClear.addEventListener('click', ()=>{ 
      if(!(hasDiff && hasDiffPixels)){
        if(diffStatus){
          diffStatus.textContent='⚠️ Rien à effacer : soit aucun diff, soit aucune différence.';
          diffStatus.style.display='block'; diffStatus.style.color='#b26b00';
        } else { alert('Aucun diff avec différences à effacer.'); }
        return;
      }
      masks.length = 0; drawMasks(); saveMasks(); 
  updateButtons();
    });
    maskCanvas.addEventListener('mousedown', (e)=>{
      const rect = maskCanvas.getBoundingClientRect();
      const px = Math.round((e.clientX-rect.left) * (canvas.width/rect.width));
      const py = Math.round((e.clientY-rect.top) * (canvas.height/rect.height));
      // Cmd/Ctrl+click on a rect to delete it
      const hitIndex = masks.findIndex(r=>pointInRect(px,py,r));
  if((e.metaKey||e.ctrlKey) && hitIndex!==-1){ masks.splice(hitIndex,1); selectedIndex=-1; drawMasks(); saveMasks(); return; }
      if(drawing){
        start = { x: px, y: py };
      } else {
        // selection/move mode
        selectedIndex = hitIndex;
        if(selectedIndex!==-1){ moving = true; moveOffset = { x: px - masks[selectedIndex].x, y: py - masks[selectedIndex].y }; maskCanvas.classList.add('moving'); }
        else { moving=false; maskCanvas.classList.remove('moving'); }
        drawMasks();
      }
    });
    maskCanvas.addEventListener('mousemove', (e)=>{
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left) * (canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top) * (canvas.height/rect.height));
      if(drawing){
        if(!start) return; const r = { x: Math.min(start.x,x), y: Math.min(start.y,y), w: Math.abs(x-start.x), h: Math.abs(y-start.y) };
        drawMasks();
        mctx.save(); mctx.fillStyle='rgba(255,255,255,0.25)'; mctx.strokeStyle='rgba(255,255,255,0.9)'; mctx.lineWidth=1.5; mctx.fillRect(r.x,r.y,r.w,r.h); mctx.strokeRect(r.x,r.y,r.w,r.h); mctx.restore();
      } else if(moving && selectedIndex!==-1){
  const r = masks[selectedIndex]; r.x = x - moveOffset.x; r.y = y - moveOffset.y; drawMasks();
      }
    });
    const finish = (e)=>{
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left) * (canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top) * (canvas.height/rect.height));
  if(drawing && start){ const r = { x: Math.min(start.x,x), y: Math.min(start.y,y), w: Math.abs(x-start.x), h: Math.abs(y-start.y) }; if(r.w>2 && r.h>2){ masks.push(r); saveMasks(); } start=null; drawMasks(); updateButtons(); }
  if(moving){ moving=false; maskCanvas.classList.remove('moving'); saveMasks(); }
    };
    maskCanvas.addEventListener('mouseup', finish);
    maskCanvas.addEventListener('mouseleave', finish);
  }

  // init canvas
  setCanvasSize(800, 400);
})();
