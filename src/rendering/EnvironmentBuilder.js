// Rendering/EnvironmentBuilder.js
// Builds the "microscope-fantasy" dressing for a room: organic floor/walls,
// glowing decorative cells, drifting DNA helices, and obstacle geometry
// used by Physics/Collision for line-of-sight/cover. Pure visuals + a
// simple obstacle list; no gameplay logic lives here.

import * as THREE from 'three';

const glowMatCache = new Map();
function glowMaterial( color, intensity = 1.4 ) {
	const key = color + '_' + intensity;
	if ( glowMatCache.has( key ) ) return glowMatCache.get( key );
	const mat = new THREE.MeshStandardMaterial( {
		color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.1,
	} );
	glowMatCache.set( key, mat );
	return mat;
}

export class EnvironmentBuilder {

	constructor( scene ) {
		this.scene = scene;
		this.group = new THREE.Group();
		this.group.name = 'environment';
		this.scene.add( this.group );
		this.obstacles = []; // { position: Vector3, radius }
		this._decorTime = 0;
		this._decorMeshes = [];
	}

	clear() {
		for ( const child of this.group.children.slice() ) {
			child.geometry?.dispose?.();
			this.group.remove( child );
		}
		this.obstacles.length = 0;
		this._decorMeshes.length = 0;
	}

	// Builds a roughly-circular arena with organic wall segments and a
	// scatter of obstacle pillars (varies by roomType/shape seed).
	buildRoom( biome, { radius = 16, wallSegments = 24, obstacleCount = 5, seed = Math.random() } = {} ) {
		this.clear();

		const rand = mulberry32( Math.floor( seed * 1e9 ) );

		// Floor
		const floorGeo = new THREE.CircleGeometry( radius, 48 );
		const floorMat = new THREE.MeshStandardMaterial( { color: biome.floorColor, roughness: 0.85, metalness: 0.05 } );
		const floor = new THREE.Mesh( floorGeo, floorMat );
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.group.add( floor );

		// Organic membrane wall ring (irregular radius per segment)
		const wallMat = new THREE.MeshStandardMaterial( {
			color: biome.wallColor, roughness: 0.6, metalness: 0.15,
			emissive: biome.keyColor, emissiveIntensity: 0.08, side: THREE.DoubleSide,
		} );
		for ( let i = 0; i < wallSegments; i ++ ) {
			const a0 = ( i / wallSegments ) * Math.PI * 2;
			const a1 = ( ( i + 1 ) / wallSegments ) * Math.PI * 2;
			const wobble = 1 + ( rand() - 0.5 ) * 0.12;
			const h = 5 + rand() * 2.5;
			const geo = new THREE.PlaneGeometry( ( radius * 2 * Math.PI / wallSegments ) * 1.05, h, 1, 4 );
			// bulge the membrane outward with a sine displacement
			const pos = geo.attributes.position;
			for ( let v = 0; v < pos.count; v ++ ) {
				const y = pos.getY( v );
				pos.setZ( v, Math.sin( ( y / h + 0.5 ) * Math.PI ) * 0.5 * rand() );
			}
			geo.computeVertexNormals();
			const seg = new THREE.Mesh( geo, wallMat );
			const mid = ( a0 + a1 ) / 2;
			seg.position.set( Math.sin( mid ) * radius * wobble, h / 2 - 0.5, Math.cos( mid ) * radius * wobble );
			seg.rotation.y = mid;
			seg.receiveShadow = true;
			this.group.add( seg );
		}

		// Obstacle pillars (also used as physics cover)
		for ( let i = 0; i < obstacleCount; i ++ ) {
			const ang = rand() * Math.PI * 2;
			const dist = 3 + rand() * ( radius - 6 );
			const pos = new THREE.Vector3( Math.sin( ang ) * dist, 0, Math.cos( ang ) * dist );
			const r = 0.8 + rand() * 0.9;
			const h = 2 + rand() * 3;
			const geo = new THREE.CapsuleGeometry( r, h, 4, 8 );
			const mesh = new THREE.Mesh( geo, glowMaterial( biome.keyColor, 0.25 ) );
			mesh.position.copy( pos ).setY( h / 2 + r );
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.group.add( mesh );
			this.obstacles.push( { position: pos.clone(), radius: r + 0.6 } );
		}

		// Decorative floating cells (pure eye-candy, no collision)
		const decorColors = [ biome.keyColor, 0xffffff, biome.ambientColor ];
		for ( let i = 0; i < 14; i ++ ) {
			const s = 0.15 + rand() * 0.35;
			const geo = new THREE.IcosahedronGeometry( s, 1 );
			const mesh = new THREE.Mesh( geo, glowMaterial( decorColors[ i % decorColors.length ], 1.8 ) );
			const ang = rand() * Math.PI * 2, dist = rand() * radius * 0.9;
			mesh.position.set( Math.sin( ang ) * dist, 1 + rand() * 4, Math.cos( ang ) * dist );
			mesh.userData.floatSeed = rand() * 100;
			mesh.userData.floatSpeed = 0.4 + rand() * 0.6;
			this.group.add( mesh );
			this._decorMeshes.push( mesh );
		}

		// A drifting DNA double-helix as a background centerpiece
		this._buildDNAHelix( radius * 0.75, biome.keyColor );

		return { obstacles: this.obstacles };
	}

	_buildDNAHelix( yOffset, color ) {
		const helix = new THREE.Group();
		const turns = 4, pointsPerTurn = 10, radius = 0.9;
		const matA = glowMaterial( color, 2 );
		const matB = glowMaterial( 0xffffff, 1 );
		const rungGeo = new THREE.CylinderGeometry( 0.03, 0.03, radius * 2, 6 );
		const nodeGeo = new THREE.SphereGeometry( 0.12, 8, 8 );

		for ( let i = 0; i < turns * pointsPerTurn; i ++ ) {
			const t = i / pointsPerTurn * Math.PI * 2;
			const y = i * 0.35;
			const x1 = Math.cos( t ) * radius, z1 = Math.sin( t ) * radius;
			const x2 = -x1, z2 = -z1;

			const n1 = new THREE.Mesh( nodeGeo, matA );
			n1.position.set( x1, y, z1 );
			const n2 = new THREE.Mesh( nodeGeo, matB );
			n2.position.set( x2, y, z2 );
			helix.add( n1, n2 );

			if ( i % 2 === 0 ) {
				const rung = new THREE.Mesh( rungGeo, matA );
				rung.position.set( 0, y, 0 );
				rung.lookAt( x1, y, z1 );
				rung.rotateX( Math.PI / 2 );
				helix.add( rung );
			}
		}
		helix.position.set( 10, yOffset, -10 );
		helix.userData.isHelix = true;
		this.group.add( helix );
		this._decorMeshes.push( helix );
	}

	update( dt ) {
		this._decorTime += dt;
		for ( const mesh of this._decorMeshes ) {
			if ( mesh.userData.isHelix ) {
				mesh.rotation.y += dt * 0.15;
				continue;
			}
			const seed = mesh.userData.floatSeed || 0;
			const speed = mesh.userData.floatSpeed || 0.5;
			mesh.position.y += Math.sin( this._decorTime * speed + seed ) * 0.003;
			mesh.rotation.y += dt * 0.3;
			mesh.rotation.x += dt * 0.15;
		}
	}
}

// Deterministic PRNG so a room's layout can be regenerated from a seed
// (useful for save/replay later).
function mulberry32( seed ) {
	let a = seed;
	return function () {
		a |= 0; a = ( a + 0x6D2B79F5 ) | 0;
		let t = Math.imul( a ^ ( a >>> 15 ), 1 | a );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
}
