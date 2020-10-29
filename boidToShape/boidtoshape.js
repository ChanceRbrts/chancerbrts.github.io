let canvas = document.getElementById("BoidToShape");
// let ctx = canvas.getContext("2d");
let gl = canvas.getContext("experimental-webgl");

const vertex_shader = `
precision highp float;
attribute vec2 pointPos;
attribute vec4 color;
varying vec4 glColor;
uniform float pointSize;

void main(void){
    // There's no real model view matrix that's being used here.
    // The positions are all wrong! Let's translate them to world coords here.
    gl_Position = vec4((pointPos.x-320.0)/320.0, (240.0-pointPos.y)/240.0, 0.0, 1.0);
    glColor = color;
    gl_PointSize = pointSize;
}
`;

const frag_shader = `
precision highp float;
varying vec4 glColor;

void main(void){
    gl_FragColor = glColor;
}
`;

let boid_velocity = 200;
let boid_TOOCLOSE = 6;
let flock_NEARBY = 106; // ~75*sqrt(2)
let att_NEARBY = 14; // ~10*sqrt(2)
let width = 640;
let height = 480;
let shader = undefined;
let posBuf = undefined;
let colBuf = undefined;
canvas.width = width;
canvas.height = height;

var start_time = undefined;
var flock_color = false;
var flock_pattern = 0;
var flock_lPattern = 0;
var draw_night = false;
var draw_attractors = false;
var draw_points = true;
var mouseX = 0;
var mouseY = 0;

let webGLSetup = () => {
    gl.viewport(0, 0, width, height);
    gl.clearColor(1, 1, 1, 1);
    // Set up and compile the vertex shader.
    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertex_shader);
    gl.compileShader(vertexShader);
    if (gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) == 0){
        alert("VERTEX: " + gl.getShaderInfoLog(vertexShader));
    }
    // Set up and compile the fragment shader.
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, frag_shader);
    gl.compileShader(fragmentShader);
    if (gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) == 0){
        alert("FRAGMENT: " + gl.getShaderInfoLog(fragmentShader));
    }
    shader = gl.createProgram();
    // Set up the actual shader given the vertex and fragment shaders.
    gl.attachShader(shader, vertexShader);
    gl.attachShader(shader, fragmentShader);
    gl.linkProgram(shader);
    if (gl.getProgramParameter(shader, gl.LINK_STATUS) == 0){
        alert("PROGRAM: " + gl.getProgramInfoLog(shader));
    }
    gl.useProgram(shader);
    posBuf = gl.createBuffer();
    colBuf = gl.createBuffer();
}

// Represents one of the dots moving around.
class Boid {
    constructor(x, y){
        this.x = x;
        this.y = y;
        this.color = 0;
        this.multiplier = 1;
        // -PI to PI.
        this.ornt = Math.random()*Math.PI*2-Math.PI;
        this.attID = -1;
        this.chooseNew = 0;
    }

