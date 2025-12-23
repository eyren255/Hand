import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global state
let scene, camera, renderer, controls;
let particleSystem;
let particles;
let particleGeometry;
let particleMaterial;
let particleCount = 10000;
let particleSize = 3;
let currentPattern = 'sphere';
let currentColor = new THREE.Color(0x00ffff);
let gestureSensitivity = 1.0;

// Particle shape state
let particleShape = 'point'; // 'point', 'sphere', 'box', 'ring'
let shapeSize = 0.5;
let instancedMesh = null;
let shapeGeometry = null;
let shapeMaterial = null;

// Color gradient state
let useGradient = false;
let gradientType = 'radial'; // 'radial', 'linear', 'noise'
let gradientColor1 = new THREE.Color(0x00ffff);
let gradientColor2 = new THREE.Color(0xff00ff);

// Preset system
const PRESET_STORAGE_KEY = 'particleSystemPresets';
const LAST_SESSION_KEY = 'particleSystemLastSession';

// Particle trails state
let enableTrails = false;
let trailLength = 5; // Number of frames to keep
let trailSystem = null;
let trailGeometry = null;
let trailMaterial = null;
let particlePositionHistory = [];

// Particle connections state
let enableConnections = false;
let connectionDistance = 5.0;
let connectionSystem = null;
let connectionGeometry = null;
let connectionMaterial = null;

// Physics state
let enablePhysics = false;
let particleVelocities = null;
let gravity = 0.0; // -1 to 1
let windStrength = 0.0;
let damping = 0.95; // Velocity decay
let boundarySize = 50.0; // Collision boundary
let lastFrameTime = 0;

// Performance guard
let enablePerfGuard = false;
let fpsSamples = [];
const FPS_SAMPLE_SIZE = 30;
const FPS_MIN = 30;
let throttleApplied = false;
let perfGuardMessage = '';

// Preview overlay
let enablePreview = false;
let previewCanvas = null;
let previewCtx = null;
const PREVIEW_W = 240;
const PREVIEW_H = 180;
let lastPreviewHands = null;

// Gesture detection state
let handDetected = false;
let handOpenness = 0.5; // 0 = closed, 1 = open
let lastHandOpenness = 0.5;
let targetScale = 1.0;
let currentScale = 1.0;

// Multiple hands support
let enableMultipleHands = false;
let swapHandRoles = false; // when true: first = scale, second = rotation
let roleAssignment = { rotation: null, scale: null }; // handedness labels to keep roles stable
let handsState = {
    left: { openness: 0.5, gesture: null, position: null },
    right: { openness: 0.5, gesture: null, position: null }
};

// Advanced gesture detection
let gestureState = {
    type: 'open', // 'open', 'pinch', 'swipe', 'rotate'
    value: 0.5,
    pinchStrength: 0.0,
    swipeVelocity: { x: 0, y: 0 },
    rotationAngle: 0.0
};

// Hand position history for swipe detection
let handPositionHistory = [];
const MAX_HISTORY = 5;
const SMOOTH_ALPHA = 0.25; // Smoothing factor for gestures
const CONFIDENCE_MIN = 0.5;
const ROTATION_DEADZONE = 0.05; // radians

// Animation state
let animationTargets = {
    scale: 1.0,
    expansion: 0.0,
    dispersion: 0.0,
    rotation: 0.0,
    windX: 0.0,
    windY: 0.0,
    windZ: 0.0
};

// Initialize Three.js scene
function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 50;

    // Renderer
    const canvas = document.getElementById('particleCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls (optional, for manual camera control)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 200;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);
}

// Particle pattern generators
const patternGenerators = {
    sphere: (count) => {
        const positions = new Float32Array(count * 3);
        const radius = 20;
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = radius * Math.cbrt(Math.random());
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        return positions;
    },

    torus: (count) => {
        const positions = new Float32Array(count * 3);
        const majorRadius = 15;
        const minorRadius = 8;
        for (let i = 0; i < count; i++) {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;
            const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
            const y = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
            const z = minorRadius * Math.sin(v);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }
        return positions;
    },

    cube: (count) => {
        const positions = new Float32Array(count * 3);
        const size = 25;
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * size;
            positions[i * 3 + 1] = (Math.random() - 0.5) * size;
            positions[i * 3 + 2] = (Math.random() - 0.5) * size;
        }
        return positions;
    },

    spiral: (count) => {
        const positions = new Float32Array(count * 3);
        const radius = 20;
        const height = 30;
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * Math.PI * 10;
            const r = radius * (1 - t * 0.5);
            positions[i * 3] = r * Math.cos(angle);
            positions[i * 3 + 1] = (t - 0.5) * height;
            positions[i * 3 + 2] = r * Math.sin(angle);
        }
        return positions;
    },

    flower: (count) => {
        const positions = new Float32Array(count * 3);
        const petals = 8;
        const radius = 20;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 * petals;
            const r = radius * (0.5 + 0.5 * Math.sin(angle * 2));
            const y = (Math.random() - 0.5) * 10;
            positions[i * 3] = r * Math.cos(angle);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(angle);
        }
        return positions;
    },

    wave: (count) => {
        const positions = new Float32Array(count * 3);
        const size = 30;
        const waves = 5;
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * size;
            const z = (Math.random() - 0.5) * size;
            const y = Math.sin((x + z) * waves * 0.1) * 5;
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }
        return positions;
    },

    explosion: (count) => {
        const positions = new Float32Array(count * 3);
        const speed = 25;
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * speed;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        return positions;
    },

    galaxy: (count) => {
        const positions = new Float32Array(count * 3);
        const arms = 3;
        const radius = 25;
        for (let i = 0; i < count; i++) {
            const angle = (i % (count / arms)) / (count / arms) * Math.PI * 2;
            const arm = Math.floor(i / (count / arms));
            const armAngle = (arm / arms) * Math.PI * 2;
            const r = (i % (count / arms)) / (count / arms) * radius;
            const spiral = r * 0.3;
            positions[i * 3] = Math.cos(angle + armAngle) * r + Math.cos(armAngle) * spiral;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
            positions[i * 3 + 2] = Math.sin(angle + armAngle) * r + Math.sin(armAngle) * spiral;
        }
        return positions;
    }
};

// Create shaped particles using InstancedMesh
function createShapedParticles(shapeType, positions, colors) {
    // Remove old instanced mesh if exists
    if (instancedMesh) {
        scene.remove(instancedMesh);
        shapeGeometry.dispose();
        shapeMaterial.dispose();
    }

    // Create geometry based on shape type
    switch (shapeType) {
        case 'sphere':
            shapeGeometry = new THREE.SphereGeometry(shapeSize, 8, 8);
            break;
        case 'box':
            shapeGeometry = new THREE.BoxGeometry(shapeSize, shapeSize, shapeSize);
            break;
        case 'ring':
            shapeGeometry = new THREE.TorusGeometry(shapeSize * 0.7, shapeSize * 0.3, 8, 16);
            break;
        default:
            return null;
    }

    // Create material
    shapeMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });

    // Create instanced mesh
    instancedMesh = new THREE.InstancedMesh(shapeGeometry, shapeMaterial, particleCount);

    // Set positions and colors for each instance
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        matrix.setPosition(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        instancedMesh.setMatrixAt(i, matrix);

        color.setRGB(colors[i3], colors[i3 + 1], colors[i3 + 2]);
        instancedMesh.setColorAt(i, color);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
    }

    scene.add(instancedMesh);
    return instancedMesh;
}

