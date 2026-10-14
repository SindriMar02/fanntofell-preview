/* Local-only enquiry demonstration: no uploads, requests or persistent storage. */
(() => {
  'use strict';
  const form = document.querySelector('#project-form');
  const workspace = document.querySelector('.project-workspace');
  const complete = document.querySelector('.project-complete');
  const field = name => form.elements.namedItem(name);
  const panels = [...form.querySelectorAll('[data-step]')];
  const error = document.querySelector('#form-error');
  const fileError = document.querySelector('#file-error');
  const rows = document.querySelector('#dimension-rows');
  let step = 0, pieceId = 0, files = [];
  const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function values() {
    const dims = field('unknown').checked ? 'Mál óákveðin' : [...rows.children].map((row, i) => {
      const v = [...row.querySelectorAll('input')].map(el => el.value || '…');
      return `Eining ${i + 1}: ${v[0]} × ${v[1]} mm · ${v[2]} stk.`;
    }).join('\n');
    return [['Vöruflokkur', field('product').value], ['Efnisósk', field('material').value], ['Hugmynd', field('description').value || 'Ekki skráð'], ['Áætluð mál', dims], ['Viðhengi', files.length ? files.map(f => f.name).join('\n') : 'Engin valin'], ['Uppsetning', field('installation').value]];
  }
  function summary() {
    document.querySelector('#summary-list').innerHTML = values().map(([k,v]) => `<div><dt>${escapeText(k)}</dt><dd>${escapeText(v)}</dd></div>`).join('');
  }
  function showStep(n, focus = true) {
    step = n;
    panels.forEach((p,i) => { p.hidden = i !== n; p.disabled = i !== n; });
    document.querySelectorAll('.form-progress li').forEach((li,i) => {
      if (i === n) li.setAttribute('aria-current','step'); else li.removeAttribute('aria-current');
    });
    error.textContent = '';
    summary();
    if (focus) panels[n].querySelector('legend').focus();
  }
  function validate() {
    for (const input of panels[step].querySelectorAll('input,textarea,select')) {
      if (input.disabled) continue;
      if (input.name === 'customer') input.setCustomValidity(input.value.trim() ? '' : 'Skráðu nafn.');
      if (!input.checkValidity()) {
        input.setAttribute('aria-invalid','true');
        input.setAttribute('aria-describedby','form-error');
        error.textContent = input.type === 'email' ? 'Skráðu gilt netfang, til dæmis nafn@example.com.' : input.type === 'number' ? 'Skráðu jákvæð heil mál í mm og fjölda eininga.' : 'Skráðu nafn tengiliðar áður en þú heldur áfram.';
        input.focus(); return false;
      }
    }
    error.textContent = ''; return true;
  }
  function addPiece() {
    if (rows.children.length >= 10) return;
    const id = ++pieceId, row = document.createElement('div'); row.className = 'dimension-row';
    row.innerHTML = `<div class="dimension-title"><h4>Eining ${rows.children.length+1}</h4><button type="button" class="text-button remove-piece">Fjarlægja</button></div><div class="dimension-fields"><label for="length-${id}">Lengd (mm)<input id="length-${id}" name="length-${id}" type="number" min="1" max="99999" step="1" inputmode="numeric" required></label><label for="width-${id}">Breidd / dýpt (mm)<input id="width-${id}" name="width-${id}" type="number" min="1" max="99999" step="1" inputmode="numeric" required></label><label for="quantity-${id}">Fjöldi<input id="quantity-${id}" name="quantity-${id}" type="number" min="1" max="999" step="1" value="1" inputmode="numeric" required></label></div>`;
    rows.append(row);
    row.querySelector('.remove-piece').addEventListener('click', () => {
      row.remove(); if (!rows.children.length) addPiece(); renumber(); summary(); document.querySelector('#add-piece').focus();
    });
    renumber(); return row;
  }
  function renumber() {
    [...rows.children].forEach((r,i) => {
      r.querySelector('h4').textContent = `Eining ${i+1}`;
      r.querySelector('.remove-piece').setAttribute('aria-label',`Fjarlægja einingu ${i+1}`);
      r.querySelectorAll('input').forEach(input => { input.disabled = field('unknown').checked; });
    });
    document.querySelector('#add-piece').disabled = rows.children.length >= 10;
  }
  function renderFiles() {
    const list = document.querySelector('#file-list'); list.replaceChildren();
    files.forEach((file,i) => {
      const li = document.createElement('li'), text = document.createElement('span'), button = document.createElement('button');
      text.textContent = `${file.name} · ${file.size < 1024*1024 ? Math.max(1, Math.round(file.size/1024))+' KB' : (file.size/1024/1024).toFixed(1)+' MB'}`;
      button.type='button'; button.className='text-button'; button.textContent='Fjarlægja'; button.setAttribute('aria-label',`Fjarlægja ${file.name}`);
      button.addEventListener('click',()=>{files.splice(i,1);fileError.textContent='';renderFiles();summary();document.querySelector('#choose-files').focus();});
      li.append(text,button); list.append(li);
    });
  }
  document.querySelector('#choose-files').addEventListener('click',()=>document.querySelector('#drawings').click());
  document.querySelector('#drawings').addEventListener('change', e => {
    const messages=[];
    for (const f of e.target.files) {
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { messages.push(`${f.name}: veldu PDF, JPG eða PNG.`); continue; }
      if (f.size > 10*1024*1024 || !f.size) { messages.push(`${f.name}: skrá þarf að vera stærri en 0 og mest 10 MB.`); continue; }
      if (files.some(x=>x.name===f.name && x.size===f.size && x.lastModified===f.lastModified)) continue;
      if (files.length >= 5) { messages.push('Hámark er 5 skrár. Fjarlægðu skrá til að bæta annarri við.'); break; }
      files.push(f);
    }
    fileError.textContent=messages.join(' '); e.target.value=''; renderFiles(); summary();
  });
  document.querySelector('#add-piece').addEventListener('click',()=>{const r=addPiece();summary();r?.querySelector('input').focus();});
  field('unknown').addEventListener('change',()=>{document.querySelector('#dimensions').hidden=field('unknown').checked;renumber();summary();});
  // Pointer-driven step changes get a short entrance; keyboard ones are instant.
  form.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',e=>{if(validate()){form.classList.toggle('is-live',e.detail!==0);showStep(step+1);}}));
  form.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',e=>{form.classList.toggle('is-live',e.detail!==0);showStep(step-1);}));
  form.addEventListener('input',e=>{if(e.target.matches('input,select,textarea')){e.target.removeAttribute('aria-invalid'); if(e.target.getAttribute('aria-describedby')==='form-error')e.target.removeAttribute('aria-describedby');}summary();});
  form.addEventListener('change',summary);
  function textSummary() {
    return 'FANNTÓFELL · SÝNIDÆMI · EKKERT SENT\n\n'+values().map(([k,v])=>`${k}: ${v}`).join('\n\n')+`\n\nTengiliður: ${field('customer').value}\nNetfang: ${field('email').value}\nSími: ${field('phone').value || 'Ekki skráð'}\nStaðsetning: ${field('location').value || 'Ekki skráð'}\nAnnað: ${field('notes').value || 'Ekki skráð'}\n\nÞetta er fyrirspurnardæmi, ekki pöntun. Öll mál, efni og verð þarf að staðfesta með Fanntófelli. Viðhengi fylgja ekki þessari textaskrá.`;
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if (step !== 2) { if(validate()){form.classList.remove('is-live');showStep(step+1);} return; }
    if(!validate())return;
    document.querySelector('#complete-summary').textContent=textSummary(); complete.classList.add('is-live'); workspace.hidden=true; complete.hidden=false; complete.focus();
  });
  document.querySelector('#edit-project').addEventListener('click',()=>{complete.hidden=true;workspace.hidden=false;showStep(0);});
  document.querySelector('#download-summary').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([textSummary()],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download='fanntofell-synidaemi.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function begin(select) {
    complete.hidden=true;workspace.hidden=false;showStep(0,false);
    // Mark the field the choice landed in, so the jump reads as "carried over".
    select.classList.remove('is-prefilled'); void select.offsetWidth; select.classList.add('is-prefilled');
  }
  document.querySelectorAll('[data-choose-material]').forEach(a=>a.addEventListener('click',()=>{field('material').value=a.dataset.chooseMaterial;begin(field('material'));}));
  document.querySelectorAll('[data-choose-product]').forEach(a=>a.addEventListener('click',()=>{field('product').value=a.dataset.chooseProduct;begin(field('product'));}));
  const tabs=[...document.querySelectorAll('[data-material-tab]')];
  const controls=document.querySelector('.material-controls'), scenes=document.querySelector('.material-scenes');
  function selectMaterial(index) {
    controls.style.setProperty('--i',index);
    tabs.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    document.querySelectorAll('[data-material-panel]').forEach((p,i)=>p.hidden=i!==index);
  }
  tabs.forEach((b,i)=>b.addEventListener('click',e=>{if(b.getAttribute('aria-pressed')==='true')return;scenes.classList.toggle('is-live',e.detail!==0);selectMaterial(i);}));
  controls.hidden=false;selectMaterial(0);
  addPiece();showStep(0,false);workspace.hidden=false;
})();
