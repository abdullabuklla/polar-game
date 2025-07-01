// ---------------------------------------------------------------------------
// Polar game  – Target & Exercise modes
// * Log-scaling strip-plot
// * Dynamic polar grid  ⟷  Classic 200-px grid (checkbox in header)
// ---------------------------------------------------------------------------

const CANVAS_W = 1200;
const CANVAS_H = 900;
const TWO_PI   = Math.PI * 2;

let gridBottomY = 0;

/*──────── general state ────────*/
let rho = 100, phi = 0;
let continueMove = true;
let rhoStep;
let rhoStepInput;
const keyPhiStep = 0.005;

let countdown = 0;
let countdownMsg = '';
let countdownStartTime = 0;

let showOriginalPlot = false;   // ← checkbox toggles this

/*──────── modes ────────*/
const MODE_TARGET   = 'target';
const MODE_EXERCISE = 'exercise';
let mode            = MODE_TARGET;
let originalChk;

/*──────── Target mode ────────*/
let target, reachThreshold = 10, sparkle = 0;
let gotoPanel, targetRhoInput, targetPhiInput;
let animateToTarget = false, targetRho = 0, targetPhi = 0;

/*──────── Exercise mode ────────*/
let drawerVisible = false;
let exerciseOn    = false;
let exerciseDone  = false;

let drawer, exprInput, phiFromInput, phiToInput, speedInput;
let phiCurr, phiFrom = 0, phiTo = Math.PI;
let sweepRadStep = 0.005;           // rad / frame
let targetFn = p => 100;

/* stores the full reference curve once per run */
let refPts = [];

let truePts = [], userPts = [];
const linePlotH = 150;

/*──────── setup ────────*/
function setup () {
    createCanvas(CANVAS_W, CANVAS_H + linePlotH + 130);

    buildExerciseDrawer();
    buildHeaderBar();
    buildGotoControls();

    angleMode(RADIANS);
    textFont('Georgia');

    target = createVector(random(width), random(height));
}

/*════════ DRAW LOOP ════════*/
function draw () {
    if (animateToTarget) animateStep();
    if (mode === MODE_EXERCISE && countdown > 0) {
        background(20);  // clear frame first
        drawCartesianGrid(); // optional, looks better
        drawPolarGrid();     // optional, shows context

        const elapsed = (millis() - countdownStartTime) / 1000;
        countdown = max(0, 3 - floor(elapsed));

        fill(255); textAlign(CENTER, CENTER);

        textSize(28);
        text(countdownMsg, width / 2, height / 2 - 40);

        textSize(64);
        text(countdown > 0 ? countdown : 'Go!', width / 2, height / 2 + 20);

        if (countdown === 0) {
            phiCurr = phiFrom;
            rho = targetFn(phiCurr);
            truePts = [];
            userPts = [];
            exerciseDone = false;
            exerciseOn = true;
        }

        return; // prevent rest of draw() from running
    }


    if (mode === MODE_EXERCISE && exerciseOn) exerciseStep();

    background(20);
    drawCartesianGrid();

    /* current point */
    phi = (phi + TWO_PI) % TWO_PI;
    const cartX = rho * cos(phi), cartY = rho * sin(phi);
    const x = width/2 + cartX,    y = height/2 - cartY;

    drawPolarGrid();
    if (mode === MODE_EXERCISE) drawPolarPaths();
    drawAngleArc(phi);

    stroke(180,100,255); line(width/2, height/2, x, y);

    stroke(255); strokeWeight(2);
    fill(128,0,128); textSize(14); textAlign(CENTER);
    text(`ρ = ${rho.toFixed(2)}`, (width/2+x)/2, (height/2+y)/2);
    noStroke();

    fill(255); ellipse(width/2,height/2,10);
    fill(0,200,255); ellipse(x,y,16);

    if (mode === MODE_TARGET) drawTargetExtras(x,y);
    if (continueMove) handleKeys();

    /* HUD */
    fill(255); textSize(14); textAlign(LEFT);
    text(`ρ = ${rho.toFixed(2)}`,   10, 60);
    text(`φ = ${(degrees(phi)).toFixed(2)}°`, 10, 80);
    text(`x = ${cartX.toFixed(2)}`, 10,100);
    text(`y = ${cartY.toFixed(2)}`,10,120);

    if (mode === MODE_EXERCISE){
        drawLinePlot();
        if (exerciseDone) showScoreBanner();
    }

    drawContinueButton();
}

