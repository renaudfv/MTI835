THREE = require('three');
var _ = require('underscore');
var SC = require('soundcloud');
// from http://vr.chromeexperiments.com/
var StereoEffect = require('../libs/threejs-vr/StereoEffect.js');
THREE.StereoEffect = StereoEffect;

var ColladaLoader = require('../libs/collada.js');
THREE.ColladaLoader = ColladaLoader;

var PI = Math.PI;

var scene, camera, effect, cursor;
var tracksGroup, trackPlayGroup, curvesGroup;

//WebGL rendering engine
var renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
var maxAnisotropy = renderer.getMaxAnisotropy();

//Used for fullscreen
var container = document.body;
container.appendChild(renderer.domElement);

// Keeps tracks of mouse coordinates, see https://github.com/mrdoob/three.js/blob/master/examples/webgl_interactive_buffergeometry.html
var mouse = new THREE.Vector2();

var raycaster = new THREE.Raycaster();

// Globals for field-of-views
var fovHor = 55;
var fovVer = 40;

var toggleStereo = false;
var toggleTrack = false;

var pickInterval;

ambientLight = new THREE.AmbientLight( 0xffffff, 1 )

// Web audio context
var source;
var context = new ( window.AudioContext || window.webkitAudioContext );
var analyser = context.createAnalyser();
analyser.fftSize = 1024;
var bufferLength = analyser.frequencyBinCount;
var dataArray = new Float32Array(bufferLength);

if(window.chrome) {
    var recognition = new webkitSpeechRecognition();
    recognition.start();
    recognition.stop(); // to toggle permission

    recognition.onspeechend = function() {  
        recognition.stop();
    }

    recognition.onresult = function(event) {
        var voiceResult = event.results[0][0].transcript;
        console.log(voiceResult);
        if(!!voiceResult)
            querySoundcloud(voiceResult);
    }   
}


// Renders and update with browser refresh rate
function render() {
    requestAnimationFrame( render );

    if(!toggleStereo)
        renderer.render( scene, camera );
    else 
        effect.render( scene, camera );

}

// Camera center cursor for VR context
function renderCursor() {
    var geometry = new THREE.CircleGeometry( 40, 100 );
    var mat = new THREE.MeshBasicMaterial( { color: 0xffffff } );
    cursor = new THREE.Mesh( geometry, mat );

    var subGeometry = new THREE.CircleGeometry( 30, 100 );
    var subMat = new THREE.MeshBasicMaterial( { color: 0x000000 } );
    cursor.add(new THREE.Mesh( subGeometry, subMat ));

    cursor.translateZ(-4000);
    scene.add(cursor);
}

function removeCursor() {
    scene.remove(cursor);
}


function renderLimits(group) {
    // Generates a 2D canvas gradient that can be mapped to a texture
    var canvas = document.createElement( 'canvas' );
    canvas.width = 128;
    canvas.height = 128;
    var context = canvas.getContext( '2d' );
    var gradient = context.createLinearGradient( 0, 0, canvas.width * 1.5, 0 );
    gradient.addColorStop( 0, 'rgba(0,0,0,1)' );
    gradient.addColorStop( 1, 'rgba(128,0,0,1)' );
    context.fillStyle = gradient;
    context.fillRect( 0, 0, canvas.width, canvas.height );
    var shadowTexture = new THREE.Texture( canvas );
    shadowTexture.needsUpdate = true;

    // material
    var gradMat = new THREE.MeshBasicMaterial( { map: shadowTexture, transparent: true } );

    //sides
    var gradGeo = new THREE.PlaneGeometry( 1000, window.innerHeight * 200);

    //top/bottom
    // var gradGfeo = new THREE.PlaneGeometry( 500, 500 );

    // mesh
    var lMesh = new THREE.Mesh( gradGeo, gradMat );
    lMesh.rotateY( -145 / 360 * PI );
    lMesh.translateZ(-3000);

    var rMesh = new THREE.Mesh(gradGeo , gradMat );

    rMesh.rotateY( 145 / 360 * PI );
    rMesh.translateZ(-3000);
    rMesh.rotateZ(PI); 

    var topMesh = new THREE.Mesh(gradGeo , gradMat );

    topMesh.rotateX( 90 / 360 * PI );
    topMesh.translateZ(-3000);
    topMesh.rotateZ(PI/2); 

    var bottomMesh = new THREE.Mesh(gradGeo , gradMat );

    bottomMesh.rotateX( -100 / 360 * PI );
    bottomMesh.translateZ(-3000);
    bottomMesh.rotateZ(-PI/2); 

    group.add( lMesh );
    group.add( rMesh );
    group.add( topMesh );
    group.add( bottomMesh );
}