    /**
     * Changes the orientation of the boids.
     * @param {*} closeBoids The boids that are currently in the "flock area"
     * @param {number} deltaTime The seconds that have passed since the last update.
     */
    followBoids(closeBoids, deltaTime){
        // Why didn't I comment anything when I made this originally?!? >:(
        // Start by calculating the orientation change by looking at other orientations.
        var doneWith = 0;
        var maxDoneWith = 0;
        var dOR = 0;
        for (let i = 0; i < closeBoids.length; i++){
            let boid = closeBoids[i];
            // If the boid is a different color, the orientation should be the other way.
            let otnMult = boid.color == this.color ? 1 : -1;
            let dist = Math.sqrt(Math.pow(boid.x-this.x, 2)+Math.pow(boid.y-this.y, 2));
            // If the distance between two boids are too close, then back off as well!
            // The multiplier should be dependent on if the first one is negative.
            let toocloseMult = dist < boid_TOOCLOSE ? (otnMult < 0 ? 8: -8) : 1;
            // Get a weight on the orientation change for this boid.
            let othOrientMult = otnMult * toocloseMult;
            // Get an effective orientation to get the closest difference of orientation.
            var effOrient = boid.ornt;
            if (Math.abs(effOrient+2*Math.PI-this.ornt) < Math.abs(effOrient-this.ornt)){
                effOrient += 2*Math.PI;
            } else if (Math.abs(effOrient-2*Math.PI-this.ornt) < Math.abs(effOrient-this.ornt)){
                effOrient -= 2*Math.PI;
            }
            // Adjust the orientation!
            let orientChange = (effOrient-this.ornt);
            dOR += orientChange*othOrientMult*2.5*boid.multiplier/closeBoids.length;
            // If attractors and multiple colors are in place, 
            // see if the boid needs to go into another attractor.
            doneWith += (boid.color != this.color && boid.attID == this.attID)? 1 : 0;
            maxDoneWith += (this.attID >= 0) ? 1 : 0;
        }
        // Get the percentage of choosing another attractor.
        this.chooseNew = maxDoneWith > 0 ? doneWith*1.0/maxDoneWith : 0;
        // Do a random orientation change to keep things interesting.
        dOR += Math.random()*Math.PI-Math.PI/2;
        this.ornt += dOR*deltaTime;
        // There is a change that this leads the boid into a boundary. 
        // In this case, abruptly change the boid's orientation.
        let nextX = this.x+Math.cos(this.ornt)*boid_velocity*deltaTime;
        let nextY = this.y+Math.sin(this.ornt)*boid_velocity*deltaTime;
        let onBoundX = nextX < 0 || nextX > width;
        let onBoundY = nextY < 0 || nextY > height;
        // Values from Local Hack Day
        if (onBoundX || onBoundY){
            // Turn it around.
            this.ornt += Math.PI;
        }
        // Get the orientation into a -PI to PI range.
        this.ornt = ((this.ornt+Math.PI)%(Math.PI*2))-Math.PI;
    }

    /**
     * This simply just updates the position of the boid.
     * @param {number} deltaTime The seconds that have passed since the last update.
     */ 
    updatePosition(deltaTime){
        this.x += Math.cos(this.ornt)*boid_velocity*deltaTime;
        if (this.x < 0) this.x = 0;
        if (this.x >= width) this.x = width-1;
        this.y += Math.sin(this.ornt)*boid_velocity*deltaTime;
        if (this.y < 0) this.y = 0;
        if (this.y >= height) this.y = height-1;
    }

    /**
     * Makes a representation of a boid.
     */
    getRepr(){
        return {
            x: this.x,
            y: this.y,
            color: this.color,
            multiplier: this.multiplier,
            ornt: this.ornt,
            attID: this.attID
        };
    }
}

// The full logic of the boids, where the attractor goes, and what to draw
class Flock {
    constructor(numOfBoids){
        this.boids = [];
        this.adjBoids = [];
        // Epsilon for the boundaries of the screen. (Flock epsilon)
        let fe = 10;
        for (let i = 0; i < numOfBoids; i++){
            this.boids.push(new Boid(Math.random()*(width-fe*2)+fe, Math.random()*(height-fe*2)+fe));
        }
        this.attractors = []
        this.color = true;
        this.pattern = 0;
        this.moveTime = 0;
    }

    loadAttractors(pattern){
        this.moveTime = 0;
        if (pattern > attractorMaps.length){
            this.pattern = 0;
            flock_pattern = 0;
            return;
        }
        let attMap = attractorMaps[pattern-1];
        let attWid = attMap[0].length;
        let attHei = attMap.length;
        for (let i = 0; i < attMap.length; i++){
            for (let j = 0; j < attMap[i].length; j++){
                let a = parseInt(attMap[i][j]);
                if (isNaN(a)) continue;
                if (a != 0){
                    this.attractors.push({x: j*width/attWid, y:i*height/attHei, move: a > 1});
                }
            }
        }
    }