// Calculate gradient colors
function calculateGradientColors(positions, gradientType, color1, color2) {
    const colors = new Float32Array(particleCount * 3);
    
    if (!useGradient) {
        // Use single color
        for (let i = 0; i < particleCount; i++) {
            colors[i * 3] = currentColor.r;
            colors[i * 3 + 1] = currentColor.g;
            colors[i * 3 + 2] = currentColor.b;
        }
        return colors;
    }

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        let t = 0; // Interpolation factor (0 to 1)

        if (gradientType === 'radial') {
            // Radial gradient: distance from center
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            const dist = Math.sqrt(x * x + y * y + z * z);
            const maxDist = 30; // Approximate max distance
            t = Math.min(1, dist / maxDist);
        } else if (gradientType === 'linear') {
            // Linear gradient: based on Y position
            const y = positions[i3 + 1];
            t = (y + 20) / 40; // Normalize from -20 to 20
            t = Math.max(0, Math.min(1, t));
        } else if (gradientType === 'noise') {
            // Noise gradient: pseudo-random based on position
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            // Simple hash function
            const hash = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) % 1000;
            t = hash / 1000;
        }

        // Interpolate between color1 and color2
        colors[i3] = color1.r + (color2.r - color1.r) * t;
        colors[i3 + 1] = color1.g + (color2.g - color1.g) * t;
        colors[i3 + 2] = color1.b + (color2.b - color1.b) * t;
    }

    return colors;
}

// Create particle system
function createParticleSystem() {
    // Clean up old systems
    if (particleSystem) {
        scene.remove(particleSystem);
        if (particleGeometry) particleGeometry.dispose();
        if (particleMaterial) particleMaterial.dispose();
        particleSystem = null;
    }

    if (instancedMesh) {
        scene.remove(instancedMesh);
        if (shapeGeometry) shapeGeometry.dispose();
        if (shapeMaterial) shapeMaterial.dispose();
        instancedMesh = null;
    }

    // Clear trails and connections history
    particlePositionHistory = [];
    if (trailSystem) {
        scene.remove(trailSystem);
        if (trailGeometry) trailGeometry.dispose();
        if (trailMaterial) trailMaterial.dispose();
        trailSystem = null;
    }
    if (connectionSystem) {
        scene.remove(connectionSystem);
        if (connectionGeometry) connectionGeometry.dispose();
        if (connectionMaterial) connectionMaterial.dispose();
        connectionSystem = null;
    }

    // Initialize physics velocities
    if (enablePhysics) {
        particleVelocities = new Float32Array(particleCount * 3);
        // Initialize with small random velocities
        for (let i = 0; i < particleCount * 3; i++) {
            particleVelocities[i] = (Math.random() - 0.5) * 0.1;
        }
    } else {
        particleVelocities = null;
    }

    const positions = patternGenerators[currentPattern](particleCount);
    const originalPositions = positions.slice();
    const colors = calculateGradientColors(positions, gradientType, gradientColor1, gradientColor2);

    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.userData.originalPositions = originalPositions;

    if (particleShape === 'point') {
        // Use Points for point particles (original method)
        particleMaterial = new THREE.PointsMaterial({
            size: particleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);
        particles = particleGeometry.attributes.position.array;
    } else {
        // Use InstancedMesh for shaped particles
        createShapedParticles(particleShape, positions, colors);
        particles = positions; // Store for updates
    }
}

// Update gradient colors
function updateGradientColors() {
    if (!particleGeometry) return;

    const positions = particleGeometry.userData.originalPositions;
    const colors = calculateGradientColors(positions, gradientType, gradientColor1, gradientColor2);

    if (particleShape === 'point') {
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.attributes.color.needsUpdate = true;
    } else if (instancedMesh && instancedMesh.instanceColor) {
        const color = new THREE.Color();
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            color.setRGB(colors[i3], colors[i3 + 1], colors[i3 + 2]);
            instancedMesh.setColorAt(i, color);
        }
        instancedMesh.instanceColor.needsUpdate = true;
    }
}

// Apply gesture effects to particles
function applyGestureEffects() {
    if (!particleGeometry) return;

    // Handle both Points and InstancedMesh
    const positions = particleGeometry.attributes.position.array;
    const originalPositions = particleGeometry.userData.originalPositions;
    const scale = animationTargets.scale;
    const expansion = animationTargets.expansion;
    const dispersion = animationTargets.dispersion;
    const rotation = animationTargets.rotation || 0;

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const baseX = originalPositions[i3];
        const baseY = originalPositions[i3 + 1];
        const baseZ = originalPositions[i3 + 2];

        // Base scale
        let x = baseX * scale;
        let y = baseY * scale;
        let z = baseZ * scale;

        // Rotation (around Y axis)
        if (rotation !== 0) {
            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);
            const newX = x * cosR - z * sinR;
            const newZ = x * sinR + z * cosR;
            x = newX;
            z = newZ;
        }

        // Expansion (push particles outward)
        const length = Math.sqrt(x * x + y * y + z * z);
        if (length > 0) {
            const expandFactor = 1 + expansion * 0.5;
            x *= expandFactor;
            y *= expandFactor;
            z *= expandFactor;
        }

        // Dispersion (add random offset)
        if (dispersion > 0) {
            x += (Math.random() - 0.5) * dispersion * 5;
            y += (Math.random() - 0.5) * dispersion * 5;
            z += (Math.random() - 0.5) * dispersion * 5;
        }

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    particleGeometry.attributes.position.needsUpdate = true;

    // Update instanced mesh positions if using shapes
    if (instancedMesh && particleShape !== 'point') {
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            matrix.setPosition(positions[i3], positions[i3 + 1], positions[i3 + 2]);
            instancedMesh.setMatrixAt(i, matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // Update trails and connections if enabled
    if (enableTrails) {
        updateParticleTrails(positions);
    }
    if (enableConnections) {
        updateParticleConnections(positions);
    }
}

// Update particle trails
function updateParticleTrails(currentPositions) {
    // Store current positions in history
    const currentPosArray = Array.from(currentPositions);
    particlePositionHistory.push(currentPosArray);

    // Limit history length
    if (particlePositionHistory.length > trailLength) {
        particlePositionHistory.shift();
    }

    if (particlePositionHistory.length < 2) return;

    // Create trail lines
    const positions = [];
    const colors = [];
    let vertexCount = 0;

    for (let i = 0; i < particleCount; i++) {
        // Draw line from previous to current position for each particle
        for (let h = 1; h < particlePositionHistory.length; h++) {
            const prev = particlePositionHistory[h - 1];
            const curr = particlePositionHistory[h];

            const i3_prev = i * 3;
            const i3_curr = i * 3;

            // Start point
            positions.push(prev[i3_prev], prev[i3_prev + 1], prev[i3_prev + 2]);
            // End point
            positions.push(curr[i3_curr], curr[i3_curr + 1], curr[i3_curr + 2]);

            // Fade color based on age
            const age = h / particlePositionHistory.length;
            const opacity = 1 - age;
            colors.push(1, 1, 1, opacity);
            colors.push(1, 1, 1, opacity);

            vertexCount += 2;
        }
    }

    if (trailSystem) {
        scene.remove(trailSystem);
        trailGeometry.dispose();
        trailMaterial.dispose();
    }

    if (vertexCount > 0) {
        trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        trailGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));

        trailMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.5,
            linewidth: 1
        });

        trailSystem = new THREE.LineSegments(trailGeometry, trailMaterial);
        scene.add(trailSystem);
    }
}