function renderHome(tracks) {
    toggleTrack = false;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1.0, 10000.0 );

    scene.add(ambientLight);

    var lightInter = setInterval(function() {
        if(ambientLight.intensity  <= 1) {
            ambientLight.intensity += 0.075;
        } else {
            clearInterval(lightInter);
        }
    }, 33);

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    //Navigation icons
    var backTexture = loader.load('files/back.png');
    backTexture.minFilter = THREE.LinearFilter;
    backTexture.magFilter = THREE.LinearMipMapLinearFilter;
    backTexture.anisotropy = renderer.getMaxAnisotropy();
    var back = new THREE.Mesh( new THREE.PlaneGeometry( 500, 500 ), 
        new THREE.MeshPhongMaterial( { map: backTexture } ));
    back.isBack = true; // to handle actions

    var searchTexture = loader.load('files/microphone.png');
    searchTexture.minFilter = THREE.LinearFilter;
    searchTexture.magFilter = THREE.LinearMipMapLinearFilter;
    searchTexture.anisotropy = maxAnisotropy;
    var search = new THREE.Mesh( new THREE.PlaneGeometry( 364, 500 ), 
        new THREE.MeshPhongMaterial( { map: searchTexture } ));
    search.isSearch = true; // to handle actions

    back.rotateY(25 / 360 * PI);
    back.rotateX(-75 / 360 * PI);
    back.translateZ(-3000);

    search.rotateY(-25 / 360 * PI);
    search.rotateX(-75 / 360 * PI);
    search.translateZ(-3000);

    tracksGroup = new THREE.Object3D();

    tracksGroup.add(back);

    if(!!window.chrome)
        tracksGroup.add(search);

    renderLimits(tracksGroup);

    scene.add( tracksGroup );

    var track;
    // 3 rows
    for(var y = 0; y < 3; y++) {

        // 5 columns
        for(var x = 0; x < 5; x++) {
            track = tracks[x + y];

            // Load track image or avatar url if none
            imageUrl = ( !!track.artwork_url ) ? track.artwork_url : track.user.avatar_url;
            texture = loader.load( imageUrl );
            texture.minFilter = THREE.LinearFilter;
            texture.anisotropy = maxAnisotropy;

            material = new THREE.MeshPhongMaterial( { map: texture } );
            // material.side(THREE.DoubleSide);

            geometry = new THREE.PlaneGeometry( 500, 500 );
            mesh = new THREE.Mesh( geometry, material );
            
            // Post multiplication, meaning z translate is done first
            mesh.rotateY( (x - 2) * fovHor / 360 * PI ); // from -55 to 55 deg to rads
            mesh.rotateX( (y - 1) * fovVer / 360 * PI ); // from -10 to 10 deg to rads
            mesh.translateZ( -3000 );
            
            tracksGroup.add( mesh );

            mesh.track = track; // to access upon raycast
        }

    }

    render();
    window.addEventListener("mousemove", onMouseMoveHome); 
    window.addEventListener('deviceorientation', handleOrientation);
} 