/*════════ HEADER ════════*/
function buildHeaderBar () {
    const bar = createDiv()
        .style('width', CANVAS_W+'px').style('height','30px')
        .style('background','#444').style('display','flex')
        .style('align-items','center').style('gap','12px')
        .style('padding','20 20px').style('color','#fff')
        .style('font-family','Georgia')
        .style('position','absolute').style('top','0').style('left','100')
        .style('z-index','999');

    /* mode switch button */
    const btn = createButton('Switch to Exercise Mode').parent(bar);
    btn.mousePressed(() => {
        if (mode === MODE_TARGET) enterExerciseMode(btn);
        else                      enterTargetMode(btn);
    });

    /* checkbox for original plot */
    originalChk = createCheckbox('Original plot', false)
        .parent(bar)
        .style('margin-left','auto')
        .style('color','#fff')
        .hide()                                 // start hidden
        .changed(() => { showOriginalPlot = originalChk.checked(); });

}

/*──────── enter / leave modes ────────*/
function enterExerciseMode(btn){
    mode = MODE_EXERCISE;
    gotoPanel.hide(); drawer.style('display','flex');
    originalChk.show();
    animateToTarget = false;
    truePts=[]; userPts=[]; exerciseOn=false; exerciseDone=false;
    btn.html('Switch to Target Mode');
}
function enterTargetMode(btn){
    mode = MODE_TARGET;
    drawer.style('display','none'); gotoPanel.show();
    exerciseOn=false; exerciseDone=false;
    originalChk.hide();
    btn.html('Switch to Exercise Mode');
}

/*════════ Target-mode UI ════════*/
function buildGotoControls(){
    gotoPanel=createDiv()
        .style('display','flex').style('gap','10px')
        .style('padding','5px')
        .style('background','#222').style('color','#fff');
    gotoPanel.position(10, height+10);

    gotoPanel.child(createSpan('ρ:'));
    targetRhoInput=createInput('100').size(60).parent(gotoPanel);
    gotoPanel.child(createSpan('φ (°):'));
    targetPhiInput=createInput('45').size(60).parent(gotoPanel);

    createButton('Go To').parent(gotoPanel).mousePressed(()=>{
        targetRho=float(targetRhoInput.value());
        targetPhi=radians(float(targetPhiInput.value()));
        animateToTarget=true;
    });
    createButton('Reset Target').parent(gotoPanel)
        .mousePressed(()=>{ target=createVector(random(width),random(height)); });
}

function drawTargetExtras(px,py){
    fill(255,50,50); ellipse(target.x,target.y,16);
    fill(200); textSize(12); textAlign(LEFT);
    text(`x:${(target.x-width/2).toFixed(1)} y:${(height/2-target.y).toFixed(1)}`,
        target.x+10,target.y);
    if(dist(px,py,target.x,target.y)<reachThreshold) fireworks(); else sparkle=0;
}

/*════════ Exercise-mode UI ════════*/
function buildExerciseDrawer(){
    drawer=createDiv()
        .style('display','none').style('position','absolute')
        .style('left','10px').style('top', `${height+45}px`)
        .style('background','#222').style('color','#fff')
        .style('padding','8px').style('border-radius','6px')
        .style('gap','6px').style('font-family','Georgia');

    drawer.child(createSpan('ρ(φ) = '));
    exprInput = createInput('200*sin(3*phi)').size(180).parent(drawer);

    drawer.child(createSpan(' φ from'));
    phiFromInput = createInput('0').size(50).parent(drawer);
    drawer.child(createSpan('° to'));
    phiToInput   = createInput('180').size(50).parent(drawer);

    drawer.child(createSpan(' speed (°/frame):'));
    speedInput = createInput('0.1').size(50).parent(drawer);

    drawer.child(createSpan('  ρ step:'));
    rhoStepInput = createInput('3').size(50).parent(drawer);   // declare global below

    createButton('Start').parent(drawer).mousePressed(startExercise);

    createButton('Reset').parent(drawer).mousePressed(resetExercise);

}

function startExercise(){
    try{
        targetFn=new Function('phi',`
      const {sin,cos,tan,asin,acos,atan,abs,PI,E,sqrt,pow,exp,log,max,min,floor,ceil}=Math;
      return ${exprInput.value()};
    `); targetFn(0);
    }catch{ alert('Invalid ρ(φ) expression.'); return; }

    /* update rhoStep from the drawer; fallback to default if blank */
    rhoStep = float(rhoStepInput.value()) || 3;

    phiFrom=radians(float(phiFromInput.value()));
    phiTo  = radians(float(phiToInput.value()));
    sweepRadStep=radians(float(speedInput.value())||0.1);

    /* -------- build reference curve once -------- */
    refPts = [];
    for (let a = phiFrom; a <= phiTo; a += sweepRadStep) {
        refPts.push({ phi: a, rho: targetFn(a) });
    }
    /* -------------------------------------------- */

    phiCurr = phiFrom;
    rho     = targetFn(phiCurr);
    truePts = [];
    userPts = [];
    exerciseOn   = true;
    exerciseDone = false;

    phiCurr = phiFrom;
    rho = targetFn(phiCurr);
    truePts = [];
    userPts = [];
    exerciseDone = false;

    countdown = 3;                         // seconds
    countdownStartTime = millis();
    countdownMsg = 'Get ready! Use ↑ and ↓ to match ρ(φ)';
    exerciseOn = false;                    // wait for countdown

}

