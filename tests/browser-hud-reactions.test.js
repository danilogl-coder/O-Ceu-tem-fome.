'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PNG}=require('pngjs');
const output=path.resolve(__dirname,'../pixel_art/generated/hud-reactions');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const results=[];
  const reload=async()=>{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.demo?.state.time>.1);
    // Compare the real draw call against the exact same frame without the pain
    // layer. Breathing, wounds, physics and camera motion cannot fake this test.
    await page.evaluate(()=>{
      window.reactionFrames=[];
      const proto=InjuryReaction.prototype,apply=proto.applyPose,physical=proto.applyPhysical,draw=Skeleton2D.prototype.rasterize;
      let neutral=null,lastCapture=-1,ready=false;
      proto.applyPose=function(r,h){r.resolve();neutral=new Map(r.world);ready=true;return apply.call(this,r,h);};
      proto.applyPhysical=function(r,h){neutral=new Map(r.world);ready=true;return physical.call(this,r,h);};
      Skeleton2D.prototype.rasterize=function(opts={}){
        if(!ready||this!==window.demo.rig)return draw.call(this,opts);
        ready=false;
        const startPins=new Map(this.pins),actual=draw.call(this,opts),s=window.demo.state;
        if(this===window.demo.rig&&opts.wounds&&neutral&&s.time-lastCapture>=.08){
          lastCapture=s.time;const world=this.world,pins=this.pins;let baseline;
          try{this.world=neutral;this.pins=startPins;baseline=draw.call(this,opts);}finally{this.world=world;this.pins=pins;}
          let changed=0;for(let i=0;i<actual.length;i+=4)if(actual[i]!==baseline[i]||actual[i+1]!==baseline[i+1]||actual[i+2]!==baseline[i+2]||actual[i+3]!==baseline[i+3])changed++;
          reactionFrames.push({time:s.time,changed,cause:s.pain?.cause,active:s.reaction?.severity,age:s.reaction?.age,width:opts.viewport?.width||64,height:opts.viewport?.height||96,pixels:Array.from(actual),baseline:Array.from(baseline)});
          if(reactionFrames.length>100)reactionFrames.shift();
        }
        return actual;
      };
    });
    await page.locator('#healthToggle').click();await page.locator('.injury-tools summary').click();
  };
  const save=async(name)=>{
    assert.deepEqual(errors,[],'the application must keep rendering without errors');
    const frames=await page.evaluate(()=>window.reactionFrames),reacting=frames.filter(f=>f.changed>0);
    const peak=reacting.reduce((best,f)=>!best||f.changed>best.changed?f:best,null);
    assert(peak&&peak.changed>=12,`${name}: reaction must change at least 12 source pixels in the actual draw`);
    assert(reacting.length>=3,`${name}: reaction must persist across rendered frames`);
    for(const [suffix,data] of [['reaction',peak.pixels],['neutral',peak.baseline]])fs.writeFileSync(path.join(output,`${name}-${suffix}.png`),PNG.sync.write({width:peak.width,height:peak.height,data:Buffer.from(data)}));
    results.push({name,peakPixels:peak.changed,visibleFrames:reacting.length});
    return frames;
  };
  try{
    for(const [injury,part] of [['bruise','forearm_near'],['cut','forearm_near'],['fracture','forearm_near'],['eye','eye_right'],['sever','arm_near']]){
      await reload();await page.locator('#healthPart').selectOption(part);await page.evaluate(()=>reactionFrames.length=0);
      await page.locator(`[data-injury="${injury}"]`).click();await page.waitForFunction(()=>window.demo.state.reaction!==null);await page.waitForTimeout(360);
      assert(await page.evaluate(()=>window.demo.state.reaction!==null),`${injury}: HUD reaction disappeared before the user could look back at the character`);
      await page.waitForTimeout(150);await save(injury);
      assert(!(await page.evaluate(()=>demo.state.ragdoll)),`${injury}: visual reaction cannot knock the character down`);
    }
    for(const [organ,cause] of [['heart','heart'],['lung_left','lungs'],['liver','liver'],['kidney_right','kidneys'],['brain','head']]){
      await reload();await page.locator('[data-health-view="organs"]').click();await page.locator('#organSelect').selectOption(organ);await page.locator('#organDamage').click();
      await page.waitForFunction(cause=>demo.state.pain?.cause===cause,cause);await page.waitForFunction(()=>!demo.state.reaction);
      await page.evaluate(()=>reactionFrames.length=0);await page.waitForTimeout(1200);
      assert.equal(await page.evaluate(()=>demo.state.health.vitalState),'active',`${organ}: pain must already appear before failure`);
      assert.equal(await page.evaluate(()=>demo.state.health.time),0,'health clock remains paused');
      await save(organ);await page.locator('#healthClose').click();await page.locator('#scene').screenshot({path:path.join(output,`${organ}-scene.png`)});
      if(organ==='heart'){
        await page.locator('[data-mode="play"]').click();await page.locator('#scene').focus();const x=await page.evaluate(()=>demo.state.playerX);await page.keyboard.down('d');await page.waitForFunction(x=>demo.state.playerX>x+15,x);await page.keyboard.up('d');
        assert.equal(await page.evaluate(()=>demo.state.pain.cause),'heart');
        await page.locator('#pause').click();const age=await page.evaluate(()=>demo.state.pain.age);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>demo.state.pain.age),age,'animation pause freezes pain');
      }
    }
    console.log('PASS: five HUD injury buttons visibly alter actual rendered frames; five organ pain profiles start on the first hit; movement and independent animation/health pause work');
    console.log(JSON.stringify(results));
    assert.deepEqual(errors,[]);
  }finally{await page.screenshot({path:path.join(output,'last.png')});fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,results,state:await page.evaluate(()=>window.demo?.state)},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