function renderTrack(track) {
    toggleTrack =true;

    // Track scene rendering
    scene = new THREE.Scene();

    scene.add( ambientLight );

    var lightIndex = 1;

    var lightInter = setInterval(function() {
        console.log('IN Ligh')
        if(lightIndex <= 1) {
            ambientLight.intensity = lightIndex;
        } else {
            clearInterval(lightInter);
        }
        lightIndex += 0.075;
    }, 33);

    if(!camera)
        camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    imageUrl = ( !!track.artwork_url ) ? track.artwork_url : track.user.avatar_url;
    texture = loader.load( imageUrl );

    //Navigation icons
    var back = new THREE.Mesh( new THREE.PlaneGeometry( 500, 500 ), 
        new THREE.MeshPhongMaterial( { map: loader.load('files/back.png') } ));
    back.isBack = true; // to handle actions
    var search = new THREE.Mesh( new THREE.PlaneGeometry( 364, 500 ), 
        new THREE.MeshPhongMaterial( { map: loader.load('files/microphone.png') } ));
    search.isSearch = true; // to handle actions

    back.rotateY(25 / 360 * PI);
    back.rotateX(75 / 360 * PI);
    back.translateZ(-3000);

    search.rotateY(-25 / 360 * PI);
    search.rotateX(75 / 360 * PI);
    search.translateZ(-3000);

    curvesGroup = new THREE.Object3D();
    curvesGroup.translateY(2500);
    curvesGroup.translateZ(-5000);

    trackPlayGroup = new THREE.Object3D();

    trackPlayGroup.add( back );
    trackPlayGroup.add( curvesGroup );

    if(!!window.chrome)
        trackPlayGroup.add(search);

    generate3dModels(track.tag_list);

    scene.remove( tracksGroup );
    scene.add( trackPlayGroup );

    url = track.stream_url + '?client_id=c1da0911d3af90cfd3153d5c6d030137';

    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    // Decode asynchronously
    request.onload = function() {
        console.log('loading request')
        // DSP should all be done here as JS is asynchronous
        context.decodeAudioData(request.response, function(buffer) {
            if(!!source)
                source.stop();

            source = context.createBufferSource();
            source.buffer = buffer;
            source.connect( analyser );
            analyser.connect( context.destination );
            source.start();

            render();
            drawFrequencyCurve();

        }, function() {
            throw new Error();
        });
    }

    request.send();    
    window.addEventListener("mousemove", onMouseMoveTrack);
    if(toggleStereo) renderCursor();
    window.addEventListener('deviceorientation', handleOrientation);
}

/**
* Adds 3d models to scene depending on local 3d models and tracks tags content
*/
function generate3dModels(tags) {
    var trackTags = tags.toLowerCase();

    var tagModels = [
    {'tag':'synthesiser', 'file': 'files/synth.dae'},
    {'tag': 'piano', 'file': 'files/piano.dae'},
    {'tag': 'electronic', 'file': 'files/computer.dae'}
    ];

    var loader = new THREE.ColladaLoader();

    tagModels.forEach(function(tag) {
        //if track containes tag, load 3d model
        if( trackTags.search(tag.tag) != -1) {
            loader.load(tag.file, function ( collada ) {

                if(tag.tag == 'synthesiser')
                    collada.scene.position.z = -200;
                else
                    collada.scene.position.z = -10;

                collada.scene.position.x = Math.random() * 30 - 15; 
                collada.scene.position.y = 3;
                var directionalLight = new THREE.DirectionalLight( 0xcccccc, 0.6 );
                directionalLight.position.set( 0, 10, 0);
                directionalLight.position.normalize();
                collada.scene.add(directionalLight);
                collada.scene.rotateX(Math.PI/4 );
                collada.scene.rotateY(Math.PI/4 * Math.random());

                trackPlayGroup.add( collada.scene );
            }, function ( xhr ) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
            });
        }
    });

    
}

var splineObject, points;
var curveIndex = 0;
function drawFrequencyCurve() {
    requestAnimationFrame( drawFrequencyCurve );

    // if(!!splineObject)
    //     trackPlayGroup.remove(splineObject);

    analyser.getFloatFrequencyData(dataArray);
    points = [bufferLength];

    for(var i = 0; i < bufferLength; i++) {
        points[i] = new THREE.Vector3(i * 20, 3000 * dataArray[i] / (analyser.maxDecibels - analyser.minDecibels), -5000 - 80 * curveIndex);
    }

    var curve = new THREE.CatmullRomCurve3(points);

    geometry = new THREE.Geometry();
    geometry.vertices = curve.getPoints( bufferLength);

    var material = new THREE.LineBasicMaterial( { color : (0xf0f0f0 - curveIndex - Math.random() * 2) } );

    //Create the final Object3d to add to the scene
    splineObject = new THREE.Line( geometry, material );

    splineObject.translateX(-20 * bufferLength / 3);
    curvesGroup.add(splineObject);
    curvesGroup.translateZ(80);
    curveIndex++;

    // Removes need to animate non visible curves, critical performance wise
    if(curveIndex > 200) {
        curvesGroup.remove(curvesGroup.children.shift());
    } 
}


var cursorAnimationInterval;
var animationIndex = 1;
var previousObject;

var track;