// Update particle connections
function updateParticleConnections(positions) {
    const connectionPositions = [];
    const connectionColors = [];
    let connectionCount = 0;

    // Simple spatial optimization: only check nearby particles
    const checkRadius = Math.min(particleCount, 100); // Limit checks for performance

    for (let i = 0; i < particleCount; i += Math.max(1, Math.floor(particleCount / checkRadius))) {
        const i3 = i * 3;
        const x1 = positions[i3];
        const y1 = positions[i3 + 1];
        const z1 = positions[i3 + 2];

        for (let j = i + 1; j < particleCount; j += Math.max(1, Math.floor(particleCount / checkRadius))) {
            const j3 = j * 3;
            const x2 = positions[j3];
            const y2 = positions[j3 + 1];
            const z2 = positions[j3 + 2];

            const dist = Math.sqrt(
                (x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2
            );

            if (dist < connectionDistance) {
                // Add connection line
                connectionPositions.push(x1, y1, z1);
                connectionPositions.push(x2, y2, z2);

                // Color based on distance (closer = brighter)
                const intensity = 1 - (dist / connectionDistance);
                connectionColors.push(1, 1, 1, intensity * 0.3);
                connectionColors.push(1, 1, 1, intensity * 0.3);

                connectionCount++;
            }
        }
    }

    if (connectionSystem) {
        scene.remove(connectionSystem);
        connectionGeometry.dispose();
        connectionMaterial.dispose();
    }

    if (connectionCount > 0) {
        connectionGeometry = new THREE.BufferGeometry();
        connectionGeometry.setAttribute('position', new THREE.Float32BufferAttribute(connectionPositions, 3));
        connectionGeometry.setAttribute('color', new THREE.Float32BufferAttribute(connectionColors, 4));

        connectionMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            linewidth: 1
        });

        connectionSystem = new THREE.LineSegments(connectionGeometry, connectionMaterial);
        scene.add(connectionSystem);
    }
}

// Performance guard: throttle effects on low FPS
function updatePerformanceGuard(deltaTime) {
    if (!enablePerfGuard) return;
    // Estimate FPS from deltaTime
    const fps = deltaTime > 0 ? 1 / deltaTime : 60;
    fpsSamples.push(fps);
    if (fpsSamples.length > FPS_SAMPLE_SIZE) fpsSamples.shift();

    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

    if (!throttleApplied && fpsSamples.length === FPS_SAMPLE_SIZE && avgFps < FPS_MIN) {
        throttleApplied = true;
        perfGuardMessage = `Performance guard active (avg FPS ${avgFps.toFixed(0)}). Trails/connections reduced.`;
        // Disable trails and connections to recover FPS
        enableTrails = false;
        enableConnections = false;
        // Cap particle count
        if (particleCount > 20000) {
            particleCount = 20000;
            createParticleSystem();
        } else {
            // Recreate to apply disabled effects
            createParticleSystem();
        }
        // Update UI visibility
        updateUIFromPreset();
        console.warn(perfGuardMessage);
    }
}

// Smooth interpolation
function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

// Initialize hand tracking (using MediaPipe Hands from unpkg)
let handTracking = null;
let video = null;

