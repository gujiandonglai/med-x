// Rendering/SceneManager.js
// Owns the renderer, scene, camera and postprocessing chain. WebGL today;
// swapping in a WebGPURenderer later only touches this file (the rest of
// the game talks to `scene`/`camera`, not the renderer directly).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class SceneManager {

	constructor( canvas ) {
		this.canvas = canvas;

		this.renderer = new THREE.WebGLRenderer( { canvas, antialias: true, powerPreference: 'high-performance' } );
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.15;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera( 62, window.innerWidth / window.innerHeight, 0.1, 300 );
		this.camera.position.set( 0, 6, 9 );

		this._cameraTarget = new THREE.Vector3();
		this._cameraCurrent = new THREE.Vector3().copy( this.camera.position );
		this._cameraYaw = 0;

		this.ambient = new THREE.AmbientLight( 0x554466, 0.9 );
		this.scene.add( this.ambient );

		this.keyLight = new THREE.DirectionalLight( 0xffe0d0, 1.6 );
		this.keyLight.position.set( 6, 12, 4 );
		this.keyLight.castShadow = true;
		this.keyLight.shadow.mapSize.set( 1024, 1024 );
		this.keyLight.shadow.camera.near = 1;
		this.keyLight.shadow.camera.far = 40;
		this.keyLight.shadow.camera.left = -18;
		this.keyLight.shadow.camera.right = 18;
		this.keyLight.shadow.camera.top = 18;
		this.keyLight.shadow.camera.bottom = -18;
		this.scene.add( this.keyLight );

		this.rimLight = new THREE.PointLight( 0x66ccff, 2.5, 30 );
		this.rimLight.position.set( -6, 5, -6 );
		this.scene.add( this.rimLight );

		this.scene.fog = new THREE.FogExp2( 0x1a0510, 0.03 );

		this._setupComposer();
		window.addEventListener( 'resize', () => this.onResize() );
	}

	_setupComposer() {
		this.composer = new EffectComposer( this.renderer );
		this.composer.addPass( new RenderPass( this.scene, this.camera ) );

		this.bloomPass = new UnrealBloomPass(
			new THREE.Vector2( window.innerWidth, window.innerHeight ),
			0.85,  // strength
			0.55,  // radius
			0.2    // threshold — only glowing cell/energy materials bloom
		);
		this.composer.addPass( this.bloomPass );
		this.composer.addPass( new OutputPass() );
	}

	// Applies a biome's palette (called on entering each act).
	applyBiome( biome ) {
		this.scene.fog.color.setHex( biome.fogColor );
		this.scene.fog.density = biome.fogDensity;
		this.renderer.setClearColor( biome.fogColor, 1 );
		this.ambient.color.setHex( biome.ambientColor );
		this.keyLight.color.setHex( biome.keyColor );
		this.rimLight.color.setHex( biome.keyColor );
	}

	// Third-person follow camera: orbits behind `target` based on player yaw,
	// with a soft-follow lerp so it feels weighty rather than rigidly locked.
	updateCamera( targetObject, yaw, dt, aiming = false ) {
		const distance = aiming ? 4.2 : 6.4;
		const height = aiming ? 2.6 : 3.4;
		this._cameraTarget.set(
			targetObject.position.x - Math.sin( yaw ) * distance,
			targetObject.position.y + height,
			targetObject.position.z - Math.cos( yaw ) * distance
		);
		const lerpFactor = 1 - Math.pow( 0.0007, dt );
		this._cameraCurrent.lerp( this._cameraTarget, lerpFactor );
		this.camera.position.copy( this._cameraCurrent );
		this.camera.lookAt(
			targetObject.position.x,
			targetObject.position.y + 1.4,
			targetObject.position.z
		);
	}

	onResize() {
		const w = window.innerWidth, h = window.innerHeight;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( w, h );
		this.composer.setSize( w, h );
		this.bloomPass.resolution.set( w, h );
	}

	render() {
		this.composer.render();
	}
}
