(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const dropzones = $$('.dropzone');
  const canvas = $('#diffCanvas');
  const diffStatus = document.getElementById('diffStatus');
  const sizeIgnoredBadge = document.getElementById('sizeIgnoredBadge');
  const diffSpinner = document.getElementById('diffSpinner');
  const maskCanvas = document.getElementById('maskCanvas');
  const ctx = canvas.getContext('2d');
  const mctx = maskCanvas ? maskCanvas.getContext('2d') : null;
   const focusZoneToggle = document.getElementById('focusZoneToggle');
   const focusZoneClear = document.getElementById('focusZoneClear');
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
  const verticalTolInput = document.getElementById('verticalTol');
  const runBtn = $('#runDiff');
  const swapBtn = $('#swapImages');
  const clearBtn = $('#clearImages');
  const detectShiftBtn = document.getElementById('detectShift');
  const resetShiftBtn = document.getElementById('resetShift');
  const shiftInfo = document.getElementById('shiftInfo');

  const state = { A:null, B:null };
  const objectURLs = { A:null, B:null }; // track blob URLs for cleanup
  let hasDiff = false; // diff executed at least once
  let hasDiffPixels = false; // any differing pixels
  let running = false; // diff execution state
  // Global shift (detected horizontal/vertical translation) applied before diff
  let globalShift = {dx:0, dy:0, active:false};
   // Focus zones state (multiple active rectangles limiting comparison / display)
   let focusRects = []; // array of {x,y,w,h}
   let focusDrawing = false; let focusStart = null; // current drawing start
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
  // Le bouton runDiff reste toujours actif désormais (pas de disabled)
  if(runBtn){ runBtn.classList.remove('blocked'); runBtn.removeAttribute('disabled'); }
  // All buttons now active by default, but will show warnings if prerequisites not met
  setBlocked(swapBtn, false);
  setBlocked(clearBtn, false);
  // All buttons are now active by default - warnings are shown in event handlers instead
  setBlocked(maskToggle, false);
  setBlocked(maskClear, false);
  setBlocked(focusZoneToggle, false);
  // Effacer focus reste toujours actif ; message si aucune zone
  setBlocked(focusZoneClear, false);
  setBlocked(downloadBtn, false);
  // Reset preferences must always remain active regardless of state
  setBlocked(resetPrefsBtn, false);
  // Always active: detect / reset shift now rely on informative messages
  setBlocked(detectShiftBtn, false);
  setBlocked(resetShiftBtn, false);
    // Disable vertical tolerance UI when a global shift is active to avoid double compensation
    if(verticalTolInput){
      verticalTolInput.disabled = !!globalShift.active;
      if(globalShift.active){ verticalTolInput.title='Désactivée car un décalage global est appliqué'; }
      else { verticalTolInput.title='Tolère un léger décalage vertical (px)'; }
    }
  }
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
    if(focusRects && focusRects.length){
      const before = focusRects.length;
      // Remove any focus rect falling outside new bounds
      for(let i=focusRects.length-1;i>=0;i--){
        const r = focusRects[i];
        if(r.x>=w || r.y>=h){ focusRects.splice(i,1); continue; }
        if(r.x + r.w > w) r.w = w - r.x;
        if(r.y + r.h > h) r.h = h - r.y;
        if(r.w<=0 || r.h<=0) focusRects.splice(i,1);
      }
      if(before !== focusRects.length) updateButtons();
    }
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

  function runDiff(){
  if(running) return; running = true; // ne plus désactiver le bouton
    if(!state.A || !state.B){ showWarn('⚠️ Veuillez charger les deux images (A et B).'); running=false; runBtn.removeAttribute('disabled'); return; }
  const aW = state.A.naturalWidth, aH = state.A.naturalHeight;
  const bW = state.B.naturalWidth, bH = state.B.naturalHeight;
    // Show spinner + interim status
    if(diffSpinner){ diffSpinner.classList.remove('hidden'); }
    if(diffStatus){ diffStatus.textContent='Calcul en cours…'; diffStatus.style.display='block'; diffStatus.style.color='#a7acc6'; }
    // Defer heavy work so spinner paints
    requestAnimationFrame(()=>{ setTimeout(executeDiff, 0); });
  }

  function executeDiff(){
  // Base dimensions
  const aW = state.A.naturalWidth, aH = state.A.naturalHeight;
  const bW = state.B.naturalWidth, bH = state.B.naturalHeight;
  // Effective overlap after applying global shift (A is reference, B shifted by dx,dy)
  let dx = globalShift.active ? globalShift.dx : 0;
  let dy = globalShift.active ? globalShift.dy : 0;
  // Compute intersection rectangle of A at (0,0) size (aW,aH) and B at (dx,dy) size (bW,bH)
  const interX1 = Math.max(0, dx);
  const interY1 = Math.max(0, dy);
  const interX2 = Math.min(aW, dx + bW);
  const interY2 = Math.min(aH, dy + bH);
  let targetW = interX2 - interX1;
  let targetH = interY2 - interY1;
  if(targetW<=0 || targetH<=0){
    setCanvasSize(10,10); ctx.clearRect(0,0,canvas.width,canvas.height);
    if(diffStatus){ diffStatus.textContent='Décalage détecté sans zone de chevauchement.'; diffStatus.style.display='block'; diffStatus.style.color='#b00020'; }
    running=false; if(diffSpinner){ diffSpinner.classList.add('hidden'); } return;
  }
  // If shift active, we will copy corresponding sub-rects into buffers so algorithm stays simpler
  // Source rect in A: (interX1, interY1)
  // Source rect in B: (interX1 - dx, interY1 - dy)
  const srcAx = interX1, srcAy = interY1;
  const srcBx = interX1 - dx, srcBy = interY1 - dy;
    setCanvasSize(targetW, targetH);

    // Draw both on hidden buffers for pixel access
    const bufA = document.createElement('canvas'); bufA.width=targetW; bufA.height=targetH;
    const bufB = document.createElement('canvas'); bufB.width=targetW; bufB.height=targetH;
    const cA = bufA.getContext('2d'); const cB = bufB.getContext('2d');
    cA.clearRect(0,0,targetW,targetH); cB.clearRect(0,0,targetW,targetH);
  // Copy overlapping window only
  cA.drawImage(state.A, srcAx, srcAy, targetW, targetH, 0, 0, targetW, targetH);
  cB.drawImage(state.B, srcBx, srcBy, targetW, targetH, 0, 0, targetW, targetH);

  let dA = cA.getImageData(0,0,targetW,targetH); let dB = cB.getImageData(0,0,targetW,targetH);
    // Optional 1px box blur to reduce AA noise
  if(blur1 && blur1.checked){ dA = boxBlur1(dA,targetW,targetH); dB = boxBlur1(dB,targetW,targetH); }
  const out = ctx.createImageData(targetW,targetH);
    const tPct = Math.max(0, Math.min(100, parseInt(thresholdInput.value, 10) || 0));
    const mode = (diffModeSel && diffModeSel.value) || 'pixel';
    const t = mode==='pixel' ? Math.round((tPct/100) * 255) : 1 - (tPct/100); // SSIM threshold
    const color = hexToRgb(diffColorInput.value || '#ff0055');

  let diffCount = 0;
  let focusPixelsTotal = 0; // union pixel count of all focus rects (exact, counted during loops)
    if(mode==='pixel'){
      for(let i=0; i<dA.data.length; i+=4){
        const px = (i/4) % targetW; const py = Math.floor((i/4)/targetW);
        const insideFocus = !focusRects.length || focusRects.some(r => px>=r.x && py>=r.y && px<r.x+r.w && py<r.y+r.h);
        if(focusRects.length && !insideFocus){
          out.data[i]=dB.data[i]*0.15; out.data[i+1]=dB.data[i+1]*0.15; out.data[i+2]=dB.data[i+2]*0.15; out.data[i+3]=255; continue;
        }
        if(insideFocus) focusPixelsTotal++;
        if(masks.length && masks.some(r=>pointInRect(px,py,r))){
          out.data[i] = dB.data[i] * 0.6; out.data[i+1] = dB.data[i+1] * 0.6; out.data[i+2] = dB.data[i+2] * 0.6; out.data[i+3] = 255; continue;
        }
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
        if(edgeTol && edgeTol.checked){
          const gx = grad(dA, i, 1) + grad(dB, i, 1);
          const gy = grad(dA, i, targetW) + grad(dB, i, targetW);
          const mag = Math.min(255, Math.hypot(gx, gy));
          const tLocal = t * (1 + 0.3*(mag/255));
          if(maxDiff <= tLocal){
            out.data[i] = dB.data[i] * 0.6; out.data[i+1] = dB.data[i+1] * 0.6; out.data[i+2] = dB.data[i+2] * 0.6; out.data[i+3] = 255; continue;
          }
        }
        if(maxDiff > t){
          // Vertical tolerance search (same column) if enabled
          let vtol = 0;
          if(verticalTolInput){ vtol = Math.max(0, Math.min(10, parseInt(verticalTolInput.value,10)||0)); }
          if(vtol>0){
            let adjusted=false;
            for(let dy=1; dy<=vtol && !adjusted; dy++){
              const aboveY = py - dy;
              if(aboveY>=0){
                const ai = (aboveY*targetW + px)*4;
                let diffA;
                if(lumaOnly && lumaOnly.checked){
                  const lA2 = 0.2126*dA.data[ai] + 0.7152*dA.data[ai+1] + 0.0722*dA.data[ai+2];
                  const lB2 = 0.2126*dB.data[i] + 0.7152*dB.data[i+1] + 0.0722*dB.data[i+2];
                  diffA = Math.abs(lA2 - lB2);
                } else {
                  const rA2 = Math.abs(dA.data[ai] - dB.data[i]);
                  const gA2 = Math.abs(dA.data[ai+1] - dB.data[i+1]);
                  const bA2 = Math.abs(dA.data[ai+2] - dB.data[i+2]);
                  const aA2 = Math.abs(dA.data[ai+3] - dB.data[i+3]);
                  diffA = Math.max(rA2,gA2,bA2,aA2);
                }
                if(diffA <= t){ adjusted=true; }
              }
              const belowY = py + dy;
              if(!adjusted && belowY<targetH){
                const bi = (belowY*targetW + px)*4;
                let diffB;
                if(lumaOnly && lumaOnly.checked){
                  const lA3 = 0.2126*dA.data[bi] + 0.7152*dA.data[bi+1] + 0.0722*dA.data[bi+2];
                  const lB3 = 0.2126*dB.data[i] + 0.7152*dB.data[i+1] + 0.0722*dB.data[i+2];
                  diffB = Math.abs(lA3 - lB3);
                } else {
                  const rB2 = Math.abs(dA.data[bi] - dB.data[i]);
                  const gB2 = Math.abs(dA.data[bi+1] - dB.data[i+1]);
                  const bB2 = Math.abs(dA.data[bi+2] - dB.data[i+2]);
                  const aB2 = Math.abs(dA.data[bi+3] - dB.data[i+3]);
                  diffB = Math.max(rB2,gB2,bB2,aB2);
                }
                if(diffB <= t){ adjusted=true; }
              }
            }
            if(adjusted){
              out.data[i] = dB.data[i] * 0.6; out.data[i+1] = dB.data[i+1] * 0.6; out.data[i+2] = dB.data[i+2] * 0.6; out.data[i+3] = 255; continue;
            }
          }
          diffCount++;
          out.data[i] = color.r; out.data[i+1] = color.g; out.data[i+2] = color.b; out.data[i+3] = 255;
        } else {
          out.data[i] = dB.data[i] * 0.6; out.data[i+1] = dB.data[i+1] * 0.6; out.data[i+2] = dB.data[i+2] * 0.6; out.data[i+3] = 255;
        }
      }
    } else {
  const win = 5; const half = Math.floor(win/2);
  // Allocate luminance buffers for SSIM over overlap region (targetW x targetH)
  const YA = new Float32Array(targetW * targetH), YB = new Float32Array(targetW * targetH);
  for(let y=0;y<targetH;y++) for(let x=0;x<targetW;x++){ const i=(y*targetW+x)*4; YA[y*targetW+x]=0.2126*dA.data[i]+0.7152*dA.data[i+1]+0.0722*dA.data[i+2]; YB[y*targetW+x]=0.2126*dB.data[i]+0.7152*dB.data[i+1]+0.0722*dB.data[i+2]; }
      const C1 = 6.5025, C2 = 58.5225;
      function ssimAt(x,y){ let muA=0, muB=0, n=0; for(let dy=-half; dy<=half; dy++) for(let dx=-half; dx<=half; dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=targetW||ny>=targetH) continue; muA+=YA[ny*targetW+nx]; muB+=YB[ny*targetW+nx]; n++; } muA/=n; muB/=n; let varA=0,varB=0,cov=0; for(let dy=-half; dy<=half; dy++) for(let dx=-half; dx<=half; dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=targetW||ny>=targetH) continue; const a=YA[ny*targetW+nx]-muA; const b=YB[ny*targetW+nx]-muB; varA+=a*a; varB+=b*b; cov+=a*b; } varA/=(n-1); varB/=(n-1); cov/=(n-1); const num=(2*muA*muB + C1) * (2*cov + C2); const den=(muA*muA + muB*muB + C1) * (varA + varB + C2); return den!==0 ? (num/den) : 1; }
      for(let y=0;y<targetH;y++) for(let x=0;x<targetW;x++){ const idx=(y*targetW+x)*4; 
        const insideFocus = !focusRects.length || focusRects.some(r => x>=r.x && y>=r.y && x<r.x+r.w && y<r.y+r.h);
        if(focusRects.length && !insideFocus){
          out.data[idx]=dB.data[idx]*0.15; out.data[idx+1]=dB.data[idx+1]*0.15; out.data[idx+2]=dB.data[idx+2]*0.15; out.data[idx+3]=255; continue; }
        if(insideFocus) focusPixelsTotal++;
        if(masks.length && masks.some(r=>pointInRect(x,y,r))){ out.data[idx]=dB.data[idx]*0.6; out.data[idx+1]=dB.data[idx+1]*0.6; out.data[idx+2]=dB.data[idx+2]*0.6; out.data[idx+3]=255; continue; }
        const s = ssimAt(x,y); if(s < t){ diffCount++; out.data[idx]=color.r; out.data[idx+1]=color.g; out.data[idx+2]=color.b; out.data[idx+3]=255; } else { out.data[idx]=dB.data[idx]*0.6; out.data[idx+1]=dB.data[idx+1]*0.6; out.data[idx+2]=dB.data[idx+2]*0.6; out.data[idx+3]=255; } }
    }
    ctx.putImageData(out, 0, 0);
    if(diffStatus){
      diffStatus.style.display='block'; diffStatus.style.textAlign='center'; diffStatus.style.fontWeight='600';
  let total=(out.width||targetW)*(out.height||targetH);
  if(focusRects.length){ total = focusPixelsTotal || 1; }
      const sizeDiff = (aW!==bW || aH!==bH) || globalShift.active;
      if(sizeIgnoredBadge){
        if(sizeDiff){
          sizeIgnoredBadge.style.display='inline-flex';
          sizeIgnoredBadge.textContent = `Base: A ${aW}×${aH} / B ${bW}×${bH}${globalShift.active?` | Décalage ${dx},${dy}`:''}`;
        } else {
          sizeIgnoredBadge.style.display='none';
        }
      }
      if(diffCount===0){
        const base = sizeDiff ? 'Aucune différence (zone commune). Tailles des images différentes.' : 'Aucune différence.';
        if(focusRects.length===1){ diffStatus.textContent = base + ' | Zone focus active'; }
        else if(focusRects.length>1){ diffStatus.textContent = base + ` | Zones focus actives: ${focusRects.length}`; }
        else { diffStatus.textContent = base; }
        diffStatus.style.color = sizeDiff ? '#b26b00' : '#0b6e32';
      } else {
        const pct=Math.min(100, ((diffCount/total)*100).toFixed(3));
        let focusInfo = '';
        if(focusRects.length===1) focusInfo = ' | Zone focus active';
        else if(focusRects.length>1) focusInfo = ` | Zones focus actives: ${focusRects.length}`;
        diffStatus.textContent = `${diffCount.toLocaleString()} pixels différents (~${pct}%)` + (sizeDiff ? ' | Tailles des images différentes' : '') + focusInfo;
        diffStatus.style.color = '#b00020';
      }
    }
  hasDiff = true; hasDiffPixels = diffCount>0; updateButtons();
  running = false; if(diffSpinner){ diffSpinner.classList.add('hidden'); }
  }

  // Global shift detection (brute-force limited search) over small window
  function detectGlobalShift(){
    if(!(state.A && state.B)){ showWarn('⚠️ Charger deux images pour détecter un décalage.'); return; }
    const aW = state.A.naturalWidth, aH = state.A.naturalHeight;
    const bW = state.B.naturalWidth, bH = state.B.naturalHeight;
    // Limit search range (±20 px) to keep performance reasonable
    const RANGE = 20;
    // We evaluate a simple score: sum absolute luminance differences over sampled grid in overlap
    // For speed, downsample by step (adaptive based on size)
    const step = Math.max(1, Math.floor(Math.max(aW,aH)/400));
    // Pre-draw full images into canvases for fast getImageData
    const ca = document.createElement('canvas'); ca.width=aW; ca.height=aH; const cta=ca.getContext('2d'); cta.drawImage(state.A,0,0);
    const cb = document.createElement('canvas'); cb.width=bW; cb.height=bH; const ctb=cb.getContext('2d'); ctb.drawImage(state.B,0,0);
    const dA = cta.getImageData(0,0,aW,aH).data;
    const dB = ctb.getImageData(0,0,bW,bH).data;
    function lum(d,i){ return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }
    let best = {score: Infinity, dx:0, dy:0};
    for(let dy=-RANGE; dy<=RANGE; dy++){
      for(let dx=-RANGE; dx<=RANGE; dx++){
        const x1 = Math.max(0, dx);
        const y1 = Math.max(0, dy);
        const x2 = Math.min(aW, dx + bW);
        const y2 = Math.min(aH, dy + bH);
        const w = x2 - x1, h = y2 - y1;
        if(w<=0 || h<=0) continue;
        let sum=0, count=0;
        for(let y=y1; y<y2; y+=step){
          for(let x=x1; x<x2; x+=step){
            const ia = (y*aW + x)*4;
            const xb = x - dx, yb = y - dy;
            if(xb<0||yb<0||xb>=bW||yb>=bH) continue;
            const ib = (yb*bW + xb)*4;
            const la = lum(dA, ia); const lb = lum(dB, ib);
            sum += Math.abs(la - lb);
            count++;
          }
        }
        if(count===0) continue;
        const score = sum / count;
        if(score < best.score){ best = {score, dx, dy}; }
      }
    }
    // Only activate if improvement is meaningful (arbitrary threshold vs zero shift)
    if(best.dx===0 && best.dy===0){
      globalShift = {dx:0, dy:0, active:false};
      if(shiftInfo){ shiftInfo.style.display='none'; }
      showWarn('Aucun décalage global significatif détecté.');
    } else {
      globalShift = {dx:best.dx, dy:best.dy, active:true};
      if(shiftInfo){ shiftInfo.textContent = `Décalage appliqué (${best.dx},${best.dy})`; shiftInfo.style.display='inline-flex'; }
      if(diffStatus){ diffStatus.textContent = `Décalage détecté: dx=${best.dx}, dy=${best.dy}. Relancez le diff.`; diffStatus.style.display='block'; diffStatus.style.color='#00873e'; }
    }
    updateButtons();
  }

  detectShiftBtn && detectShiftBtn.addEventListener('click', ()=>{
    if(!(state.A && state.B)){
      showWarn('⚠️ Charger d\'abord deux images pour détecter un décalage.');
      return;
    }
    detectGlobalShift();
  });
  resetShiftBtn && resetShiftBtn.addEventListener('click', ()=>{
    if(!globalShift.active){ showWarn('⚠️ Aucun décalage actif à réinitialiser.'); return; }
    globalShift = {dx:0, dy:0, active:false};
    if(shiftInfo){ shiftInfo.style.display='none'; }
    if(diffStatus){ diffStatus.textContent='Décalage global réinitialisé.'; diffStatus.style.display='block'; diffStatus.style.color='#b26b00'; }
    updateButtons();
  });

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
  function savePrefs(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify({ threshold: Math.max(0, Math.min(100, parseInt(thresholdInput.value,10)||0)), color: diffColorInput.value||'#ff0055', luma: !!(lumaOnly&&lumaOnly.checked), blur: !!(blur1&&blur1.checked), edge: !!(edgeTol&&edgeTol.checked), vtol: Math.max(0, Math.min(10, parseInt(verticalTolInput && verticalTolInput.value,10)||0)) })); }catch(_){} }
  function loadPrefs(){ try{ const v = JSON.parse(localStorage.getItem(PREF_KEY)||'null'); if(!v) return; if(typeof v.threshold==='number'){ thresholdInput.value=String(v.threshold); if(thresholdVal) thresholdVal.textContent=v.threshold+'%'; } if(typeof v.color==='string'){ diffColorInput.value=v.color; } if(lumaOnly) lumaOnly.checked=!!v.luma; if(blur1) blur1.checked=!!v.blur; if(edgeTol) edgeTol.checked=!!v.edge; if(verticalTolInput && typeof v.vtol==='number'){ verticalTolInput.value=String(v.vtol); } }catch(_){} }
  loadPrefs();
  if(thresholdVal){ const sync = ()=> { const t = Math.max(0, Math.min(100, parseInt(thresholdInput.value,10)||0)); thresholdVal.textContent = t + '%'; savePrefs(); }; thresholdInput.addEventListener('input', sync); sync(); }
  diffColorInput.addEventListener('change', savePrefs);
  lumaOnly && lumaOnly.addEventListener('change', savePrefs);
  blur1 && blur1.addEventListener('change', savePrefs);
  edgeTol && edgeTol.addEventListener('change', savePrefs);
  verticalTolInput && verticalTolInput.addEventListener('input', ()=>{ const v = Math.max(0, Math.min(10, parseInt(verticalTolInput.value,10)||0)); verticalTolInput.value=String(v); savePrefs(); });
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
        showWarn('⚠️ Les zones ignorées ne sont disponibles que si un diff avec des différences est affiché.');
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
        showWarn('⚠️ Rien à effacer : soit aucun diff, soit aucune différence.');
        return;
      }
      masks.length = 0; drawMasks(); saveMasks(); 
  updateButtons();
    });
    maskCanvas.addEventListener('mousedown', (e)=>{
      if(focusDrawing) return; // ignore mask interactions while drawing focus zones
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
      if(focusDrawing) return; // do not move masks while drawing focus zones
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
      if(focusDrawing) return; // ignore mask finish while drawing focus zones
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left) * (canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top) * (canvas.height/rect.height));
  if(drawing && start){ const r = { x: Math.min(start.x,x), y: Math.min(start.y,y), w: Math.abs(x-start.x), h: Math.abs(y-start.y) }; if(r.w>2 && r.h>2){ masks.push(r); saveMasks(); } start=null; drawMasks(); updateButtons(); }
  if(moving){ moving=false; maskCanvas.classList.remove('moving'); saveMasks(); }
    };
    maskCanvas.addEventListener('mouseup', finish);
    maskCanvas.addEventListener('mouseleave', finish);
  }

  // Focus zone interactions (reuse maskCanvas events without interfering with masks when focusDrawing)
  if(maskCanvas && focusZoneToggle){
    focusZoneToggle.addEventListener('click', ()=>{
      if(!(hasDiff && hasDiffPixels)) { showWarn('⚠️ Lancez un diff avec différences avant de définir une zone de focus.'); return; }
      focusDrawing = !focusDrawing; focusStart = null;
      focusZoneToggle.textContent = focusDrawing ? 'Tracer zones…' : 'Zones focus';
      if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); drawMasks(); drawFocusRects(); }
    });
    if(focusZoneClear){
      focusZoneClear.addEventListener('click', ()=>{
        if(!focusRects.length){ showWarn('⚠️ Aucune zone de focus à effacer.'); return; }
        focusRects.length = 0;
        if(hasDiff) executeDiff(); else if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); drawMasks(); }
        updateButtons();
      });
    }
    // Integrate with existing mouse handlers by augmenting them (already above): add overlay previews
    maskCanvas.addEventListener('mousedown', e=>{
      if(!focusDrawing){
        // allow deletion of a focus rect with meta/ctrl click when not drawing
        if((e.metaKey||e.ctrlKey) && focusRects.length){
          const rect = maskCanvas.getBoundingClientRect();
          const x = Math.round((e.clientX-rect.left)*(canvas.width/rect.width));
          const y = Math.round((e.clientY-rect.top)*(canvas.height/rect.height));
          const idx = focusRects.findIndex(r=> x>=r.x && y>=r.y && x<r.x+r.w && y<r.y+r.h);
          if(idx!==-1){ focusRects.splice(idx,1); if(hasDiff) executeDiff(); if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); drawMasks(); drawFocusRects(); } updateButtons(); }
        }
        return;
      }
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left)*(canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top)*(canvas.height/rect.height));
      focusStart = {x,y};
    });
    maskCanvas.addEventListener('mousemove', e=>{
      if(!focusDrawing || !focusStart) return;
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left)*(canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top)*(canvas.height/rect.height));
      const r = { x: Math.min(focusStart.x,x), y: Math.min(focusStart.y,y), w: Math.abs(x-focusStart.x), h: Math.abs(y-focusStart.y) };
      // Redraw masks + preview rectangle
      if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); drawMasks(); drawFocusRects(); mctx.save(); mctx.strokeStyle='rgba(0,135,62,0.95)'; mctx.setLineDash([6,4]); mctx.lineWidth=2; mctx.strokeRect(r.x+0.5,r.y+0.5,r.w-1,r.h-1); mctx.restore(); }
    });
    const finishFocus = e=>{
      if(!focusDrawing || !focusStart) return;
      const rect = maskCanvas.getBoundingClientRect();
      const x = Math.round((e.clientX-rect.left)*(canvas.width/rect.width));
      const y = Math.round((e.clientY-rect.top)*(canvas.height/rect.height));
      const r = { x: Math.min(focusStart.x,x), y: Math.min(focusStart.y,y), w: Math.abs(x-focusStart.x), h: Math.abs(y-focusStart.y) };
      if(r.w>4 && r.h>4){ focusRects.push(r); focusZoneClear && focusZoneClear.classList.remove('blocked'); }
      focusStart=null; // keep drawing mode active to allow adding multiple zones
      if(mctx){ mctx.clearRect(0,0,maskCanvas.width,maskCanvas.height); drawMasks(); drawFocusRects(); }
      if(hasDiff) executeDiff();
      updateButtons();
    };
    maskCanvas.addEventListener('mouseup', finishFocus);
    maskCanvas.addEventListener('mouseleave', finishFocus);
  }

  // Draw existing focus rectangles overlay (outlines only)
  function drawFocusRects(){
    if(!mctx || !focusRects.length) return;
    mctx.save();
    focusRects.forEach(r=>{
      mctx.strokeStyle='rgba(0,135,62,0.95)';
      mctx.setLineDash([6,4]);
      mctx.lineWidth=2;
      mctx.strokeRect(r.x+0.5,r.y+0.5,r.w-1,r.h-1);
    });
    mctx.restore();
  }

  // init canvas
  setCanvasSize(800, 400);
})();