async function initHandTracking() {
    try {
        console.log('Starting hand tracking initialization...');
        
        // Load MediaPipe Hands from unpkg (more reliable)
        console.log('Loading MediaPipe Hands...');
        await loadScript('https://unpkg.com/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js');
        await loadScript('https://unpkg.com/@mediapipe/hands@0.4.1646424915/hands.js');
        
        // Wait for global classes to be available
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if classes are available
        if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
            throw new Error('MediaPipe classes not loaded. Please check browser console.');
        }

        // Create video element
        video = document.createElement('video');
        video.style.display = 'none';
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        document.body.appendChild(video);

        // Get camera stream
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'user'
            }
        });
        
        console.log('Camera access granted');
        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        console.log('Initializing MediaPipe Hands...');
        // Initialize MediaPipe Hands
        const hands = new Hands({
            locateFile: (file) => {
                return `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2, // Support up to 2 hands
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            updateGestureFromHands(results);
        });

        handTracking = hands;
        updateCameraStatus(true);
        console.log('MediaPipe Hands initialized');

        // Start camera processing
        console.log('Starting camera processing...');
        const camera = new Camera(video, {
            onFrame: async () => {
                if (handTracking) {
                    try {
                        await handTracking.send({ image: video });
                    } catch (e) {
                        console.error('Error sending frame to hands detector:', e);
                    }
                }
            },
            width: 640,
            height: 480
        });
        camera.start();
        console.log('Camera processing started successfully');

        hideLoadingOverlay();
        hideCameraPrompt();
    } catch (error) {
        console.error('Hand tracking initialization failed:', error);
        console.error('Error details:', error.message, error.stack);
        updateCameraStatus(false, error.message || 'Initialization failed');
        hideLoadingOverlay();
        
        // Show error in prompt instead of immediately falling back
        showCameraError(error.message || 'Failed to initialize hand tracking');
    }
}

// Helper function to load scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            // Wait a bit for global variables to be available
            setTimeout(resolve, 300);
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            // Wait a bit for scripts to initialize
            setTimeout(resolve, 500);
        };
        script.onerror = (error) => {
            console.error(`Failed to load script: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}


// Detect hand side (left or right) based on landmarks
function detectHandSide(landmarks, handedness) {
    if (handedness && handedness.length > 0) {
        return handedness[0].displayName.toLowerCase(); // 'Left' or 'Right'
    }
    // Fallback: determine by wrist position relative to middle finger
    const wrist = landmarks[0];
    const middleFinger = landmarks[9]; // Middle finger base
    return wrist.x < middleFinger.x ? 'Left' : 'Right';
}

// Detect advanced gestures (pinch, swipe, rotation)
function detectAdvancedGestures(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // Pinch detection: distance between thumb and index tips
    const pinchDistance = calculateDistance(thumbTip, indexTip);
    const pinchThreshold = 0.05; // Adjust based on testing
    const pinchRaw = Math.max(0, 1 - (pinchDistance / pinchThreshold));
    gestureState.pinchStrength = lerp(gestureState.pinchStrength, pinchRaw, SMOOTH_ALPHA);

    // Rotation detection: angle of hand based on wrist to middle finger
    const middleBase = landmarks[9];
    const dx = middleBase.x - wrist.x;
    const dy = middleBase.y - wrist.y;
    const rotationRaw = Math.atan2(dy, dx);
    gestureState.rotationAngle = lerp(gestureState.rotationAngle, rotationRaw, SMOOTH_ALPHA);

    // Determine primary gesture type
    if (gestureState.pinchStrength > 0.5) {
        gestureState.type = 'pinch';
        gestureState.value = gestureState.pinchStrength;
    } else {
        gestureState.type = 'open';
        // Calculate openness as before
        const distances = [
            calculateDistance(thumbTip, wrist),
            calculateDistance(indexTip, wrist),
            calculateDistance(middleTip, wrist),
            calculateDistance(ringTip, wrist),
            calculateDistance(pinkyTip, wrist)
        ];
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const opennessRaw = Math.min(1, Math.max(0, (avgDistance - 0.15) / 0.30));
        gestureState.value = lerp(gestureState.value, opennessRaw, SMOOTH_ALPHA);
    }
    
    return gestureState;
}

// Detect swipe velocity from hand position history
function detectSwipe(landmarks) {
    const wrist = landmarks[0];
    const currentPos = { x: wrist.x, y: wrist.y, z: wrist.z || 0 };
    
    handPositionHistory.push({ ...currentPos, time: Date.now() });
    if (handPositionHistory.length > MAX_HISTORY) {
        handPositionHistory.shift();
    }
    
    if (handPositionHistory.length >= 2) {
        const last = handPositionHistory[handPositionHistory.length - 1];
        const prev = handPositionHistory[0];
        const timeDelta = (last.time - prev.time) / 1000; // seconds
        
        if (timeDelta > 0) {
            const rawVx = (last.x - prev.x) / timeDelta;
            const rawVy = (last.y - prev.y) / timeDelta;
            gestureState.swipeVelocity.x = lerp(gestureState.swipeVelocity.x, rawVx, SMOOTH_ALPHA);
            gestureState.swipeVelocity.y = lerp(gestureState.swipeVelocity.y, rawVy, SMOOTH_ALPHA);
            
            const swipeMagnitude = Math.sqrt(
                gestureState.swipeVelocity.x ** 2 + 
                gestureState.swipeVelocity.y ** 2
            );
            
            if (swipeMagnitude > 0.4) { // Threshold for swipe detection
                gestureState.type = 'swipe';
                gestureState.value = Math.min(1, swipeMagnitude);
            }
        }
    }
}

// Update gesture state from MediaPipe Hands results
function updateGestureFromHands(results) {
    const hands = [];
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handednessArr = results.multiHandedness || [];
        results.multiHandLandmarks.forEach((lm, idx) => {
            const handed = handednessArr[idx];
            const label = handed?.label || handed?.displayName || 'Unknown';
            const score = handed?.score ?? 1;
            if (score >= CONFIDENCE_MIN) {
                hands.push({ landmarks: lm, label, score });
            }
        });
    }

    if (hands.length === 0) {
        handDetected = false;
        updateGestureStatus(false);
        // Slowly return to default state
        handOpenness = lerp(handOpenness, 0.5, 0.05);
        gestureState.type = 'open';
        gestureState.value = handOpenness;
        updateGestureEffects();
        return;
    }

    // Store for preview overlay
    lastPreviewHands = hands;

    handDetected = true;

    if (enableMultipleHands && hands.length >= 2) {
        // Process both hands with role locking
        updateMultipleHandsStable(hands);
    } else {
        // Single hand: rotation only
        const hand = hands[0];
        const gestures = detectAdvancedGestures(hand.landmarks);
        detectSwipe(hand.landmarks);

        // Apply rotation with deadzone
        let rot = gestures.rotationAngle;
        if (Math.abs(rot) < ROTATION_DEADZONE) rot = 0;
        gestureState.rotationAngle = lerp(gestureState.rotationAngle, rot, SMOOTH_ALPHA);
        gestureState.type = 'rotation';
        gestureState.value = Math.abs(gestureState.rotationAngle);

        animationTargets.rotation = gestureState.rotationAngle * gestureSensitivity;
        animationTargets.scale = 1.0;
        animationTargets.expansion = 0;
        animationTargets.dispersion = 0;

        updateGestureStatus(true, { type: 'rotation', value: Math.abs(animationTargets.rotation) });
        updateGestureEffects();
    }
}

// Update multiple hands with role locking and stability
function updateMultipleHandsStable(hands) {
    // hands: array of {landmarks, label, score}
    // Determine rotation hand and scale hand using roleAssignment if possible
    let rotationHand = null;
    let scaleHand = null;

    // Helper to find hand by label
    const findByLabel = (label) => hands.find(h => h.label === label);

    if (roleAssignment.rotation) {
        rotationHand = findByLabel(roleAssignment.rotation);
    }
    if (roleAssignment.scale) {
        scaleHand = findByLabel(roleAssignment.scale);
    }

    // If missing, assign from available hands
    const available = hands.slice();
    if (!rotationHand) {
        rotationHand = available.shift();
    } else {
        // remove from available
        const idx = available.findIndex(h => h === rotationHand);
        if (idx >= 0) available.splice(idx, 1);
    }
    if (!scaleHand) {
        scaleHand = available.shift();
    }

    // If still missing, fallback
    if (!rotationHand) rotationHand = hands[0];
    if (!scaleHand) scaleHand = hands[1] || hands[0];

    // Save assignment by label for stability
    roleAssignment.rotation = rotationHand.label;
    roleAssignment.scale = scaleHand.label;

    // Compute gestures
    const rotGest = detectAdvancedGestures(rotationHand.landmarks);
    const scaleGest = detectAdvancedGestures(scaleHand.landmarks);

    // Deadzone rotation
    let rot = rotGest.rotationAngle;
    if (Math.abs(rot) < ROTATION_DEADZONE) rot = 0;

    if (!swapHandRoles) {
        animationTargets.rotation = rot * gestureSensitivity;
        animationTargets.scale = lerp(0.5, 2.0, scaleGest.value) * gestureSensitivity;
    } else {
        animationTargets.rotation = scaleGest.rotationAngle * gestureSensitivity;
        animationTargets.scale = lerp(0.5, 2.0, rotGest.value) * gestureSensitivity;
    }

    // Expansion/dispersion from scale hand openness
    animationTargets.expansion = scaleGest.value * gestureSensitivity;
    animationTargets.dispersion = Math.max(0, (scaleGest.value - 0.3) * gestureSensitivity);

    updateGestureStatus(true, { type: 'dual', value: scaleGest.value });
}

// Calculate 3D distance between two landmarks
function calculateDistance(p1, p2) {
    return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + 
        Math.pow(p2.y - p1.y, 2) + 
        Math.pow((p2.z || 0) - (p1.z || 0), 2)
    );
}