    update(deltaTime){
        this.adjBoids = [];
        // Reset the adjacent boids.
        for (let i = 0; i < this.boids.length; i++){
            this.adjBoids.push([])
        }
        // If we need to change the current color of the boids, this runs.
        if (flock_color != this.color){
            for (let i = 0; i < this.boids.length; i++){
                // Color red or blue if colored; Otherwise color as white.
                this.boids[i].color = flock_color ? Math.floor(Math.random()*2)+1 : 0;
            }
        }
        this.color = flock_color;
        // If the attractor pattern is changed...
        if (this.pattern != flock_pattern){
            this.pattern = flock_pattern;
            this.attractors = []
            // Change the attractor pattern.
            if (flock_pattern > 0) this.loadAttractors(flock_pattern)
            else if (flock_pattern == -1){ 
                this.attractors.push({x: 0, y: 0, move: false});
            }
            // Make sure the boids have a new attractor ID!
            let attLen = this.attractors.length;
            for (let i = 0; i < this.boids.length; i++){
                let atts = this.attractors.length > 0;
                this.boids[i].attID = atts ? Math.floor(Math.random()*attLen) : -1;
            }
        }
        if (this.pattern == -1){
            // Make the attractor's position to the mouse's position.
            this.attractors[0].x = mouseX;
            this.attractors[0].y = mouseY;
        } else if (this.pattern > 0) {
            this.moveTime += deltaTime;
            for (let att of this.attractors){
                if (!att.move) continue;
                att.y += 100*Math.cos(Math.PI/4*this.moveTime)*deltaTime;
            }
        }
        // Update the boids' orientations.
        for (let i = 0; i < this.boids.length; i++){
            let closeBoids = []
            let boid = this.boids[i];
            for (let j = 0; j < this.adjBoids[i].length; j++){
                closeBoids.push(this.boids[this.adjBoids[i][j][0]]);
            }
            // Add boids that are close to boid to the closeBoids.
            for (let j = i+1; j < this.boids.length; j++){
                let oBoid = this.boids[j];
                let dist = Math.sqrt(Math.pow(boid.x-oBoid.x, 2)+Math.pow(boid.y-oBoid.y, 2));
                if (dist < flock_NEARBY) closeBoids.push(oBoid);
                this.adjBoids[i].push([j, dist]);
                this.adjBoids[j].push([i, dist]);
            }
            // Add the attractor to the close boids if an attactor exists.
            if (boid.attID >= 0 && boid.attID < this.attractors.length){
                let att = this.attractors[boid.attID];
                // The orientation should push the boid towards the attractor.
                let ort = Math.atan2(att.y-boid.y, att.x-boid.x);
                closeBoids.push({
                    x: att.x,
                    y: att.y,
                    color: boid.color,
                    multiplier: closeBoids.length,
                    ornt: ort,
                    attID: boid.attID,
                });
            }
            boid.followBoids(closeBoids, deltaTime);
        }
        // Finish the update by updating the position!
        for (let i = 0; i < this.boids.length; i++){
            this.boids[i].updatePosition(deltaTime);
            let boid = this.boids[i];
            // There's a possibility that the boid will change attractors.
            let atts = []
            for (let j = 0; j < this.attractors.length; j++){
                let att = this.attractors[j];
                let dist = Math.sqrt(Math.pow(att.x-boid.x,2)+Math.pow(att.y-boid.y,2));
                if (dist < att_NEARBY) atts.push(j);
            }
            // Let boids leave attractors if it gets too uncomfortable.
            let changeAtt = 0.0005+(0.9*boid.chooseNew);
            if (Math.random() < 0.01 && atts.length > 0){
                boid.attID = atts[Math.floor(Math.random()*atts.length)];
            } else if (Math.random() < changeAtt && this.attractors.length > 0){
                boid.attID = Math.floor(Math.random()*this.attractors.length);
            }
        }
    }