function resetExercise() {
    exerciseOn = false;
    exerciseDone = false;
    countdown = 0;
    truePts = [];
    userPts = [];
    phiCurr = phiFrom;
    rho = targetFn(phiCurr);
}


function exerciseStep(){
    phiCurr+=sweepRadStep; phi=phiCurr%TWO_PI;
    truePts.push({phi:phiCurr,rho:targetFn(phiCurr)});
    userPts.push({phi:phiCurr,rho});
    if(phiCurr>=phiTo){ exerciseOn=false; exerciseDone=true; }
}

/*════════ Drawing helpers ════════*/
function drawPolarPaths () {
    /* ─ animated orange reference curve ─ */
    if (showOriginalPlot && refPts.length) {
        const endPhi = exerciseDone ? phiTo : phiCurr;   // grow with sweep
        stroke('orange'); noFill(); strokeWeight(2);
        beginShape();
        refPts.forEach(p => {
            if (p.phi <= endPhi) {
                vertex(width/2 + p.rho * cos(p.phi),
                    height/2 - p.rho * sin(p.phi));
            }
        });
        endShape();
    }

    /* cyan player trace */
    if (userPts.length) {
        stroke(0,200,255); noFill(); strokeWeight(2);
        beginShape();
        userPts.forEach(p => vertex(width/2 + p.rho * cos(p.phi),
            height/2 - p.rho * sin(p.phi)));
        endShape();
    }
}


/* strip-plot (log switch at 600) */
function drawLinePlot () {
    push();
    const topGap = 100;                          // distance below grid
    translate(0, gridBottomY + topGap);

    /* background + axes */
    noStroke(); fill(30); rect(0, 0, width, linePlotH);
    stroke(80); line(40, 10, 40, linePlotH - 20);                 // Y axis
    line(40, linePlotH - 20, width - 10, linePlotH - 20);         // X axis

    if (!refPts.length && !userPts.length) { pop(); return; }

    /* helpers */
    const xs = p => map(p.phi, phiFrom, phiTo, 40, width - 10);

    const vals = [...refPts, ...userPts].map(p => p.rho);
    const minR = min(...vals), maxR = max(...vals);
    const useLog = maxR > 600;

    const ys = useLog
        ? r => map(Math.log10(r - minR + 1), 0, Math.log10(maxR - minR + 1), linePlotH - 20, 10)
        : r => map(r,                minR,  maxR,                             linePlotH - 20, 10);

    /* ─── Y-axis ticks & labels ─── */
    stroke(120); fill(180); textSize(10); textAlign(RIGHT, CENTER);
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = useLog
            ? pow(10, i / yTicks * Math.log10(maxR - minR + 1)) + minR - 1
            : lerp(minR, maxR, i / yTicks);
        const y = ys(val);
        line(36, y, 40, y);
        text(val.toFixed(0), 34, y);
    }

    /* ─── X-axis ticks & labels ─── */
    textAlign(CENTER, TOP); stroke(120);
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
        const phiTick = lerp(phiFrom, phiTo, i / xTicks);
        const x = xs({ phi: phiTick });
        line(x, linePlotH - 20, x, linePlotH - 16);
        text(`${degrees(phiTick).toFixed(0)}°`, x, linePlotH - 14);
    }

    /* (log indicator) */
    if (useLog) {
        noStroke(); fill(180); textSize(10); textAlign(LEFT, TOP);
        text('(log)', 6, 6);
    }

    /* ─── curves ─── */
    noFill(); stroke(150); strokeWeight(2);
    beginShape(); refPts.forEach(p => vertex(xs(p), ys(p.rho))); endShape();

    stroke(0, 200, 255);
    beginShape(); userPts.forEach(p => vertex(xs(p), ys(p.rho))); endShape();

    /* ─── axis labels ─── */

    // Y-axis label ρ
    push();
    translate(18, linePlotH / 2);      // left of Y-axis, vertically centred
    rotate(-HALF_PI);                  // rotate text 90° CCW
    noStroke(); fill(200); textSize(12); textAlign(CENTER, CENTER);
    text('ρ', 0, 0);
    pop();

    // X-axis label φ (deg)
    noStroke(); fill(200); textSize(12); textAlign(CENTER, TOP);
    text('φ (deg)', (width + 40) / 2, linePlotH - 2);


    pop();
}



