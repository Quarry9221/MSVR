'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let A = 0.3;
let B = 0.3;
let C = 0.15;
let webCameraTexture;
let video;
let webCamera;
let audioManager;

let isFilterOn = false;
let isMovingSphere = false;

let sphere;
let sphereCenter = { x: 0, y: 0, z: 0 };


let texture;
const { cos, sin, sqrt, pow, PI, tan } = Math

class AudioManager {
    constructor() {
        this.audio = document.getElementById("audio");
        this.audioContext = null;
        this.audioSource = null;
        this.panner = null;
        this.audioFilter = null;
        this.isFilterOn = false;

        this.initAudio();
    }

    initAudio() {
        this.audio.addEventListener("pause", () => {
            if (this.audioContext) {
                this.audioContext.suspend();
            }
        });

        this.audio.addEventListener("play", () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioSource = this.audioContext.createMediaElementSource(this.audio);

                this.panner = this.audioContext.createPanner();
                this.panner.panningModel = "HRTF";
                this.panner.distanceModel = "linear";
                
                this.audioSource.connect(this.panner);
                this.panner.connect(this.audioContext.destination);

                this.getFilter();
            }
            this.audioContext.resume();
        });
    }
    getFilter() {
        if (!this.audioFilter) {
            this.audioFilter = this.audioContext.createBiquadFilter();
            this.audioFilter.type = 'lowpass';
            this.audioFilter.frequency.value = 1000;
            this.audioFilter.Q.value = 0.6;
        }

        this.audioFilter.Q.value = document.getElementById("q").value;

        const isFilterOn = document.getElementById("isFilterOn");

        isFilterOn.addEventListener("change", () => {
            if (isFilterOn.checked) {
                this.panner.disconnect();
                this.panner.connect(this.audioFilter);
                this.audioFilter.connect(this.audioContext.destination);
            } else {
                this.panner.disconnect();
                this.panner.connect(this.audioContext.destination);
            }
        });
    }
}



// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextCoordBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, texturesList) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);


        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texturesList), gl.STREAM_DRAW);
        

        this.count = vertices.length/3;
    }

    this.BufferDataSphere = function (vertices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTextCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTextCoord);
   
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
    this.DrawSphere = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}




// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribTextCoord = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.

    this.iModelViewProjectionMatrix = -1;

    this.iProjectionMatrix = -1;

    this.iTMU = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}


class StereoCamera {
    constructor(eyeSeparation, convergence, aspectRatio, fov, near, far = 50.0) {
        this.eyeSeparation = eyeSeparation;
        this.convergence = convergence;
        this.aspectRatio = aspectRatio;
        this.fov = fov;
        this.near = near;
        this.far = far;
        this.ProjectionMatrix = m4.identity();
        this.ModelViewMatrix = m4.identity();
    }

    getLeftFrustum() {
        let top, bottom, left, right;

        top = this.near * tan(this.fov / 2);
        bottom = -top;

        const a = this.aspectRatio * tan(this.fov / 2) * this.convergence;
        const b = a - this.eyeSeparation / 2;
        const c = a + this.eyeSeparation / 2;



        left = -b * this.near / this.convergence;
        right = c * this.near / this.convergence;

        this.ProjectionMatrix = m4.frustum(left, right, bottom, top,
            this.near, this.far);
        this.ModelViewMatrix = m4.translation(-this.eyeSeparation / 2, 0.0, 0.0);
    }

    getRightFrustum() {
        let top, bottom, left, right;

        top = this.near * tan(this.fov / 2);
        bottom = -top;

        const a = this.aspectRatio * tan(this.fov / 2) * this.convergence;
        const b = a - this.eyeSeparation / 2;
        const c = a + this.eyeSeparation / 2;

        right = b * this.near / this.convergence;
        left = -c * this.near / this.convergence;


        this.ProjectionMatrix = m4.frustum(left, right, bottom, top,
            this.near, this.far);
        this.ModelViewMatrix = m4.translation(-this.eyeSeparation / 2, 0.0, 0.0);
    }
}





