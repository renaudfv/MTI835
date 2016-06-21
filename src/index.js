var THREE = require('three');
var _ = require('underscore');

var PI = Math.PI;

var scene, camera, ambientLight;

var renderer = new THREE.WebGLRenderer( { antialias: true } );
trackPlayer = undefined;

// Renders and update with browser refresh rate
function render() {
    requestAnimationFrame( render );
    renderer.render( scene, camera );
}

function renderHome(tracks) {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    // camera.position.z = 0;
    camera.rotation.Z = Math.PI/6;
    
    var tracksGroup = new THREE.Object3D();
    scene.add( tracksGroup );


    // ambientLight = new THREE.AmbientLight(0xbbbbbb);
    // scene.add(ambientLight);

    // geometry = new THREE.BoxGeometry( 500, 500, 1 );
    // material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );

    // mesh = new THREE.Mesh( geometry, material );
    // scene.add( mesh );

    var imageUrl = '';
    var geometry, mesh, material, texture;

    var loader = new THREE.TextureLoader();

    _.each(tracks, function(track) {

        // Load track image or avatar url if none
        imageUrl = ( !!track.artwork_url ) ? track.artwork_url : track.user.avatar_url;
        texture = loader.load( imageUrl );
        console.log(texture)

        material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );

        geometry = new THREE.PlaneGeometry( 500, 500 );
        mesh = new THREE.Mesh( geometry, material );

        tracksGroup.add( mesh )
        
        // loader.load( imageUrl, function ( texture ) {
        //     console.log(texture)
        //     // do something with the texture
        //     material = new THREE.MeshBasicMaterial( {
        //         map: texture
        //     } );

        //     geometry = new THREE.PlaneGeometry( 500, 500 );
        //     mesh = new THREE.Mesh( geometry, material );

        //     tracksGroup.add( mesh );

        // }, function ( xhr ) {
        //     //Loading
        //     console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );

        // }, function ( xhr ) {
        //     // Error
        //     console.log( 'An error happened' );

        // } );

    });

    tracksGroup.translateZ(-3000);
    tracksGroup.lookAt(camera.position);
    render();
} 

function renderTrack() {

    // Track scene rendering

}

window.addEventListener( 'resize', windowResize);

function windowResize(){
    //set aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //set render size
    renderer.setSize( window.innerWidth, window.innerHeight );
}

window.addEventListener("mousemove", rotateCamera); 

var mouseScreenRatioY = 0, mouseScreenRatioX = 0;

function rotateCamera(event) {

    // Convert mouse X position between -PI/3 and PI/3 for horizontal rotation (120˚ FOV) 
    // has been optimized/factorized from prevision, formula might seem odd
    mouseScreenRatioY = 2 * event.clientX / window.innerWidth - 1; 
    camera.rotation.y = - mouseScreenRatioY * PI / 3;
    
    // Convert mouse Y position between -PI/2 and PI/2 for vertical rotation (90˚ FOV)
    // has been optimized/factorized from prevision, formula might seem odd
    mouseScreenRatioX = 2 * event.clientY / window.innerHeight - 1;
    camera.rotation.x = - mouseScreenRatioX * PI / 2;

}

document.addEventListener("DOMContentLoaded", function() {

    // Initialise Soundcloud API
    SC.initialize({
        client_id: 'c1da0911d3af90cfd3153d5c6d030137'
    });

    //Renderer setup, should be valid for the whole scope context
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement ); 

    SC.get('/tracks', {
        q: 'erased tapes'
    }).then(function(tracks){
        // // SC.stream(tracks[0].uri).then(function(player){
        // //     trackPlayer = player;
        // // });
        renderHome(tracks);
        rotate();
        // STOCKER LES TRACKS et LOADER LA TRACK par HTTP lors de la lecture avec WEB AUDIO API
    });

    // renderHome();
});