function showScoreBanner () {
    if (!truePts.length) return;

    /* ---- RMSE normalised by mean |ρ| ---- */
    let se = 0, sumAbsR = 0;
    truePts.forEach((pt, i) => {
        const diff = userPts[i].rho - pt.rho;
        se       += diff * diff;        // squared error
        sumAbsR  += abs(pt.rho);        // for scale normalisation
    });

    const rmse   = sqrt(se / truePts.length);
    const meanR  = sumAbsR / truePts.length || 1;   // guard against divide-by-0
    const accRaw = 1 - rmse / meanR;                // 1 = perfect, 0 = rmse = meanR
    const acc    = max(0, accRaw * 100).toFixed(1); // clamp at 0 %

    /* ---- banner ---- */
    fill(255); textAlign(CENTER, CENTER);

    textSize(24);
    text(`Accuracy: ${acc}%`, width / 2, 80);

    textSize(18);
    text(acc >= 80 ? 'Great job 🎉' : 'Try again for better precision.',
        width / 2, 110);
}


/* Polar grid – classic or dynamic */
function drawPolarGrid () {

    /* dynamic */
    let maxR=300;
    if(mode===MODE_EXERCISE){
        const all=[...truePts,...userPts].map(p=>p.rho);
        if(all.length) maxR=max(maxR,max(...all));
    }
    maxR = ceil(maxR/50)*50 + 50;
    gridBottomY = height / 2 + min(maxR, 300);        // pixel y-pos of outermost circle
    stroke(40); noFill();
    for(let r=50;r<=maxR;r+=50) ellipse(width/2,height/2,r*2);
    stroke(80);
    for(let a=0;a<TWO_PI;a+=PI/6){
        const gx=width/2+(maxR+20)*cos(a), gy=height/2-(maxR+20)*sin(a);
        line(width/2,height/2,gx,gy);
        fill(200); noStroke(); textAlign(CENTER);
        text(nf(degrees(a),0,0)+'°',
            width/2+(maxR+35)*cos(a),
            height/2-(maxR+35)*sin(a));
        stroke(80);
    } noStroke();
}

/* Cartesian grid */
function drawCartesianGrid(){
    stroke(30,30,60); strokeWeight(1); fill(100); textSize(10); textAlign(CENTER,CENTER);
    for(let x=0;x<=width;x+=50){ line(x,0,x,height);
        if(x!==width/2) text(x-width/2,x,height/2+48);}
    for(let y=0;y<=height;y+=50){ line(0,y,width,y);
        if(y!==height/2) text(height/2-y,width/2-20,y+38);}
}
function drawAngleArc(a){
    noFill(); stroke(255,100,0); strokeWeight(3);
    arc(width/2,height/2,100,100,-a,0,OPEN);
    stroke(255); strokeWeight(1); fill(255,100,0);
    const mid=-a/2; textAlign(CENTER); textSize(14);
    text(`φ=${degrees(a).toFixed(1)}°`,
        width/2+55*cos(mid), height/2+55*sin(mid));
    noStroke();
}
function drawContinueButton(){
    fill(continueMove?'lightgreen':'gray');
    rect(width-150,20,120,30,10);
    fill(0); textSize(14); textAlign(CENTER,CENTER);
    text(continueMove?'Moving…':'Continue Move', width-90,35);
}
function fireworks(){
    fill(255,255,0); textSize(32); textAlign(CENTER,CENTER);
    text("Hooora!", width/2, height-50);
    sparkle+=0.5;
    for(let i=0;i<30;i++){
        const a=random(TWO_PI),r=random(20,50);
        fill(random(200,255),random(200,255),0,200-sparkle*10);
        ellipse(target.x+r*cos(a),target.y+r*sin(a),random(2,5));
    }
}

/* movement / anim */
function mousePressed(){ if(mouseX>width-150&&mouseX<width-30&&mouseY>20&&mouseY<50) continueMove=!continueMove; }
function animateStep(){
    if(mode!==MODE_TARGET) return;
    let dR=abs(rho-targetRho), dP=abs((targetPhi-phi+TWO_PI)%TWO_PI);
    if(dR>0.5) rho+=(targetRho>rho?1:-1)*1.2; else dR=0;
    if(dP>0.005&&dP<TWO_PI-0.005){
        const dir=((targetPhi-phi+TWO_PI)%TWO_PI)<PI?1:-1;
        phi=(phi+dir*min(dP,0.03)+TWO_PI)%TWO_PI;
    }else dP=0;
    if(!dR && !dP) animateToTarget=false;
}
function keyPressed(){ handleKeys(); }
function handleKeys(){
    if(keyIsDown(UP_ARROW))    rho+=rhoStep;
    // if(keyIsDown(DOWN_ARROW))  rho=max(0,rho-rhoStep);
    if (keyIsDown(DOWN_ARROW))  rho -= rhoStep;
    if(keyIsDown(LEFT_ARROW))  phi+=keyPhiStep;
    if(keyIsDown(RIGHT_ARROW)) phi-=keyPhiStep;
}