// Update gesture effects based on hand openness and gestures
function updateGestureEffects() {
    const sensitivity = gestureSensitivity;
    
    if (!enableMultipleHands) {
        // Single hand mode - original behavior with gesture support
        if (gestureState.type === 'rotation') {
            // Rotation only: keep scale stable
            animationTargets.scale = 1.0;
            animationTargets.expansion = 0;
            animationTargets.dispersion = 0;
            animationTargets.rotation = gestureState.rotationAngle * sensitivity;
        } else if (gestureState.type === 'pinch') {
            // Pinch: contract particles
            animationTargets.scale = lerp(0.3, 1.0, 1 - gestureState.pinchStrength) * sensitivity;
            animationTargets.expansion = 0;
            animationTargets.dispersion = 0;
        } else if (gestureState.type === 'swipe') {
            // Swipe: apply wind force
            animationTargets.windX = gestureState.swipeVelocity.x * sensitivity * 0.5;
            animationTargets.windY = gestureState.swipeVelocity.y * sensitivity * 0.5;
            animationTargets.scale = lerp(0.5, 2.0, handOpenness) * sensitivity;
        } else if (gestureState.type === 'open') {
            // Open/close hand: original behavior
            animationTargets.scale = lerp(0.5, 2.0, handOpenness) * sensitivity;
            animationTargets.expansion = handOpenness * sensitivity;
            animationTargets.dispersion = Math.max(0, (handOpenness - 0.3) * sensitivity);
        }
        
        // Apply rotation if detected
        if (Math.abs(gestureState.rotationAngle) > 0.1) {
            animationTargets.rotation = gestureState.rotationAngle * sensitivity;
        }
    }
    // Multiple hands mode effects are handled in updateMultipleHands()
}

// Mouse/keyboard simulation for testing without camera
function initMouseSimulation() {
    let mouseY = 0.5;
    document.addEventListener('mousemove', (e) => {
        mouseY = e.clientY / window.innerHeight;
        handOpenness = mouseY;
        updateGestureEffects();
        updateGestureStatus(true);
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            handOpenness = 1.0;
            updateGestureEffects();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            handOpenness = 0.0;
            updateGestureEffects();
        }
    });
}