function animateToAction(mesh) {

    animationIndex += 0.05;
    cursor.position.z = -2000 * 1 / animationIndex;
    cursor.material.opacity = 1 / (animationIndex + 0.5);

    mesh.translateZ(-10);
    console.log('Animate to play')
    console.log(animationIndex);
    if(animationIndex > Math.round(7))  {
        console.log('PLAY')
        cancelAnimationFrame( cursorAnimationInterval );
        animationIndex = 1;
        var lightIndex = 1;
        clearInterval(pickInterval);

        var lightInter = setInterval(function() {
            if(lightIndex > 0) {
                ambientLight.intensity = lightIndex;
            } else {
                clearInterval(lightInter);

                if(!!mesh.track && !toggleTrack) {
                    renderTrack(mesh.track);
                } else {
                    // is navigation action
                    if(mesh.isBack) 
                        querySoundcloud('erased tapes');
                }
                pickInterval = setInterval(pickOnMove, 100);

            }
            lightIndex -= 0.075;
        }, 33);

        if(mesh.isSearch)
            recognition.start();
    }
    cursorAnimationInterval = requestAnimationFrame(function() {animateToAction(mesh)});
}

function pickOnMove() {
    raycaster.setFromCamera( new THREE.Vector2(0, 0), camera );
    if(toggleTrack) 
        var intersects = raycaster.intersectObject( trackPlayGroup, true ); // true makes it recursive
    else
        var intersects = raycaster.intersectObject( tracksGroup, true ); // true makes it recursive
    
    if(intersects.length > 0) {
        var mesh = intersects[0].object;

        if(!!mesh.track || mesh.isSearch || mesh.isBack) {
            if(mesh != previousObject) {

                cursor.position.z = -2000;
                cursor.material.transparent = true;
                cursor.material.opacity = 1;

                cursorAnimationInterval = requestAnimationFrame(function(){animateToAction(mesh)});
                previousObject = mesh;
            } 

            
        } else {

            cancelAnimationFrame( cursorAnimationInterval );

            //Restore everything
            if(!!previousObject) {
                previousObject.translateZ( (animationIndex - 1) / 0.05 * 10 );
            }

            animationIndex = 1;
            cursor.material.opacity = 1;
            cursor.position.z = -4000;
            previousObject = undefined; 
        }

    } else {
        cancelAnimationFrame( cursorAnimationInterval );

        //Restore everything
        if(!!previousObject) {
            previousObject.translateZ( (animationIndex - 1) / 0.05 * 10 );
        }

        animationIndex = 1;
        cursor.material.opacity = 1;
        cursor.position.z = -4000;
        previousObject = undefined; 
    }
}

window.addEventListener( 'resize', windowResize);

function windowResize(){
    //set aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //set render size
    renderer.setSize( window.innerWidth, window.innerHeight );
    if(effect)
        effect.setSize( window.innerWidth, window.innerHeight );
}

// Should only be called in home
var mouseScreenRatioY = 0, mouseScreenRatioX = 0, offset = 0;
function onMouseMoveHome(event) {

    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    
    // Rotate tracksGroup as if camera follows cursor
    if(!!tracksGroup) {

        // /vert mouse X position between -PI/3 and PI/3 for horizontal rotation (120˚ FOV) 
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.y =  mouseScreenRatioY * (1 * (fovHor + offset)) / 360 * PI;
        
        // Convert mouse Y position between -PI/2 and PI/2 for vertical rotation (90˚ FOV)
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.x =  mouseScreenRatioX * (1 * (fovVer + offset)) / 360 * PI;

    }

    // Update mouse coordinates
    mouse.x = mouseScreenRatioY;
    mouse.y = - mouseScreenRatioX;

}

function onMouseMoveTrack(event) {
    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    
    trackPlayGroup.rotation.y =  mouseScreenRatioY * (2 * (fovHor + offset)) / 360 * PI;

    trackPlayGroup.rotation.x =  mouseScreenRatioX * (2 * (fovVer + offset)) / 360 * PI;

    // Update mouse coordinates
    mouse.x = mouseScreenRatioY;
    mouse.y = - mouseScreenRatioX;

}

