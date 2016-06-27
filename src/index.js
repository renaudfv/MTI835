var THREE = require('three');
var _ = require('underscore');
var SC = require('soundcloud');

var PI = Math.PI;

var scene, camera, tracksGroup;

var renderer = new THREE.WebGLRenderer( { antialias: true } );

// Keeps tracks of mouse coordinates, see https://github.com/mrdoob/three.js/blob/master/examples/webgl_interactive_buffergeometry.html
var mouse = new THREE.Vector2();

var raycaster = new THREE.Raycaster();

// Globals for field-of-views
var fovHor = 55;
var fovVer = 40;

// Web audio context
var context = new ( window.AudioContext || window.webkitAudioContext );

// Renders and update with browser refresh rate
function render() {
    requestAnimationFrame( render );
    renderer.render( scene, camera );
}

function renderHome(tracks) {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );

    tracksGroup = new THREE.Object3D();
    // tracksGroup.translateZ(-3000);
    // tracksGroup.lookAt( camera.position );
    scene.add( tracksGroup );

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    var track;
    // 5 Columns 
    for(var y = 0; y < 3; y++) {

        // 3 Rows
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
} 

function renderTrack(track) {

    // Track scene rendering

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();
    loader.crossOrigin = true; // otherwise image wont be usable and therefore visible

    imageUrl = ( !!track.artwork_url ) ? track.artwork_url : track.user.avatar_url;
    texture = loader.load( imageUrl );

    material = new THREE.MeshBasicMaterial( { map: texture } );

    geometry = new THREE.PlaneGeometry( 500, 500 );
    mesh = new THREE.Mesh( geometry, material );
            
    mesh.translateZ( -3000 );
    scene.add( mesh );

    var audio = new Audio()

    url = track.stream_url + '?client_id=c1da0911d3af90cfd3153d5c6d030137';

    audio.src = url;
    var source = context.createMediaElementSource(audio);
    
    var gainNode = context.createGain();
    gainNode.gain.value = 1;
    
    source.connect( gainNode );
    gainNode.connect( context.destination );

    audio.play();

    render();
}

window.addEventListener( 'resize', windowResize);

function windowResize(){
    //set aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //set render size
    renderer.setSize( window.innerWidth, window.innerHeight );
}

window.addEventListener("mousemove", onMouseMove); 

var mouseScreenRatioY = 0, mouseScreenRatioX = 0;
function onMouseMove(event) {

    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    
    // Rotate tracksGroup as if camera follows cursor
    if(!!tracksGroup) {

        // /vert mouse X position between -PI/3 and PI/3 for horizontal rotation (120˚ FOV) 
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.y =  mouseScreenRatioY * (2 * fovHor) / 360 * PI;
        
        // Convert mouse Y position between -PI/2 and PI/2 for vertical rotation (90˚ FOV)
        // has been optimized/factorized from prevision, formula might seem odd
        tracksGroup.rotation.x =  mouseScreenRatioX * (fovVer + 10) / 360 * PI;

    }

    // Update mouse coordinates
    mouse.x = mouseScreenRatioY;
    mouse.y = - mouseScreenRatioX;
}

window.addEventListener("click", function() {
    console.log('CLICK');
    
    raycaster.setFromCamera( mouse, camera );
    var intersects = raycaster.intersectObject( tracksGroup, true ); // true makes it recursive

    var mesh = intersects[0].object;
    var track = mesh.track;

    console.log( track );
    renderTrack( track );
});

document.getElementById('c-logo').addEventListener("click", function() {

});

document.addEventListener("DOMContentLoaded", function() {

    // Initialise Soundcloud API
    SC.initialize({
        client_id: 'c1da0911d3af90cfd3153d5c6d030137'
    });

    //Renderer setup, should be valid for the whole scope context
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement ); 

    //Ask for more tracks just in cas SC sends less
    SC.get('/tracks', {
        q: 'erased tapes',
        limit: 20
    }).then(function(tracks){

        renderHome(tracks);
        // STOCKER LES TRACKS et LOADER LA TRACK par HTTP lors de la lecture avec WEB AUDIO API
    });

});