// UI Event Handlers
function setupUI() {
    // Pattern selection
    document.getElementById('patternSelect').addEventListener('change', (e) => {
        currentPattern = e.target.value;
        createParticleSystem();
        markSettingsChanged();
    });

    // Particle shape selector
    document.getElementById('particleShapeSelect').addEventListener('change', (e) => {
        particleShape = e.target.value;
        const shapeSizeGroup = document.getElementById('shapeSizeGroup');
        shapeSizeGroup.style.display = particleShape === 'point' ? 'none' : 'block';
        createParticleSystem();
        markSettingsChanged();
    });

    // Shape size
    const shapeSizeSlider = document.getElementById('shapeSize');
    const shapeSizeValue = document.getElementById('shapeSizeValue');
    shapeSizeSlider.addEventListener('input', (e) => {
        shapeSize = parseFloat(e.target.value);
        shapeSizeValue.textContent = shapeSize.toFixed(1);
        if (particleShape !== 'point') {
            createParticleSystem();
        }
        markSettingsChanged();
    });

    // Gradient toggle
    const useGradientToggle = document.getElementById('useGradientToggle');
    const singleColorGroup = document.getElementById('singleColorGroup');
    const gradientGroup = document.getElementById('gradientGroup');
    useGradientToggle.addEventListener('change', (e) => {
        useGradient = e.target.checked;
        singleColorGroup.style.display = useGradient ? 'none' : 'block';
        gradientGroup.style.display = useGradient ? 'block' : 'none';
        updateGradientColors();
        markSettingsChanged();
    });

    // Gradient type
    document.getElementById('gradientTypeSelect').addEventListener('change', (e) => {
        gradientType = e.target.value;
        updateGradientColors();
        markSettingsChanged();
    });

    // Gradient colors
    document.getElementById('gradientColor1').addEventListener('input', (e) => {
        gradientColor1.setHex(parseInt(e.target.value.replace('#', '0x')));
        updateGradientColors();
        markSettingsChanged();
    });

    document.getElementById('gradientColor2').addEventListener('input', (e) => {
        gradientColor2.setHex(parseInt(e.target.value.replace('#', '0x')));
        updateGradientColors();
        markSettingsChanged();
    });

    // Color picker (single color)
    document.getElementById('colorPicker').addEventListener('input', (e) => {
        currentColor.setHex(parseInt(e.target.value.replace('#', '0x')));
        if (!useGradient) {
            updateGradientColors();
        }
        markSettingsChanged();
    });

    // Particle count
    const particleCountSlider = document.getElementById('particleCount');
    const particleCountValue = document.getElementById('particleCountValue');
    particleCountSlider.addEventListener('input', (e) => {
        particleCount = parseInt(e.target.value);
        particleCountValue.textContent = particleCount;
        createParticleSystem();
        markSettingsChanged();
    });

    // Particle size
    const particleSizeSlider = document.getElementById('particleSize');
    const particleSizeValue = document.getElementById('particleSizeValue');
    particleSizeSlider.addEventListener('input', (e) => {
        particleSize = parseFloat(e.target.value);
        particleSizeValue.textContent = particleSize;
        if (particleMaterial) {
            particleMaterial.size = particleSize;
        }
        markSettingsChanged();
    });

    // Gesture sensitivity
    const sensitivitySlider = document.getElementById('gestureSensitivity');
    const sensitivityValue = document.getElementById('gestureSensitivityValue');
    sensitivitySlider.addEventListener('input', (e) => {
        gestureSensitivity = parseFloat(e.target.value);
        sensitivityValue.textContent = gestureSensitivity.toFixed(1);
        updateGestureEffects();
        markSettingsChanged();
    });

    // Panel toggle
    document.getElementById('togglePanel').addEventListener('click', () => {
        const panel = document.getElementById('controlPanel');
        panel.classList.toggle('collapsed');
        const btn = document.getElementById('togglePanel');
        btn.textContent = panel.classList.contains('collapsed') ? '+' : '−';
    });

    // Fullscreen
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    // Multiple hands toggle
    const multipleHandsToggle = document.getElementById('multipleHandsToggle');
    const swapRolesGroup = document.getElementById('swapRolesGroup');
    if (multipleHandsToggle) {
        multipleHandsToggle.addEventListener('change', (e) => {
            enableMultipleHands = e.target.checked;
            handsState.left = { openness: 0.5, gesture: null, position: null };
            handsState.right = { openness: 0.5, gesture: null, position: null };
            if (swapRolesGroup) {
                swapRolesGroup.style.display = enableMultipleHands ? 'block' : 'none';
            }
            markSettingsChanged();
        });
    }
    const swapRolesToggle = document.getElementById('swapHandRoles');
    if (swapRolesToggle) {
        swapRolesToggle.addEventListener('change', (e) => {
            swapHandRoles = e.target.checked;
            markSettingsChanged();
        });
    }

    // Preview toggle
    const previewToggle = document.getElementById('enablePreviewToggle');
    const previewContainer = document.getElementById('previewContainer');
    if (previewToggle && previewContainer) {
        previewToggle.addEventListener('change', (e) => {
            enablePreview = e.target.checked;
            if (enablePreview) {
                ensurePreviewCanvas();
                previewContainer.classList.remove('hidden');
            } else {
                previewContainer.classList.add('hidden');
            }
            markSettingsChanged();
        });
    }

    // Trails toggle
    const enableTrailsToggle = document.getElementById('enableTrailsToggle');
    const trailLengthGroup = document.getElementById('trailLengthGroup');
    if (enableTrailsToggle) {
        enableTrailsToggle.addEventListener('change', (e) => {
            enableTrails = e.target.checked;
            if (trailLengthGroup) trailLengthGroup.style.display = enableTrails ? 'block' : 'none';
            if (!enableTrails && trailSystem) {
                scene.remove(trailSystem);
                if (trailGeometry) trailGeometry.dispose();
                if (trailMaterial) trailMaterial.dispose();
                trailSystem = null;
            }
            particlePositionHistory = [];
            markSettingsChanged();
        });
    }

    // Trail length
    const trailLengthSlider = document.getElementById('trailLength');
    const trailLengthValue = document.getElementById('trailLengthValue');
    if (trailLengthSlider) {
        trailLengthSlider.addEventListener('input', (e) => {
            trailLength = parseInt(e.target.value);
            if (trailLengthValue) trailLengthValue.textContent = trailLength;
            markSettingsChanged();
        });
    }

    // Connections toggle
    const enableConnectionsToggle = document.getElementById('enableConnectionsToggle');
    const connectionDistanceGroup = document.getElementById('connectionDistanceGroup');
    if (enableConnectionsToggle) {
        enableConnectionsToggle.addEventListener('change', (e) => {
            enableConnections = e.target.checked;
            if (connectionDistanceGroup) connectionDistanceGroup.style.display = enableConnections ? 'block' : 'none';
            if (!enableConnections && connectionSystem) {
                scene.remove(connectionSystem);
                if (connectionGeometry) connectionGeometry.dispose();
                if (connectionMaterial) connectionMaterial.dispose();
                connectionSystem = null;
            }
            markSettingsChanged();
        });
    }

    // Connection distance
    const connectionDistanceSlider = document.getElementById('connectionDistance');
    const connectionDistanceValue = document.getElementById('connectionDistanceValue');
    if (connectionDistanceSlider) {
        connectionDistanceSlider.addEventListener('input', (e) => {
            connectionDistance = parseFloat(e.target.value);
            if (connectionDistanceValue) connectionDistanceValue.textContent = connectionDistance.toFixed(1);
            markSettingsChanged();
        });
    }

    // Physics toggle
    const enablePhysicsToggle = document.getElementById('enablePhysicsToggle');
    const physicsGroup = document.getElementById('physicsGroup');
    if (enablePhysicsToggle) {
        enablePhysicsToggle.addEventListener('change', (e) => {
            enablePhysics = e.target.checked;
            if (physicsGroup) physicsGroup.style.display = enablePhysics ? 'block' : 'none';
            if (enablePhysics) {
                particleVelocities = new Float32Array(particleCount * 3);
                for (let i = 0; i < particleCount * 3; i++) {
                    particleVelocities[i] = (Math.random() - 0.5) * 0.1;
                }
            }
            markSettingsChanged();
        });
    }

    // Gravity
    const gravitySlider = document.getElementById('gravity');
    const gravityValue = document.getElementById('gravityValue');
    if (gravitySlider) {
        gravitySlider.addEventListener('input', (e) => {
            gravity = parseFloat(e.target.value);
            if (gravityValue) gravityValue.textContent = gravity.toFixed(1);
            markSettingsChanged();
        });
    }

    // Wind strength
    const windStrengthSlider = document.getElementById('windStrength');
    const windStrengthValue = document.getElementById('windStrengthValue');
    if (windStrengthSlider) {
        windStrengthSlider.addEventListener('input', (e) => {
            windStrength = parseFloat(e.target.value);
            if (windStrengthValue) windStrengthValue.textContent = windStrength.toFixed(1);
            markSettingsChanged();
        });
    }

    // Damping
    const dampingSlider = document.getElementById('damping');
    const dampingValue = document.getElementById('dampingValue');
    if (dampingSlider) {
        dampingSlider.addEventListener('input', (e) => {
            damping = parseFloat(e.target.value);
            if (dampingValue) dampingValue.textContent = damping.toFixed(2);
            markSettingsChanged();
        });
    }

    // Performance guard
    const perfGuardToggle = document.getElementById('enablePerfGuard');
    if (perfGuardToggle) {
        perfGuardToggle.addEventListener('change', (e) => {
            enablePerfGuard = e.target.checked;
            throttleApplied = false;
            fpsSamples = [];
            markSettingsChanged();
        });
    }

    // Preset handlers
    const savePresetBtn = document.getElementById('savePresetBtn');
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            const name = document.getElementById('presetName').value;
            savePreset(name);
        });
    }

    const loadPresetBtn = document.getElementById('loadPresetBtn');
    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            const select = document.getElementById('presetSelect');
            const name = select.value;
            if (name) {
                loadPreset(name);
            } else {
                alert('Please select a preset to load');
            }
        });
    }

    const deletePresetBtn = document.getElementById('deletePresetBtn');
    if (deletePresetBtn) {
        deletePresetBtn.addEventListener('click', () => {
            const select = document.getElementById('presetSelect');
            const name = select.value;
            if (name) {
                deletePreset(name);
            } else {
                alert('Please select a preset to delete');
            }
        });
    }
}

// Status updates
function updateCameraStatus(active, error = null) {
    const status = document.getElementById('cameraStatus');
    const dot = status.querySelector('.status-dot');
    const text = status.querySelector('span:last-child');
    
    if (error) {
        dot.className = 'status-dot';
        text.textContent = `Camera: Error - ${error}`;
    } else if (active) {
        dot.className = 'status-dot active';
        text.textContent = 'Camera: Active';
    } else {
        dot.className = 'status-dot';
        text.textContent = 'Camera: Not Started';
    }
}

