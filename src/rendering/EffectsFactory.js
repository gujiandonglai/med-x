// Rendering/EffectsFactory.js
// Pooled burst-particle VFX. Every visual "juice" moment (muzzle flash,
// hit spark, death burst, heal pulse) is a short-lived puff of pooled
// points — nothing here allocates once the pool warms up.

import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

const MAX_PARTICLES_PER_BURST = 24;

export class EffectsFactory {

	constructor( scene ) {
		this.scene = scene;
		this.pool = new ObjectPool(
			() => this._createBurst(),
			( burst, x, y, z, color, count, speed, life ) => this._resetBurst( burst, x, y, z, color, count, speed, life ),
			24
		);
	}

	_createBurst() {
		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array( MAX_PARTICLES_PER_BURST * 3 );
		geo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
		const mat = new THREE.PointsMaterial( {
			size: 0.16, transparent: true, opacity: 1, depthWrite: false,
			blending: THREE.AdditiveBlending, vertexColors: false,
		} );
		const points = new THREE.Points( geo, mat );
		points.frustumCulled = false;
		points.visible = false;
		this.scene.add( points );

		return {
			mesh: points,
			velocities: new Array( MAX_PARTICLES_PER_BURST ).fill( 0 ).map( () => new THREE.Vector3() ),
			count: 0, life: 0, maxLife: 1,
		};
	}

	_resetBurst( burst, x, y, z, color = 0xffffff, count = 10, speed = 4, life = 0.5 ) {
		burst.mesh.material.color.setHex( color );
		burst.mesh.material.opacity = 1;
		burst.mesh.position.set( 0, 0, 0 );
		burst.count = Math.min( count, MAX_PARTICLES_PER_BURST );
		burst.life = 0;
		burst.maxLife = life;

		const posAttr = burst.mesh.geometry.attributes.position;
		for ( let i = 0; i < burst.count; i ++ ) {
			posAttr.setXYZ( i, x, y, z );
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos( Math.random() * 2 - 1 );
			const s = speed * ( 0.5 + Math.random() * 0.5 );
			burst.velocities[ i ].set(
				Math.sin( phi ) * Math.cos( theta ) * s,
				Math.abs( Math.cos( phi ) ) * s + 1.5,
				Math.sin( phi ) * Math.sin( theta ) * s
			);
		}
		posAttr.needsUpdate = true;
		burst.mesh.geometry.setDrawRange( 0, burst.count );
	}

	burst( x, y, z, { color = 0xffffff, count = 10, speed = 4, life = 0.5 } = {} ) {
		return this.pool.acquire( x, y, z, color, count, speed, life );
	}

	hitSpark( x, y, z, color = 0xffe27a ) { return this.burst( x, y, z, { color, count: 8, speed: 5, life: 0.3 } ); }
	muzzleFlash( x, y, z, color = 0x7fe3ff ) { return this.burst( x, y, z, { color, count: 5, speed: 3, life: 0.15 } ); }
	deathBurst( x, y, z, color = 0xff5d5d ) { return this.burst( x, y, z, { color, count: 22, speed: 6.5, life: 0.7 } ); }
	healPulse( x, y, z, color = 0x7cffb0 ) { return this.burst( x, y, z, { color, count: 14, speed: 2.5, life: 0.6 } ); }

	update( dt ) {
		this.pool.forEachSafe( ( burst ) => {
			burst.life += dt;
			if ( burst.life >= burst.maxLife ) { this.pool.release( burst ); return; }
			const t = burst.life / burst.maxLife;
			burst.mesh.material.opacity = 1 - t;
			const posAttr = burst.mesh.geometry.attributes.position;
			for ( let i = 0; i < burst.count; i ++ ) {
				const vx = burst.velocities[ i ].x * dt;
				const vy = ( burst.velocities[ i ].y - 9.8 * burst.life ) * dt;
				const vz = burst.velocities[ i ].z * dt;
				posAttr.setXYZ( i, posAttr.getX( i ) + vx, Math.max( 0, posAttr.getY( i ) + vy ), posAttr.getZ( i ) + vz );
			}
			posAttr.needsUpdate = true;
		} );
	}
}