window.addEventListener("click", function() {

    raycaster.setFromCamera( mouse, camera );

    if(toggleTrack) 
        var intersects = raycaster.intersectObject( trackPlayGroup, true ); // true makes it recursive
    else
        var intersects = raycaster.intersectObject( tracksGroup, true ); // true makes it recursive

    if(intersects.length > 0) {

        var mesh = intersects[0].object;

        var lightIndex = 1;

        var lightInter = setInterval(function() {
            if(lightIndex > 0) {
                ambientLight.intensity = lightIndex;
            } else {
                clearInterval(lightInter);
                if(!!mesh.track && !toggleTrack) {
                    var track = mesh.track;

                    renderTrack(track);

                } else {
                    // is navigation action
                    if(mesh.isBack) 
                        querySoundcloud('erased tapes');
                }
            }
            lightIndex -= 0.075;
        }, 33);

        if(mesh.isSearch)
            recognition.start();

    }

});

function toggleStereoF() {
    console.log('make it stereo');
    if(!toggleStereo) {

        toggleStereo = true;

        if(!effect)
            effect = new THREE.StereoEffect( renderer );

        effect.setSize( window.innerWidth, window.innerHeight );

        //Hide mouse
        document.getElementsByTagName('canvas')[0].style.cursor = 'none';
        
        renderCursor();

        requestFullscreen();
        screen.orientation.lock('landscape-secondary'); // needs to be fullscreen first

        render();   

        setTimeout(function() {
            pickInterval = setInterval(pickOnMove, 100);

        }, 100);

    } else {
        toggleStereo = false;
        
        renderer.setSize( window.innerWidth, window.innerHeight );
        
        //Show mouse
        document.getElementsByTagName('canvas')[0].style.cursor = 'auto';

        removeCursor();

        exitFullscreen();

        render();

        clearInterval(pickInterval);
    }
}

document.getElementById('c-logo').addEventListener("click", toggleStereoF);

function requestFullscreen() {
    if (container.requestFullscreen) {
        container.requestFullscreen();
    } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
    } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.cancelFullscreen) {
        document.cancelFullscreen();
    } else if (document.msCancelFullscreen) {
        document.msCancelFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
    }
}

function getOrientation() {
    switch (window.screen.orientation || window.screen.mozOrientation) {
      case 'landscape-primary':
      return 90;
      case 'landscape-secondary':
      return -90;
      case 'portrait-secondary':
      return 180;
      case 'portrait-primary':
      return 0;
  }
    // this returns 90 if width is greater then height
    // and window orientation is undefined OR 0
    // if (!window.orientation && window.innerWidth > window.innerHeight)
    //   return 90;
    return window.orientation || 0;
}

/**
* Shiting and rotation are made accordingly to device orientation
* Rotation direction inverted and Z rot as gamma passes from 0 to PI on horizon
*/
function setGroupOrientation(event, group) {
    var alpha    = THREE.Math.degToRad(event.alpha); // y
    var gamma    = THREE.Math.degToRad(event.gamma); // x
    var beta = THREE.Math.degToRad(event.beta); // z

    // must invert directions and handle orientation inversion on high sight
    group.rotation.z = (gamma < 0) ? beta + PI : -beta;
    group.rotation.y = (gamma < 0) ? (-alpha-PI) : (-alpha);
    group.rotation.x = (gamma < 0) ? -gamma-PI/2 : -gamma+PI/2;

}

//Called on change
function handleOrientation(event) {

    if(!!trackPlayGroup && toggleTrack && mobilecheck()) {
        setGroupOrientation(event, trackPlayGroup);
    }
    if(!!tracksGroup && !toggleTrack && mobilecheck())   {
        setGroupOrientation(event, tracksGroup);
    } 

}

// Displays home with SC results
function querySoundcloud(query) {
    //Ask for more tracks just in cas SC sends less
    SC.get('/tracks', {
        q: query,
        limit: 20
    }).then(function(tracks){

        renderHome(tracks);

        if(!!source) source.stop();
        if(toggleStereo) renderCursor();

    });
}

//http://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
window.mobilecheck = function() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
}


document.body.addEventListener("click", function() {

    if(mobilecheck()) {
        console.log('shouldbe mobile')
        toggleStereoF();
    }

});

// Will call every setup funcitno
document.addEventListener("DOMContentLoaded", function() {

    // Initialize Soundcloud API
    SC.initialize({
        client_id: 'c1da0911d3af90cfd3153d5c6d030137'
    });

    //Renderer setup, should be valid for the whole scope context
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement ); 

    querySoundcloud('erased tapes');

});