function updateGestureStatus(detected, gestures = null) {
    const status = document.getElementById('gestureStatus');
    const dot = status.querySelector('.status-dot');
    const text = status.querySelector('span:last-child');
    
    if (detected) {
        dot.className = 'status-dot detecting';
        if (enableMultipleHands) {
            if (swapHandRoles) {
                text.textContent = 'Gesture: Hand1 Scale | Hand2 Rotation';
            } else {
                text.textContent = 'Gesture: Hand1 Rotation | Hand2 Scale';
            }
        } else if (gestures) {
            const gestureType = gestures.type.charAt(0).toUpperCase() + gestures.type.slice(1);
            const value = Math.round(gestures.value * 100);
            text.textContent = `Gesture: ${gestureType} (${value}%)`;
        } else {
            const openness = Math.round(handOpenness * 100);
            text.textContent = `Gesture: Hand Detected (${openness}% open)`;
        }
    } else {
        dot.className = 'status-dot';
        text.textContent = 'Gesture: No Hand Detected';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// Show loading overlay initially
function showInitialLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
}

// Preset management functions
function savePreset(name) {
    if (!name || name.trim() === '') {
        alert('Please enter a preset name');
        return;
    }

    const preset = {
        name: name.trim(),
        particleCount,
        particleSize,
        particleShape,
        shapeSize,
        currentPattern,
        useGradient,
        gradientType,
        currentColor: currentColor.getHex(),
        gradientColor1: gradientColor1.getHex(),
        gradientColor2: gradientColor2.getHex(),
        gestureSensitivity,
        enableMultipleHands,
        enableTrails,
        trailLength,
        enableConnections,
        connectionDistance,
        enablePhysics,
        gravity,
        windStrength,
        damping
    };

    const presets = getPresets();
    presets[name.trim()] = preset;
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    
    // Update preset list
    updatePresetList();
    alert(`Preset "${name}" saved!`);
}

function loadPreset(name) {
    const presets = getPresets();
    const preset = presets[name];
    
    if (!preset) {
        alert('Preset not found');
        return;
    }

    // Load all settings
    particleCount = preset.particleCount || particleCount;
    particleSize = preset.particleSize || particleSize;
    particleShape = preset.particleShape || particleShape;
    shapeSize = preset.shapeSize || shapeSize;
    currentPattern = preset.currentPattern || currentPattern;
    useGradient = preset.useGradient !== undefined ? preset.useGradient : useGradient;
    gradientType = preset.gradientType || gradientType;
    currentColor.setHex(preset.currentColor || 0x00ffff);
    gradientColor1.setHex(preset.gradientColor1 || 0x00ffff);
    gradientColor2.setHex(preset.gradientColor2 || 0xff00ff);
    gestureSensitivity = preset.gestureSensitivity || gestureSensitivity;
    enableMultipleHands = preset.enableMultipleHands !== undefined ? preset.enableMultipleHands : enableMultipleHands;
    enableTrails = preset.enableTrails !== undefined ? preset.enableTrails : enableTrails;
    trailLength = preset.trailLength || trailLength;
    enableConnections = preset.enableConnections !== undefined ? preset.enableConnections : enableConnections;
    connectionDistance = preset.connectionDistance || connectionDistance;
    enablePhysics = preset.enablePhysics !== undefined ? preset.enablePhysics : enablePhysics;
    gravity = preset.gravity !== undefined ? preset.gravity : gravity;
    windStrength = preset.windStrength !== undefined ? preset.windStrength : windStrength;
    damping = preset.damping !== undefined ? preset.damping : damping;

    // Update UI
    updateUIFromPreset();
    
    // Recreate particle system
    createParticleSystem();
    
    saveLastSession();
    alert(`Preset "${name}" loaded!`);
}

function deletePreset(name) {
    if (!confirm(`Delete preset "${name}"?`)) return;
    
    const presets = getPresets();
    delete presets[name];
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    
    updatePresetList();
}

function getPresets() {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
}

function listPresets() {
    const presets = getPresets();
    return Object.keys(presets);
}

function updatePresetList() {
    const presetSelect = document.getElementById('presetSelect');
    if (!presetSelect) return;

    const presets = listPresets();
    presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
    
    presets.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        presetSelect.appendChild(option);
    });
}

function updateUIFromPreset() {
    // Update all UI controls to match current state
    document.getElementById('particleCount').value = particleCount;
    document.getElementById('particleCountValue').textContent = particleCount;
    document.getElementById('particleSize').value = particleSize;
    document.getElementById('particleSizeValue').textContent = particleSize;
    document.getElementById('particleShapeSelect').value = particleShape;
    document.getElementById('shapeSize').value = shapeSize;
    document.getElementById('shapeSizeValue').textContent = shapeSize;
    document.getElementById('patternSelect').value = currentPattern;
    document.getElementById('useGradientToggle').checked = useGradient;
    document.getElementById('gradientTypeSelect').value = gradientType;
    document.getElementById('colorPicker').value = '#' + currentColor.getHexString().padStart(6, '0');
    document.getElementById('gradientColor1').value = '#' + gradientColor1.getHexString().padStart(6, '0');
    document.getElementById('gradientColor2').value = '#' + gradientColor2.getHexString().padStart(6, '0');
    document.getElementById('gestureSensitivity').value = gestureSensitivity;
    document.getElementById('gestureSensitivityValue').textContent = gestureSensitivity.toFixed(1);
    document.getElementById('multipleHandsToggle').checked = enableMultipleHands;
    const swapRolesToggle = document.getElementById('swapHandRoles');
    if (swapRolesToggle) swapRolesToggle.checked = swapHandRoles;
    document.getElementById('enableTrailsToggle').checked = enableTrails;
    document.getElementById('trailLength').value = trailLength;
    document.getElementById('trailLengthValue').textContent = trailLength;
    document.getElementById('enableConnectionsToggle').checked = enableConnections;
    document.getElementById('connectionDistance').value = connectionDistance;
    document.getElementById('connectionDistanceValue').textContent = connectionDistance.toFixed(1);
    document.getElementById('enablePhysicsToggle').checked = enablePhysics;
    document.getElementById('gravity').value = gravity;
    document.getElementById('gravityValue').textContent = gravity.toFixed(1);
    document.getElementById('windStrength').value = windStrength;
    document.getElementById('windStrengthValue').textContent = windStrength.toFixed(1);
    document.getElementById('damping').value = damping;
    document.getElementById('dampingValue').textContent = damping.toFixed(2);
    const perfToggle = document.getElementById('enablePerfGuard');
    if (perfToggle) perfToggle.checked = enablePerfGuard;
    const previewToggle = document.getElementById('enablePreviewToggle');
    if (previewToggle) previewToggle.checked = enablePreview;

    // Update visibility of conditional groups
    document.getElementById('shapeSizeGroup').style.display = particleShape === 'point' ? 'none' : 'block';
    document.getElementById('singleColorGroup').style.display = useGradient ? 'none' : 'block';
    document.getElementById('gradientGroup').style.display = useGradient ? 'block' : 'none';
    document.getElementById('trailLengthGroup').style.display = enableTrails ? 'block' : 'none';
    document.getElementById('connectionDistanceGroup').style.display = enableConnections ? 'block' : 'none';
    document.getElementById('physicsGroup').style.display = enablePhysics ? 'block' : 'none';
    const swapRolesGroup = document.getElementById('swapRolesGroup');
    if (swapRolesGroup) swapRolesGroup.style.display = enableMultipleHands ? 'block' : 'none';
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer) previewContainer.classList.toggle('hidden', !enablePreview);
}

function markSettingsChanged() {
    saveLastSession();
}

// Autosave last session
function saveLastSession() {
    const session = {
        particleCount,
        particleSize,
        particleShape,
        shapeSize,
        currentPattern,
        useGradient,
        gradientType,
        currentColor: currentColor.getHex(),
        gradientColor1: gradientColor1.getHex(),
        gradientColor2: gradientColor2.getHex(),
        gestureSensitivity,
        enableMultipleHands,
        swapHandRoles,
        enableTrails,
        trailLength,
        enableConnections,
        connectionDistance,
        enablePhysics,
        gravity,
        windStrength,
        damping,
        enablePerfGuard,
        enablePreview
    };
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
}