function draw() { 
    gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);
    
    /* Get the view matrix from the SimpleRotator object.*/

    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0);
    let translateToPointZero = m4.translation(0, 0, -10);

    
    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    let constRotation = m4.multiply(rotateToPointZero, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    let stereoCamera = new StereoCamera(
        parseFloat(document.getElementById("eyeSeparation").value),
        parseFloat(document.getElementById("convergence").value),
        gl.canvas.width / gl.canvas.height,
        parseFloat(document.getElementById("fov").value),
        parseFloat(document.getElementById("near").value)
    );
    moveLight(audioManager,Date.now() * 0.001);

    

    gl.uniform1i(shProgram.iTMU, 0);


    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    let modelViewProjection = m4.multiply(projection, matAccum1);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, constRotation);
    gl.bindTexture(gl.TEXTURE_2D, webCameraTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    webCamera.Draw();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    stereoCamera.getLeftFrustum();
    modelViewProjection = m4.multiply(stereoCamera.ProjectionMatrix, m4.multiply(stereoCamera.ModelViewMatrix, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(true, false, false, false);
    surface.Draw();
    


    gl.clear(gl.DEPTH_BUFFER_BIT);

    
    stereoCamera.getRightFrustum();
    modelViewProjection = m4.multiply(stereoCamera.ProjectionMatrix, m4.multiply(stereoCamera.ModelViewMatrix, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    gl.uniform1i(shProgram.iSphereColor, true);
    sphere.DrawSphere();
    gl.uniform1i(shProgram.iSphereColor, false);
    surface.Draw();



    gl.colorMask(true, true, true, true);

}

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function processSurfaceEquations(A,B,C, u, v) {

    const x = A * u * Math.sin(u) * Math.cos(v);
    const y = B * u * Math.cos(u) * Math.cos(v);
    const z = -C * u * Math.sin(v);
    return { x, y, z };

}

function CreateSurfaceData(A,B,C) {
    let vertexList = [];
    let textureList = [];
    let step = 0.01;

    // 0 <= u <= 2PI, -PI <= v <= PI
    const uMax = 2 * Math.PI;
    const vMin = -Math.PI;
    const vMax = Math.PI;

    for (let u = 0; u <= uMax; u += step) {
        for (let v = vMin; v <= vMax; v += step) {

            let v1 = processSurfaceEquations(A, B, C, u, v);
            let v2 = processSurfaceEquations(A, B, C, u, v + step);
            let v3 = processSurfaceEquations(A, B, C, u + step, v);
            let v4 = processSurfaceEquations(A, B, C, u + step, v + step);
            
            vertexList.push(v1.x, v1.y, v1.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v3.x, v3.y, v3.z);
            
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v4.x, v4.y, v4.z);
            vertexList.push(v3.x, v3.y, v3.z);

            let uCoord = u / uMax;
            let uCoordStep = (u + step) / uMax;
            let vCoord = (v - vMin) / (vMax - vMin);
            let vCoordStep = (v + step - vMin) / (vMax - vMin);

            textureList.push(uCoord, vCoord);
            textureList.push(uCoord, vCoordStep);
            textureList.push(uCoordStep, vCoord);
            
            textureList.push(uCoord, vCoordStep);
            textureList.push(uCoordStep, vCoordStep);
            textureList.push(uCoordStep, vCoord);
        }
    }

    return { vertices: vertexList, texturesList: textureList };
}
function updateSurface() {
    A = parseFloat(document.getElementById("A").value);
    B = parseFloat(document.getElementById("B").value);
    C = parseFloat(document.getElementById("C").value);
    let data = CreateSurfaceData(A,B,C);
    surface.BufferData(data.vertices, data.texturesList);
    draw();

}

function updateCamera() {
    draw();
    window.requestAnimationFrame(updateCamera);
}

function LoadTexture() {

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "https://i.ibb.co/TKM7Mt1/lol.jpg";
    image.addEventListener('load', () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        draw();
    }
    );
}


function getCameraTexture()
{
    webCameraTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webCameraTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}


function createSphereData() {
    let vertexList = [];
    let step = 0.05;
  
    for (let phi = 0; phi <= Math.PI; phi += step) {
      for (let theta = 0; theta <= 2 * Math.PI; theta += step) {

        let v1 = equationsSphere(phi, theta);
        let v2 = equationsSphere(phi, theta + step);
        let v3 = equationsSphere(phi + step, theta);
        let v4 = equationsSphere(phi + step, theta + step);

        vertexList.push(v1.x, v1.y, v1.z);
        vertexList.push(v2.x, v2.y, v2.z);
        vertexList.push(v3.x, v3.y, v3.z);
        
        vertexList.push(v2.x, v2.y, v2.z);
        vertexList.push(v4.x, v4.y, v4.z);
        vertexList.push(v3.x, v3.y, v3.z);

      }
    }
  
    return {vertices: vertexList};
}

function equationsSphere(phi, theta) {
    let radius = 0.25;
    let x = sphereCenter.x + radius * Math.sin(phi) * Math.cos(theta);
    let y = sphereCenter.y + radius * Math.sin(phi) * Math.sin(theta);
    let z = sphereCenter.z + radius * Math.cos(phi);

    return {x, y, z};
}

function moveLight(audioManager,time) {
    if (isMovingSphere.checked == true)
        {


        if (audioManager.panner) {
            
            audioManager.panner.setPosition(
                sphereCenter.x * 0.7,
                sphereCenter.y * 0.7,
                sphereCenter.z
            );
        }
    }
        const center = { x: 0.0, y: 0.0, z: 0.0 }; 
        const radius = 1.5; 
        const speed = 2.0; 
        const angle = time * speed;
        sphereCenter.x = center.x + radius * Math.cos(angle);
        sphereCenter.y = center.y; 
        sphereCenter.z = center.z + radius * Math.sin(time * speed);
        gl.uniform3fv(shProgram.sphereCenter, [sphereCenter.x, sphereCenter.y, sphereCenter.z]);
    
        updateSphereSource();
    }

function updateSphereSource() {
    isMovingSphere = document.getElementById("isMovingSphere");
    if (isMovingSphere.checked == true)
        {
            const sphereSourceData = createSphereData();
            sphere.BufferDataSphere(sphereSourceData.vertices);
        }

}






/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTextCoord           = gl.getAttribLocation(prog, "textCoord");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iTMU                       = gl.getUniformLocation(prog, "tmu");
    shProgram.iSphereColor                   = gl.getUniformLocation(prog, "sphereColor");

    surface = new Model('Surface');
    let data = CreateSurfaceData(A, B, C);
    surface.BufferData(data.vertices, data.texturesList);

    webCamera = new Model('WebCamera');
    webCamera.BufferData(
        [1, 1, 1, -1, -1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0],
        [0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1]

    );

    sphere = new Model('Sphere');
    let spheredata = createSphereData();
    sphere.BufferDataSphere(spheredata.vertices);

    LoadTexture();
    getCameraTexture();

    gl.enable(gl.DEPTH_TEST);
}


function startVideo() {
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("Error accessing the webcam: " + err);
        });
}








function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}
function init() {
    audioManager = new AudioManager();
    document.getElementById("q").addEventListener("change", () => audioManager.getFilter());
    let canvas;
    startVideo();
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
        

    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
    updateSurface();
    updateCamera();
}

