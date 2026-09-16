(function(scope){
  'use strict';
  // Frontal anatomical map; near/far keep their anatomical identity when the
  // game sprite is mirrored. Character's right is the viewer's left.
  const shapes={
    head:'M25 3H39V6H42V18H39V22H25V18H22V6H25Z',neck:'M28 23H36V28H28Z',
    torso:'M21 29H43V33H46V49H42V53H22V49H18V33H21Z',abdomen:'M23 54H41V68H23Z',
    pelvis:'M22 69H42V80H37V83H27V80H22Z',
    arm_near:'M13 31H19V49H17V53H11V35H13Z',forearm_near:'M10 55H17V70H15V75H8V61H10Z',hand_near:'M7 77H15V86H12V89H6V80H7Z',
    arm_far:'M45 31H51V35H53V53H47V49H45Z',forearm_far:'M47 55H54V61H56V75H49V70H47Z',hand_far:'M49 77H57V80H58V89H52V86H49Z',
    thigh_near:'M22 83H30V102H21V89H22Z',shin_near:'M22 104H30V121H23V115H22Z',foot_near:'M22 123H30V130H18V127H22Z',
    thigh_far:'M34 83H42V89H43V102H34Z',shin_far:'M34 104H42V115H41V121H34Z',foot_far:'M34 123H42V127H46V130H34Z',
    eye_right:'M25 11H30V15H25Z',eye_left:'M34 11H39V15H34Z'};
  const bones={
    head:'M26 5H38V8H40V17H37V20H27V17H24V8H26Z M26 10V14H30V10Z M34 10V14H38V10Z M31 16V18H33V16Z',
    neck:'M30 24H34V26H30Z M30 27H34V29H30Z',
    torso:'M30 30H34V52H30Z M21 32H43V35H21Z M22 39H29V42H22Z M35 39H42V42H35Z M23 46H29V49H23Z M35 46H41V49H35Z',
    abdomen:'M30 55H34V58H30Z M30 60H34V63H30Z M30 65H34V68H30Z',
    pelvis:'M23 71H28V76H36V71H41V80H35V82H29V80H23Z',
    arm_near:'M13 33H17V37H16V48H17V51H13V48H14V37H13Z',arm_far:'M47 33H51V37H50V48H51V51H47V48H48V37H47Z',
    forearm_near:'M11 56H14V70H13V74H10V70H11Z',forearm_far:'M50 56H53V70H54V74H51V70H50Z',
    hand_near:'M8 78H13V81H8Z M7 82H9V87H7Z M11 82H13V87H11Z',hand_far:'M51 78H56V81H51Z M51 82H53V87H51Z M55 82H57V87H55Z',
    thigh_near:'M23 84H29V88H27V98H29V101H23V98H25V88H23Z',thigh_far:'M35 84H41V88H39V98H41V101H35V98H37V88H35Z',
    shin_near:'M24 105H28V109H27V117H28V120H24V117H25V109H24Z',shin_far:'M36 105H40V109H39V117H40V120H36V117H37V109H36Z',
    foot_near:'M24 123H28V127H20V129H18V126H24Z',foot_far:'M36 123H40V126H46V129H44V127H36Z'};
  class HealthPanel {
    constructor(health,onInjury,clock,inventory,treatment){
      this.treatment=treatment||null;this.canUse=()=>'';
      this.health=health;this.clock=clock;this.inv=inventory||null;this.selected='torso';this.last='';this.view='skin';this.drag=null;this.organSelected='heart';this.hovered=null;
      const $=s=>document.querySelector(s);this.panel=$('#healthPanel');this.toggle=$('#healthToggle');
      const map=$('#healthMap');
      map.innerHTML=Object.entries(shapes).map(([name,d])=>`<path d="${d}" data-part="${name}" fill-rule="evenodd" role="button" tabindex="0" aria-label="${HEALTH_PARTS[name]}"/>`).join('')+'<g id="healthCracks" pointer-events="none"></g>';
      map.insertAdjacentHTML('beforeend','<g id="eyeDetails" pointer-events="none"><path d="M27 12h1v2h-1Z M36 12h1v2h-1Z"/><text x="27.5" y="9">D</text><text x="36.5" y="9">E</text></g><g id="healthMarkers" pointer-events="none"></g>');
      const select=$('#healthPart');
      const organSelect=$('#organSelect');
      for(const [id,def] of Object.entries(ORGAN_DEFS)){const o=document.createElement('option');o.value=id;o.textContent=def.label;organSelect.append(o);}
      organSelect.value=this.organSelected;
      const chooseOrgan=id=>{this.organSelected=id;organSelect.value=id;this.selected=ORGAN_DEFS[id].region;select.value=this.selected;this.last='';this.render();};
      organSelect.addEventListener('change',()=>chooseOrgan(organSelect.value));
      $('#organBars').addEventListener('click',e=>{const b=e.target.closest('[data-organ-select]');if(b)chooseOrgan(b.dataset.organSelect);});
      $('#organDamage').addEventListener('click',()=>{health.damageOrgan(this.organSelected,40);this.last='';this.render();});
      $('#organTrauma').addEventListener('click',()=>{health.damageOrgan(this.organSelected,40,true);this.last='';this.render();});
      const organCenters={brain:[48,14],heart:[48,65],lung_right:[29,43],lung_left:[67,43],liver:[48,89],kidney_right:[29,113],kidney_left:[67,113]};
      map.insertAdjacentHTML('beforeend','<g id="healthOrganMap"><path class="organ-guide" d="M39 4H57V7H63V27H57V33H76V37H83V128H72V136H24V128H13V37H20V33H39V27H33V7H39Z"/><path class="organ-guide" d="M48 34V127 M19 77H77"/>'+Object.entries(ORGAN_DEFS).map(([id,def])=>{
        const [cx,cy]=organCenters[id],shape=HUD_ORGAN_SHAPES[id],w=shape[0].length,h=shape.length;
        return `<g data-organ="${id}" role="button" tabindex="0" aria-label="${def.label}" transform="translate(${cx-w} ${cy-h}) scale(2)"><rect class="organ-hit" x="-1" y="-1" width="${w+2}" height="${h+2}"/>${organPixels(id)}</g>`;
      }).join('')+'</g>');
      $('#organBars').innerHTML=Object.entries(ORGAN_DEFS).map(([id,def])=>`<button data-organ-select="${id}">${organIcon(id)}<span>${def.label}</span><output></output><progress aria-label="Vida: ${def.label}" max="100" value="100"></progress></button>`).join('');
      for(const [value,label] of Object.entries(HEALTH_PARTS)){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
      select.value=this.selected;
      const choose=name=>{this.selected=name;select.value=name;this.last='';this.render();};
      select.addEventListener('change',()=>choose(select.value));
      map.addEventListener('click',e=>{const t=e.target.closest('[data-part],[data-organ]');if(t?.dataset.part)choose(t.dataset.part);if(t?.dataset.organ)chooseOrgan(t.dataset.organ);});
      map.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.organ){e.preventDefault();chooseOrgan(e.target.dataset.organ);}});
      map.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key) && e.target.dataset.part){e.preventDefault();choose(e.target.dataset.part);}});
      this.toggle.addEventListener('click',()=>this.open(this.panel.hidden));
      $('#healthClose').addEventListener('click',()=>this.open(false));
      $('#treatmentCancel').addEventListener('click',()=>this.cancelTreatment());
      document.querySelectorAll('[data-injury]').forEach(b=>b.addEventListener('click',()=>{onInjury(this.selected,b.dataset.injury);this.last='';this.render();}));
      document.addEventListener('keydown',e=>{
        if(e.code==='KeyH' && !e.repeat && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();this.open(this.panel.hidden);}
        if(e.key==='Escape'&&this.treatment?.active){e.preventDefault();this.cancelTreatment();return;}
        if(e.key==='Escape' && !this.panel.hidden)this.open(false);
      });
      document.querySelectorAll('[data-health-view]').forEach(b=>b.addEventListener('click',()=>{
        this.hideTooltip();
        this.view=b.dataset.healthView;
        document.querySelector('#showBones').checked=this.view==='bones';
        this.last='';this.render();
      }));
      this.initMaster();this.initTooltip();
      this.initDrag();this.render();
    }
    clearTreatmentPreview(){
      this.panel.querySelectorAll('[data-drop-ok]').forEach(el=>el.removeAttribute('data-drop-ok'));
    }
    previewTreatment(entryId,x,y){
      this.clearTreatmentPreview();
      const hit=document.elementFromPoint(x,y);
      if(this.panel.hidden||!hit||!this.panel.contains(hit))return null;
      this.hideTooltip();
      const target=hit.closest('#healthMap [data-part],#healthMap [data-organ],#healthWounds');
      const region=target?.dataset.part||(target?.dataset.organ?ORGAN_DEFS[target.dataset.organ].region:target?.id==='healthWounds'?this.selected:null);
      const reason=region?(this.canUse()||this.treatment.reason(entryId,region)):'Solte o item sobre a região ferida.';
      if(target)target.dataset.dropOk=String(!reason);
      return {external:true,ok:!reason,region,message:reason||`${TREATMENTS[this.inv.get(entryId).def].label} · ${HEALTH_PARTS[region]}`};
    }
    startTreatment(entryId,region){
      this.clearTreatmentPreview();
      const ok=this.treatment.start(entryId,region,this.canUse());
      if(ok){this.selected=region;document.querySelector('#healthPart').value=region;}
      this.last='';this.render();this.onCase?.();return ok;
    }
    cancelTreatment(){
      if(this.treatment?.cancel()){this.render();this.onCase?.();}
    }
    renderTreatment(){
      if(!this.treatment)return;
      const a=this.treatment.snapshot(),$=s=>document.querySelector(s);
      $('#treatmentStatus').hidden=!a;
      if(a){
        $('#treatmentLabel').textContent=`${a.label} · ${HEALTH_PARTS[a.region]}`;
        $('#treatmentTime').textContent=`${Math.ceil(a.duration-a.elapsed)} s`;
        $('#treatmentProgress').value=a.progress;
      }
      $('#treatmentMessage').textContent=a?'':this.treatment.message;
      if(this.treatmentStamp!==this.treatment.revision){
        this.treatmentStamp=this.treatment.revision;
        this.panel.querySelectorAll('[data-treating]').forEach(el=>el.removeAttribute('data-treating'));
        if(a)this.panel.querySelector(`#healthMap [data-part="${a.region}"]`)?.setAttribute('data-treating','true');
      }
    }
    initMaster(){
      const $=s=>document.querySelector(s),clock=this.clock;
      $('#healthClockToggle').addEventListener('click',()=>{clock.setRunning(!clock.running);this.render();});
      $('#healthSuspend').addEventListener('change',e=>{this.health.setSuspended(e.target.checked);this.render();});
      const rules=$('#survivalRules');
      rules.innerHTML=Object.entries(clock.rules).map(([id,r])=>`<div class="rule-row"><span>${r.label}</span><label>Crítico (s)<input type="number" min="0" max="86400" step="1" data-rule="${id}" data-phase="critical" aria-label="${r.label}: segundos em estado crítico" value="${r.critical}"></label><label>Agonia (s)<input type="number" min="0" max="86400" step="1" data-rule="${id}" data-phase="agony" aria-label="${r.label}: segundos em agonia" value="${r.agony}"></label></div>`).join('');
      rules.addEventListener('change',e=>{
        const input=e.target;if(!input.dataset.rule)return;
        const rule=clock.rules[input.dataset.rule],value=input.valueAsNumber;
        if(!Number.isInteger(value)||!input.checkValidity()){input.value=rule[input.dataset.phase];$('#rulesNotice').textContent='Use segundos inteiros entre 0 e 86400.';return;}
        clock.configure(input.dataset.rule,input.dataset.phase==='critical'?value:rule.critical,input.dataset.phase==='agony'?value:rule.agony);
        $('#rulesNotice').textContent='Regra atualizada. Vale para novos episódios.';
      });
      $('#resetSurvivalRules').addEventListener('click',()=>{clock.resetRules();rules.querySelectorAll('input').forEach(i=>i.value=clock.rules[i.dataset.rule][i.dataset.phase]);$('#rulesNotice').textContent='Padrões restaurados. Contagens em andamento foram mantidas.';});
    }
    woundText(name){
      const p=this.health.parts.get(name),w=[];
      if(p.missing)return 'Membro separado do corpo';
      if(p.bruise>.1)w.push(`Hematoma ${p.bruise>40?'forte':'leve'}`);
      if(p.cut>0)w.push(`Corte ${p.cut>45?'profundo':'superficial'}`);
      if(p.bleed>0)w.push('Sangramento ativo');
      if(p.fracture)w.push(p.splinted?'Fratura imobilizada':'Osso quebrado');
      if(p.bandaged)w.push('Bandagem aplicada');
      if(p.infection>0)w.push(`Infecção ${Math.ceil(p.infection)}%`);
      if(p.necrosis>0)w.push(`Necrose ${Math.ceil(p.necrosis)}%`);
      if(p.treated)w.push('Tratamento aplicado');
      if(name.startsWith('eye_')&&p.hp<100)w.push(p.hp===0?'Olho sem visão':'Visão prejudicada');
      if(p.hp===0)w.push('Região sem função');
      return w.join(' · ')||'Sem ferimentos nesta região.';
    }
    initTooltip(){
      const map=document.querySelector('#healthMap');
      const show=e=>{const el=e.target.closest('[data-part],[data-organ]');if(!el)return;this.hovered=el;el.setAttribute('aria-describedby','healthTooltip');this.updateTooltip();};
      map.addEventListener('pointerover',show);map.addEventListener('focusin',show);
      map.addEventListener('pointerleave',()=>this.hideTooltip());map.addEventListener('focusout',()=>this.hideTooltip());
      this.panel.addEventListener('scroll',()=>this.updateTooltip());
    }
    hideTooltip(){this.hovered?.removeAttribute('aria-describedby');this.hovered=null;document.querySelector('#healthTooltip').hidden=true;}
    updateTooltip(){
      const tip=document.querySelector('#healthTooltip'),el=this.hovered;if(!el||this.panel.hidden){tip.hidden=true;return;}
      const id=el.dataset.part||el.dataset.organ,isOrgan=!!el.dataset.organ,p=isOrgan?this.health.organs.get(id):this.health.parts.get(id);
      const title=isOrgan?ORGAN_DEFS[id].label:HEALTH_PARTS[id];
      const detail=isOrgan?(p.detached?'Órgão separado':p.hp<=0?'Órgão sem função':p.hp<100?'Órgão lesionado':'Órgão saudável'):this.woundText(id);
      tip.textContent=`${title} · ${Math.ceil(p.hp)} / 100 PV\n${detail}`;tip.hidden=false;
      const r=el.getBoundingClientRect(),box=tip.getBoundingClientRect();
      let x=r.right+10;if(x+box.width>window.innerWidth-8)x=r.left-box.width-10;
      tip.style.left=Math.max(8,Math.min(window.innerWidth-box.width-8,x))+'px';tip.style.top=Math.max(8,Math.min(window.innerHeight-box.height-8,r.top))+'px';
    }
    initDrag(){
      const handle=document.querySelector('#healthHandle');
      const clampPosition=(x,y)=>{
        const box=this.panel.getBoundingClientRect();
        this.panel.style.left=Math.max(0,Math.min(window.innerWidth-box.width,x))+'px';
        this.panel.style.top=Math.max(0,Math.min(window.innerHeight-box.height,y))+'px';
        this.panel.style.right='auto';
      };
      this.clampHud=clampPosition;
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0 || e.target.closest('button'))return;
        const r=this.panel.getBoundingClientRect();this.drag={id:e.pointerId,dx:e.clientX-r.x,dy:e.clientY-r.y};
        handle.setPointerCapture(e.pointerId);e.preventDefault();
      });
      handle.addEventListener('pointermove',e=>{if(this.drag?.id===e.pointerId)clampPosition(e.clientX-this.drag.dx,e.clientY-this.drag.dy);});
      const release=()=>{this.drag=null;};
      for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,release);
      handle.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
        e.preventDefault();const r=this.panel.getBoundingClientRect();
        clampPosition(r.x+(e.key==='ArrowLeft'?-8:e.key==='ArrowRight'?8:0),r.y+(e.key==='ArrowUp'?-8:e.key==='ArrowDown'?8:0));
      });
      window.addEventListener('resize',()=>{if(!this.panel.hidden){const r=this.panel.getBoundingClientRect();clampPosition(r.x,r.y);}});
    }
    open(show){
      this.hideTooltip();
      this.panel.hidden=!show;this.toggle.setAttribute('aria-expanded',String(show));
      if(show){const r=this.panel.getBoundingClientRect();this.clampHud(r.x,r.y);}
      this.last='';this.render();
      if(show)document.querySelector('#healthClose').focus({preventScroll:true});else this.toggle.focus({preventScroll:true});
    }
    render(){
      const h=this.health,$=s=>document.querySelector(s);
      this.renderTreatment();
      const prognosis=h.prognosis;
      $('#healthClockToggle').textContent=this.clock.running?'Ⅱ Pausar saúde':'▶ Iniciar saúde';
      $('#healthClockToggle').setAttribute('aria-pressed',String(this.clock.running));
      $('#healthClockState').textContent=this.clock.running?'RELÓGIO ATIVO':'SAÚDE PAUSADA';
      $('#healthClockState').dataset.running=String(this.clock.running);
      $('#healthClockTime').textContent=new Date(this.clock.time*1000).toISOString().slice(11,19);
      $('#healthGlobalAlert').textContent=h.dead?h.status:h.suspended?'Piora suspensa pelo mestre':prognosis?`${h.status} · ${prognosis.transition==='death'?'morte':'colapso'} em ${Math.ceil(prognosis.remaining)} s`:'';
      this.updateTooltip();
      this.toggle.dataset.severity=h.dead?'dead':h.bleeding?'bleeding':h.amputated?'missing':h.vitality<99.5?'injured':'healthy';
      this.toggle.setAttribute('aria-label',`Saúde: ${h.status}, ${Math.ceil(h.vitality)}%. Abrir painel`);
      $('#healthBadge').textContent=Math.ceil(h.vitality)+'%';
      if(this.panel.hidden)return;
      const stamp=JSON.stringify([h.revision,this.inv?this.inv.revision:0,this.clock.running,Math.ceil(h.blood),Math.ceil(h.vitality),Math.ceil(prognosis?.remaining||0),this.selected,h.status,this.view,this.organSelected,Math.ceil(h.parts.get(this.selected).hp),Math.ceil(h.parts.get(this.selected).boneHp),[...h.parts.values()].map(p=>[Math.ceil(p.infection),Math.ceil(p.necrosis)])]);
      if(stamp===this.last)return;this.last=stamp;
      $('#healthStatus').textContent=h.status;
      this.panel.dataset.vitalState=h.vitalState;
      $('#healthPrognosis').textContent=h.dead?`Causa: ${h.deathCause}`:prognosis?`${prognosis.cause} · ${prognosis.transition==='death'?'morte':'colapso'} em ${Math.ceil(prognosis.remaining)} s${h.suspended?' · intervenção do mestre':!this.clock.running?' · contagem pausada':''}`:h.oneLung?'Um pulmão funcional · movimento limitado e sem corrida':'';
      $('#healthPrognosis').hidden=!$('#healthPrognosis').textContent;
      $('#healthSuspend').checked=h.suspended;$('#healthSuspend').disabled=h.dead;
      $('#healthVitality').value=h.vitality;$('#healthVitalityText').textContent=Math.ceil(h.vitality)+'%';
      $('#healthBlood').value=h.blood;$('#healthBloodText').textContent=h.blood.toFixed(0)+'%';
      $('#healthBleeding').textContent=h.bleeding?`Perdendo ${h.bleeding.toFixed(2)}% de sangue/s`:'Sem sangramento ativo';
      const p=h.parts.get(this.selected);
      $('#healthPartLife').value=p.hp;$('#healthPartLifeText').textContent=Math.ceil(p.hp)+' / '+p.maxHp;
      $('#healthBoneLife').textContent=p.boneHp===null?'Sem osso':`Osso: ${Math.ceil(p.boneHp)} / 100`;
      const infectionRisk=!p.missing&&(p.hp===0||p.cut>0||p.infection>0||p.necrosis>0);
      $('#healthInfectionWrap').hidden=!infectionRisk;
      $('#healthInfection').value=p.infection;$('#healthInfectionText').textContent=Math.ceil(p.infection)+'%';
      $('#healthNecrosisText').textContent=(p.necrosis>0?`Necrose: ${Math.ceil(p.necrosis)}% · tecido perdido`:'Ao atingir 100%, a região começa a necrosar.')+(p.treated?' · Tratamento aplicado':'');
      $('#healthVision').textContent=h.blind?'VISÃO: CEGUEIRA TOTAL':`VISÃO D ${Math.ceil(h.vision.right)}% · E ${Math.ceil(h.vision.left)}%`;
      $('#healthMap').dataset.view=this.view;
      $('#healthMap').setAttribute('viewBox',this.view==='organs'?'0 0 96 144':'0 0 64 132');
      $('.organ-panel').hidden=this.view!=='organs';
      $('.health-region').hidden=this.view==='organs';
      document.querySelectorAll('[data-health-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.healthView===this.view)));
      $('#healthOrganMap').style.display=this.view==='organs'?'':'none';
      document.querySelectorAll('#healthOrganMap [data-organ]').forEach(el=>{
        const o=h.organs.get(el.dataset.organ);el.style.opacity=o.detached?'.2':o.hp===0?'.45':'1';el.setAttribute('aria-pressed',String(el.dataset.organ===this.organSelected));el.setAttribute('aria-label',`${ORGAN_DEFS[el.dataset.organ].label}: ${Math.ceil(o.hp)} PV${o.detached?', separado':o.hp===0?', sem função':''}`);
      });
      for(const [id,o] of h.organs){const button=$(`#organBars [data-organ-select="${id}"]`);button.setAttribute('aria-pressed',String(id===this.organSelected));button.querySelector('output').textContent=`${Math.ceil(o.hp)} / 100${o.detached?' · FORA':o.hp===0?' · SEM FUNÇÃO':''}`;button.querySelector('progress').value=o.hp;}
      const organ=h.organs.get(this.organSelected);
      $('#organStatus').textContent=organ.detached?'Órgão desprendido · peça física na cena':organ.hp===0?'Órgão sem função':organ.hp<100?'Órgão lesionado':'Órgão protegido e saudável';
      $('#organDamage').disabled=h.dead||organ.detached;$('#organTrauma').disabled=h.dead||organ.detached;

      $('#healthWounds').textContent=this.woundText(this.selected);
      document.querySelectorAll('[data-injury]').forEach(b=>b.disabled=h.dead || p.missing
        || (b.dataset.injury==='sever' && !HEALTH_SEVERABLE.test(this.selected))
        || (b.dataset.injury==='fracture' && (p.boneHp===null||p.fracture))
        || (b.dataset.injury==='eye' && !this.selected.startsWith('eye_')));

      document.querySelectorAll('#healthMap [data-part]').forEach(el=>{
        const part=h.parts.get(el.dataset.part);
        el.setAttribute('d',this.view==='bones'?(bones[el.dataset.part]||shapes[el.dataset.part]):shapes[el.dataset.part]);
        const status=part.missing?'missing':part.necrosis>0?'necrosis':part.infection>0?'infection':part.fracture?'fracture':part.hp===0?'destroyed':part.bleed>0?'bleeding':part.bandaged?'bandaged':part.cut>0?'cut':part.bruise>.1?'bruise':'healthy';
        el.dataset.state=status;el.setAttribute('aria-pressed',String(el.dataset.part===this.selected));
        el.setAttribute('aria-label',HEALTH_PARTS[el.dataset.part]+': '+({necrosis:'necrose',infection:'infecção',fracture:'fratura',destroyed:'sem função',missing:'separado',bleeding:'sangrando',bandaged:'com bandagem',cut:'corte',bruise:'hematoma',healthy:'saudável'})[status]);
      });
      $('#healthCracks').innerHTML=this.view==='bones'?[...h.parts].filter(([n,p])=>p.fracture&&!p.missing&&bones[n]).map(([name])=>{
        const box=document.querySelector(`#healthMap [data-part="${name}"]`).getBBox();
        const x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height/2);
        return `<path d="M${x-3} ${y-1}h3v1h3v2h-3v-1h-3Z" fill="#101c22"/><path d="M${x-1} ${y}h2v1h-2Z" fill="#dc6d54"/>`;
      }).join(''):'';
      // Badges hang off the outer edge of each wounded region; eye badges sit
      // beside the skull so they never bury the face.
      $('#healthMarkers').innerHTML=[...document.querySelectorAll('#healthMap [data-part]')]
        .filter(el=>el.dataset.state!=='healthy'&&INJURY_ICONS[el.dataset.state])
        .map(el=>{
          const b=el.getBBox(),kind=el.dataset.state,eye=el.dataset.part.startsWith('eye_');
          const x=eye?(b.x<32?b.x-12:b.x+8):b.x+b.width-5;
          const y=eye?b.y-2:Math.min(b.y+1,132-INJURY_SIZE);
          return `<g class="injury-marker" data-kind="${kind}" transform="translate(${Math.round(x)} ${Math.round(y)})">${injuryPixels(kind)}</g>`;
        }).join('');
    }
    position(x,y){this.toggle.style.left=Math.max(4,Math.min(94,x/480*100))+'%';this.toggle.style.top=Math.max(5,Math.min(90,y/270*100))+'%';}
  }
  class BloodEffects {
    constructor(){this.drops=[];this.stains=[];this.emission=new Map();this.serial=0;}
    step(dt,health,positions,ground){
      if(!health.dead)for(const [name,p] of health.parts)if(p.bleed>0 && positions.has(name)){
        let time=(this.emission.get(name)||0)+dt*Math.min(9,2+p.bleed*3);
        while(time>=1){time--;const at=positions.get(name),n=this.serial++;
          this.drops.push({x:at.x,y:at.y,vx:Math.sin(n*2.4)*12,vy:5,life:3});}
        this.emission.set(name,time);
      }
      for(const d of this.drops){d.vy+=500*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.life-=dt;
        if(d.y>=ground){this.stains.push({x:d.x,y:ground-1,w:2+this.serial%4});d.life=0;}}
      this.drops=this.drops.filter(d=>d.life>0).slice(-120);this.stains=this.stains.slice(-200);
    }
    draw(ctx,camera){
      ctx.fillStyle='#642d32';for(const s of this.stains)ctx.fillRect(Math.round(s.x-camera),s.y,s.w,1);
      ctx.fillStyle='#ad4145';for(const d of this.drops)ctx.fillRect(Math.round(d.x-camera),Math.round(d.y),1,2);
    }
  }
  scope.HealthPanel=HealthPanel;scope.BloodEffects=BloodEffects;
})(globalThis);