function loadLastSession() {
    const stored = localStorage.getItem(LAST_SESSION_KEY);
    if (!stored) return false;
    try {
        const s = JSON.parse(stored);
        particleCount = s.particleCount ?? particleCount;
        particleSize = s.particleSize ?? particleSize;
        particleShape = s.particleShape ?? particleShape;
        shapeSize = s.shapeSize ?? shapeSize;
        currentPattern = s.currentPattern ?? currentPattern;
        useGradient = s.useGradient ?? useGradient;
        gradientType = s.gradientType ?? gradientType;
        if (s.currentColor) currentColor.setHex(s.currentColor);
        if (s.gradientColor1) gradientColor1.setHex(s.gradientColor1);
        if (s.gradientColor2) gradientColor2.setHex(s.gradientColor2);
        gestureSensitivity = s.gestureSensitivity ?? gestureSensitivity;
        enableMultipleHands = s.enableMultipleHands ?? enableMultipleHands;
        swapHandRoles = s.swapHandRoles ?? swapHandRoles;
        enableTrails = s.enableTrails ?? enableTrails;
        trailLength = s.trailLength ?? trailLength;
        enableConnections = s.enableConnections ?? enableConnections;
        connectionDistance = s.connectionDistance ?? connectionDistance;
        enablePhysics = s.enablePhysics ?? enablePhysics;
        gravity = s.gravity ?? gravity;
        windStrength = s.windStrength ?? windStrength;
        damping = s.damping ?? damping;
        enablePerfGuard = s.enablePerfGuard ?? enablePerfGuard;
        enablePreview = s.enablePreview ?? enablePreview;
        return true;
    } catch (e) {
        console.error('Failed to load last session', e);
        return false;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Calculate delta time
    const currentTime = performance.now() / 1000; // Convert to seconds
    const deltaTime = lastFrameTime > 0 ? currentTime - lastFrameTime : 0.016; // Default to ~60fps
    lastFrameTime = currentTime;

    // Performance guard
    updatePerformanceGuard(deltaTime);

    // Update physics first (before gesture effects)
    if (enablePhysics) {
        updatePhysics(deltaTime);
    } else {
        // Smooth interpolation of effects
        currentScale = lerp(currentScale, animationTargets.scale, 0.1);
        
        // Apply gesture effects
        applyGestureEffects();
    }

    // Rotate particle system slowly (only if not using physics)
    if (particleSystem && !enablePhysics) {
        particleSystem.rotation.y += 0.002;
    }

    // Update controls
    controls.update();

    // Render
    renderer.render(scene, camera);

    // Preview overlay
    renderPreview();
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Show camera prompt
function showCameraPrompt() {
    const prompt = document.getElementById('cameraPrompt');
    prompt.classList.remove('hidden');
}

// Hide camera prompt
function hideCameraPrompt() {
    const prompt = document.getElementById('cameraPrompt');
    prompt.classList.add('hidden');
}

// Draw preview overlay with landmarks
function renderPreview() {
    if (!enablePreview || !previewCanvas || !previewCtx || !video || !video.videoWidth || !video.videoHeight) return;
    // Draw video frame scaled to preview
    previewCtx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const scale = Math.min(PREVIEW_W / vidW, PREVIEW_H / vidH);
    const drawW = vidW * scale;
    const drawH = vidH * scale;
    const offsetX = (PREVIEW_W - drawW) / 2;
    const offsetY = (PREVIEW_H - drawH) / 2;
    previewCtx.drawImage(video, 0, 0, vidW, vidH, offsetX, offsetY, drawW, drawH);

    if (!lastPreviewHands) return;
    previewCtx.lineWidth = 2;
    previewCtx.strokeStyle = 'rgba(0,255,255,0.8)';
    previewCtx.fillStyle = 'rgba(0,255,255,0.9)';
    previewCtx.font = '12px Segoe UI, sans-serif';

    lastPreviewHands.forEach((hand, idx) => {
        const lm = hand.landmarks;
        const label = hand.label || `Hand${idx + 1}`;
        // Draw landmarks
        lm.forEach(pt => {
            const x = offsetX + pt.x * drawW;
            const y = offsetY + pt.y * drawH;
            previewCtx.beginPath();
            previewCtx.arc(x, y, 3, 0, Math.PI * 2);
            previewCtx.fill();
        });
        // Label near wrist (landmark 0)
        const wrist = lm[0];
        const lx = offsetX + wrist.x * drawW;
        const ly = offsetY + wrist.y * drawH;
        previewCtx.fillStyle = 'rgba(0,0,0,0.6)';
        previewCtx.fillRect(lx - 2, ly - 16, 70, 16);
        previewCtx.fillStyle = 'rgba(0,255,255,0.9)';
        previewCtx.fillText(label, lx, ly - 4);
    });
}

function ensurePreviewCanvas() {
    if (previewCanvas && previewCtx) return;
    previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
        previewCtx = previewCanvas.getContext('2d');
    }
}

// Show camera error
function showCameraError(errorMessage) {
    const prompt = document.getElementById('cameraPrompt');
    const promptContent = prompt.querySelector('.prompt-content');
    const title = promptContent.querySelector('h3');
    const description = promptContent.querySelector('p');
    
    title.textContent = 'Camera Access Granted';
    description.innerHTML = `Camera access was granted, but hand tracking initialization failed.<br><br><strong>Error:</strong> ${errorMessage}<br><br>Would you like to try again or use mouse/keyboard controls?`;
    
    prompt.classList.remove('hidden');
}

// Initialize everything
async function init() {
    initScene();
    setupUI();
    loadLastSession();
    updateUIFromPreset();
    createParticleSystem();
    window.addEventListener('resize', onWindowResize);
    setupCameraPrompt();
    
    // Initialize preset list (after UI is set up)
    setTimeout(() => {
        updatePresetList();
    }, 200);
    
    // Start animation loop immediately
    animate();
    
    // Auto-request camera access on page load (with small delay for better UX)
    setTimeout(async () => {
        try {
            // Directly initialize hand tracking, which will request camera access
            await initHandTracking();
            hideLoadingOverlay();
        } catch (error) {
            console.log('Auto camera request failed, showing prompt:', error);
            hideLoadingOverlay();
            // Show prompt if auto-request fails or is denied
            showCameraPrompt();
        }
    }, 500);
}

// Setup camera prompt event handlers
function setupCameraPrompt() {
    const enableBtn = document.getElementById('enableCameraBtn');
    const skipBtn = document.getElementById('skipCameraBtn');
    
    enableBtn.addEventListener('click', async () => {
        hideCameraPrompt();
        showLoadingOverlay('Requesting Camera Access...');
        try {
            await initHandTracking();
        } catch (error) {
            console.error('Camera initialization failed:', error);
            updateCameraStatus(false, error.message);
            hideLoadingOverlay();
            showCameraError(error.message || 'Failed to initialize hand tracking');
        }
    });
    
    skipBtn.addEventListener('click', () => {
        hideCameraPrompt();
        updateCameraStatus(false, 'Using mouse/keyboard controls');
        initMouseSimulation();
    });
}

// Show loading overlay with message
function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

// Start the application
init();

