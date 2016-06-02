var THREE = require('three');

var scene, camera;
var geometry, material, mesh;

var renderer = new THREE.WebGLRenderer();
trackPlayer = undefined;

function renderHome() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 1000;

    geometry = new THREE.BoxGeometry( 500, 500, 1 );
    material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    // renderer = new THREE.WebGLRenderer();
    // renderer.setSize( window.innerWidth, window.innerHeight );
    // Render once
    // if( !contextRendered ) { 
    //     document.body.appendChild( renderer.domElement ); 
    // }

    renderer.render( scene, camera );
} 
function renderTrack() {

    // Track scene rendering

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
        console.log(tracks);
        // SC.stream(tracks[0].uri).then(function(player){
        //     trackPlayer = player;
        // });
        renderHome();
    });

    // renderHome();
});