    draw(){
        // Draw the background first.
        let cColor = draw_night ? 0 : 0.92;
        gl.clearColor(cColor, cColor, cColor, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Next, draw the attractors if necessary.
        if (draw_attractors){
            let att_color = draw_night ? 0.2 : 1;
            let pointsX = [];
            let colorX = [];
            for (let i = 0; i < this.attractors.length; i++){
                let att = this.attractors[i];
                pointsX = pointsX.concat([att.x, att.y]);
                colorX = colorX.concat([att_color, att_color, att_color, 1]);
            }
            gl_draw(pointsX, colorX, gl.POINTS, 8);
        }
        // Now, draw the boids!
        let pointCol = draw_night ? 1 : 0;
        let brightness =  (draw_night ? 0.2 : 0)*(draw_points ? 1 : 1.10);
        // Draw all the points first if necessary.
        if (draw_points){
            let pointsX = [];
            let colorX = [];
            for (let i = 0; i < this.boids.length; i++){
                let boid = this.boids[i];
                pointsX = pointsX.concat([boid.x, boid.y]);
                if (boid.color == 0){
                    colorX = colorX.concat([pointCol, pointCol, pointCol, 1]);
                } else {
                    colorX = colorX.concat([boid.color == 1? 1 : 0, 0, boid.color == 2? 1 : 0, 1]);
                }
            }
            gl_draw(pointsX, colorX, gl.POINTS, 1.5);
        }
        // Draw the lines now.
        let linesX = [];
        let colorX = [];
        let aMult = (draw_night ? 1.25 : 1)*(draw_points ? 1 : 1.5);
        for (let i = 0; i < this.boids.length; i++){
            let boid = this.boids[i];
            for (let j = 0; j < this.adjBoids[i].length; j++){
                if (Math.random() > 0.01) continue;
                let adjBoid = this.boids[this.adjBoids[i][j][0]];
                let aDist = this.adjBoids[i][j][1];
                linesX = linesX.concat([boid.x, boid.y, adjBoid.x, adjBoid.y]);
                let alpha = aMult*(flock_NEARBY-aDist)/flock_NEARBY;
                let colors = [
                    [pointCol, pointCol, pointCol, alpha],
                    [1, brightness, brightness, alpha],
                    [brightness, brightness, 1, alpha]
                ];
                colorX = colorX.concat(colors[boid.color]);
                colorX = colorX.concat(colors[adjBoid.color]);
            }
        }
        gl_draw(linesX, colorX, gl.LINES, 1.5);
        gl.flush();
    }
}

let gl_draw = (positionArr, colorArr, type, pointSize) => {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    if (positionArr.length == 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionArr), gl.STREAM_DRAW);
    let pts = gl.getAttribLocation(shader, "pointPos");
    gl.enableVertexAttribArray(pts);
    gl.vertexAttribPointer(pts, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArr), gl.STREAM_DRAW);
    let col = gl.getAttribLocation(shader, "color");
    gl.enableVertexAttribArray(col);
    gl.vertexAttribPointer(col, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(shader, "pointSize"), pointSize);
    gl.drawArrays(type, 0, positionArr.length/2);
    gl.disableVertexAttribArray(pts);
    gl.disableVertexAttribArray(col);
}

let loop = (timestamp) => {
    if (start_time != undefined){
        // Deltatime is in seconds.
        let deltaTime = (timestamp-start_time)/1000;
        flock.update(deltaTime);
        flock.draw();
    }
    start_time = timestamp;
    window.requestAnimationFrame(loop);
}

let darkMode = () => {
    document.body.style.backgroundColor = draw_night ? "#EBEBEB" : "#000000"
    document.getElementById("titleText").style.color = draw_night ? "#000000" : "#FFFFFF";
    document.getElementById("controls").style.color = draw_night ? "#000000" : "#FFFFFF";
}

let keyPress = (e) => {
    let char = String.fromCharCode(e.charCode);
    if (char == 'R' || char == 'r'){
        flock_color = !flock_color;
    } else if (char == 'M' || char == 'm'){
        flock_pattern = flock_pattern == -1 ? flock_lPattern : -1;
    } else if (char == 'N' || char == 'n'){
        draw_night = !draw_night;
        darkMode();
    } else if (char == 'A' || char == 'a'){
        draw_attractors = !draw_attractors;
    } else if (char == 'P' || char == 'p'){
        draw_points = !draw_points;
    } else if (/\d/.test(char)){
        flock_pattern = parseInt(char);
    }
}

// With help from https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
let mouseMove = (e) => {
    let rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX-rect.left)*640/rect.width;
    mouseY = (e.clientY-rect.top)*480/rect.height;
}

let resize = (_) => {
    let controls = document.getElementById("controls");
    controls.style.position = "absolute";
    controls.style.left = (window.innerWidth/2-width/2)+"px";
}

webGLSetup();
let flock = new Flock(200);
// Get the text ready.
resize();
darkMode();
window.requestAnimationFrame(loop);
window.addEventListener("keypress", keyPress, false);
window.addEventListener("mousemove", mouseMove, false);
window.addEventListener("resize", resize, false);
