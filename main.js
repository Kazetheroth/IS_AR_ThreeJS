var vrDisplay;
var vrFrameData;
var vrControls;
var arView;

var canvas;
var camera;
var scene;
var renderer;
var cube;
var cubes = [];

var anchorManager;

var CUBE_SIZE_IN_METERS = 0.18;

var colors = [
    new THREE.Color( 0xffffff ),
    new THREE.Color( 0xffff00 ),
    new THREE.Color( 0xff00ff ),
    new THREE.Color( 0xff0000 ),
    new THREE.Color( 0x00ffff ),
    new THREE.Color( 0x00ff00 ),
    new THREE.Color( 0x0000ff ),
    new THREE.Color( 0x000000 )
];

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API
 * to see if there are any AR-capable WebVR VRDisplays. Returns
 * a valid display if found. Otherwise, display the unsupported
 * browser message.
 */
THREE.ARUtils.getARDisplay().then(function (display) {
    if (display) {
        vrFrameData = new VRFrameData();
        vrDisplay = display;
        init();
    } else {
        THREE.ARUtils.displayUnsupportedMessage();
    }
});

function init() {
    // Turn on the debugging panel
    var arDebug = new THREE.ARDebug(vrDisplay);
    document.body.appendChild(arDebug.getElement());

    // Setup the three.js rendering environment
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log('setRenderer size', window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    canvas = renderer.domElement;
    document.body.appendChild(canvas);
    scene = new THREE.Scene();

    // Creating the ARView, which is the object that handles
    // the rendering of the camera stream behind the three.js
    // scene
    arView = new THREE.ARView(vrDisplay, renderer);

    // The ARPerspectiveCamera is very similar to THREE.PerspectiveCamera,
    // except when using an AR-capable browser, the camera uses
    // the projection matrix provided from the device, so that the
    // perspective camera's depth planes and field of view matches
    // the physical camera on the device.
    camera = new THREE.ARPerspectiveCamera(
        vrDisplay,
        60,
        window.innerWidth / window.innerHeight,
        vrDisplay.depthNear,
        vrDisplay.depthFar
    );

    // VRControls is a utility from three.js that applies the device's
    // orientation/position to the perspective camera, keeping our
    // real world and virtual world in sync.
    vrControls = new THREE.VRControls(camera);

    // Create the cube geometry that we'll copy and place in the
    // scene when the user clicks the screen
    var geometry = new THREE.BoxGeometry( 0.05, 0.05, 0.05 );
    var faceIndices = ['a', 'b', 'c'];
    for (var i = 0; i < geometry.faces.length; i++) {
        var f  = geometry.faces[i];
        for (var j = 0; j < 3; j++) {
            var vertexIndex = f[faceIndices[ j ]];
            f.vertexColors[j] = colors[vertexIndex];
        }
    }
    var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });
    cube = new THREE.Mesh(geometry, material);

    // Bind our event handlers
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('touchstart', onClick, false);

    anchorManager = new THREE.ARAnchorManager(vrDisplay);

    // Kick off the render loop!
    update();
}

/**
 * The render loop, called once per frame. Handles updating
 * our scene and rendering.
 */
function update() {
    // Clears color from the frame before rendering the camera (arView) or scene.
    renderer.clearColor();

    // Render the device's camera stream on screen first of all.
    // It allows to get the right pose synchronized with the right frame.
    arView.render();

    // Update our camera projection matrix in the event that
    // the near or far planes have updated
    camera.updateProjectionMatrix();

    // From the WebVR API, populate `vrFrameData` with
    // updated information for the frame
    vrDisplay.getFrameData(vrFrameData);

    // Update our perspective camera's positioning
    vrControls.update();

    // Render our three.js virtual scene
    renderer.clearDepth();
    renderer.render(scene, camera);

    // Kick off the requestAnimationFrame to call this function
    // on the next frame
    requestAnimationFrame(update);
}

/**
 * On window resize, update the perspective camera's aspect ratio,
 * and call `updateProjectionMatrix` so that we can get the latest
 * projection matrix provided from the device
 */
function onWindowResize () {
    console.log('setRenderer size', window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * When clicking on the screen, create a cube at the user's
 * current position.
 */
function onClick (e) {
    // If the user touched with 2 or more fingers, remove the latest model and
    // its anchor.
    if (cubes.length > 0 && e.touches.length > 1) {
        anchorManager.remove(cubes[0]);
        scene.remove(cubes[0]);
        cubes.splice(0, 1);
        return;
    }

    // Fetch the pose data from the current frame
    var pose = vrFrameData.pose;

    // Convert the pose orientation and position into
    // THREE.Quaternion and THREE.Vector3 respectively
    var ori = new THREE.Quaternion(
        pose.orientation[0],
        pose.orientation[1],
        pose.orientation[2],
        pose.orientation[3]
    );

    var pos = new THREE.Vector3(
        pose.position[0],
        pose.position[1],
        pose.position[2]
    );

    var dirMtx = new THREE.Matrix4();
    dirMtx.makeRotationFromQuaternion(ori);

    var push = new THREE.Vector3(0, 0, -1.0);
    push.transformDirection(dirMtx);
    pos.addScaledVector(push, 0.125);

    // Clone our cube object and place it at the camera's
    // current position
    var cubeClone = cube.clone();
    scene.add(cubeClone);
    cubeClone.position.copy(pos);
    cubeClone.quaternion.copy(ori);

    cubes.push(cubeClone);

    anchorManager.add(cubeClone);
}