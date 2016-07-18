THREE = require('three');
var _ = require('underscore');
var SC = require('soundcloud');
// from http://vr.chromeexperiments.com/
var StereoEffect = require('../libs/threejs-vr/StereoEffect.js');
THREE.StereoEffect = StereoEffect;

var PI = Math.PI;

var scene, camera, tracksGroup, trackPlayGroup, effect, cursor, source;

//WebGL rendering engine
var renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );

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

// Web audio context
var context = new ( window.AudioContext || window.webkitAudioContext );

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

function renderHome(tracks) {
    toggleTrack = false;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );

    console.log(scene)
    
    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    //Navigation icons
    var back = new THREE.Mesh( new THREE.PlaneGeometry( 500, 500 ), 
        new THREE.MeshBasicMaterial( { map: loader.load('back.png') } ));
    back.isBack = true; // to handle actions
    var search = new THREE.Mesh( new THREE.PlaneGeometry( 364, 500 ), 
        new THREE.MeshBasicMaterial( { map: loader.load('microphone.png') } ));
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

            material = new THREE.MeshBasicMaterial( { map: texture } );
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
} 

function renderTrack(track) {
    toggleTrack =true;

    // Track scene rendering
    scene = new THREE.Scene();

    if(!camera)
        camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    imageUrl = ( !!track.artwork_url ) ? track.artwork_url : track.user.avatar_url;
    texture = loader.load( imageUrl );

    // material = new THREE.MeshBasicMaterial( { map: texture } );

    // geometry = new THREE.PlaneGeometry( 500, 500 );
    // mesh = new THREE.Mesh( geometry, material );

    // mesh.translateZ( -3000 );

    //Navigation icons
    var back = new THREE.Mesh( new THREE.PlaneGeometry( 500, 500 ), 
        new THREE.MeshBasicMaterial( { map: loader.load('back.png') } ));
    back.isBack = true; // to handle actions
    var search = new THREE.Mesh( new THREE.PlaneGeometry( 364, 500 ), 
        new THREE.MeshBasicMaterial( { map: loader.load('microphone.png') } ));
    search.isSearch = true; // to handle actions

    back.rotateY(25 / 360 * PI);
    back.rotateX(-75 / 360 * PI);
    back.translateZ(-3000);

    search.rotateY(-25 / 360 * PI);
    search.rotateX(-75 / 360 * PI);
    search.translateZ(-3000);

    trackPlayGroup = new THREE.Object3D();
    trackPlayGroup.add(back);

    if(!!window.chrome)
        trackPlayGroup.add(search);

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
            console.log(buffer);
            source = context.createBufferSource();
            source.buffer = buffer;

            source.connect( context.destination );
            source.start();

            render();
        }, function() {
            throw new Error();
        });
    }

    request.send();    
    window.addEventListener("mousemove", onMouseMoveTrack);
    if(toggleStereo) renderCursor();

    
}

var cursorAnimationInterval;
var animationIndex = 1;
var previousObject;

function pickOnMove() {
    raycaster.setFromCamera( new THREE.Vector2(0, 0), camera );
    if(toggleTrack) 
        var intersects = raycaster.intersectObject( trackPlayGroup, true ); // true makes it recursive
    else
        var intersects = raycaster.intersectObject( tracksGroup, true ); // true makes it recursive
    
    if(intersects.length > 0) {
        var mesh = intersects[0].object;
        
        var track = mesh.track;
        clearInterval( cursorAnimationInterval );

        previousObject = mesh;

        cursor.position.z = -2000;
        cursor.material.transparent = true;
        cursor.material.opacity = 1;

        cursorAnimationInterval = setInterval(function() {

            animationIndex += 0.05;
            cursor.position.z = -2000 * 1 / animationIndex;
            cursor.material.opacity = 1 / (animationIndex + 0.5);

            mesh.translateZ(-10);

            if(animationIndex > Math.round(6))  {
                clearInterval( cursorAnimationInterval );
                animationIndex = 1;
                if(!!mesh.track && !toggleTrack) {
                    console.log('PLAY TRACK')
                    renderTrack(track);
                } else {
                    // is navigation action
                    if(mesh.isBack)  
                        querySoundcloud('erased tapes')
                    
                    if(mesh.isSearch)
                        recognition.start();
                }
            }

        }, 30);

        

    } else {
        clearInterval( cursorAnimationInterval );

        //Restore everything
        if(!!previousObject)
            previousObject.translateZ( (animationIndex - 1) / 0.05 * 10 );

        animationIndex = 1;
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
var mouseScreenRatioY = 0, mouseScreenRatioX = 0, offset = 10;
function onMouseMoveHome(event) {

    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    
    // Rotate tracksGroup as if camera follows cursor
    if(!!tracksGroup) {

        // /vert mouse X position between -PI/3 and PI/3 for horizontal rotation (120˚ FOV) 
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.y =  mouseScreenRatioY * (2 * (fovHor + offset)) / 360 * PI;
        
        // Convert mouse Y position between -PI/2 and PI/2 for vertical rotation (90˚ FOV)
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.x =  mouseScreenRatioX * (2 * (fovVer + offset)) / 360 * PI;

    }

    // Update mouse coordinates
    mouse.x = mouseScreenRatioY;
    mouse.y = - mouseScreenRatioX;

    if(toggleStereo)
        pickOnMove();

}

function onMouseMoveTrack(event) {
    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    
    trackPlayGroup.rotation.y =  mouseScreenRatioY * (2 * (fovHor + offset)) / 360 * PI;

    trackPlayGroup.rotation.x =  mouseScreenRatioX * (2 * (fovVer + offset)) / 360 * PI;

    // Update mouse coordinates
    mouse.x = mouseScreenRatioY;
    mouse.y = - mouseScreenRatioX;

    if(toggleStereo)
        pickOnMove();
}

window.addEventListener("click", function() {

    raycaster.setFromCamera( mouse, camera );

    if(toggleTrack) 
        var intersects = raycaster.intersectObject( trackPlayGroup, true ); // true makes it recursive
    else
        var intersects = raycaster.intersectObject( tracksGroup, true ); // true makes it recursive

    if(intersects.length > 0) {

        var mesh = intersects[0].object;

        if(!!mesh.track && !toggleTrack) {
            var track = mesh.track;

            renderTrack( track );
        } else {
            // is navigation action
            if(mesh.isBack) 
                querySoundcloud('erased tapes');

            if(mesh.isSearch)
                recognition.start();
        }

    }

});

document.getElementById('c-logo').addEventListener("click", function() {
    console.log('make it stereo');
    if(!toggleStereo) {

        if(!effect)
            effect = new THREE.StereoEffect( renderer );

        effect.setSize( window.innerWidth, window.innerHeight );

        //Hide mouse
        document.getElementsByTagName('canvas')[0].style.cursor = 'none';
        
        renderCursor();

        requestFullscreen();

        toggleStereo = true;

        render();

    } else {

        renderer.setSize( window.innerWidth, window.innerHeight );
        
        //Show mouse
        document.getElementsByTagName('canvas')[0].style.cursor = 'auto';

        removeCursor();

        exitFullscreen();

        toggleStereo = false;

        render();
    }
});

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

function handleOrientation(event) {
    var absolute = event.absolute;
    var alpha    = event.alpha; // Z
    var beta     = event.beta; // X
    var gamma    = event.gamma; // Y

    if(toggleTrack) 
        trackPlayGroup.rotation = new THREE.Vector3(beta, gamma, alpha);
    else    
        tracksGroup.rotation = new THREE.Vector3(beta, gamma, alpha);

}

window.addEventListener('deviceorientation', handleOrientation);

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