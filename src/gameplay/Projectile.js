// Gameplay/Projectile.js
// Pooled bullets/darts/spores. `ProjectileSystem` owns the pool and does
// the per-frame integrate + collide pass; individual Projectile objects
// are dumb data bags reset on acquire (see Core/ObjectPool).

import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { circlesOverlap } from '../physics/Collision.js';

const geoCache = new Map();
function bulletGeometry( radius ) {
	if ( ! geoCache.has( radius ) ) geoCache.set( radius, new THREE.SphereGeometry( radius, 8, 8 ) );
	return geoCache.get( radius );
}

export class ProjectileSystem {

	constructor( scene, effects ) {
		this.scene = scene;
		this.effects = effects;
		this.pool = new ObjectPool(
			() => this._create(),
			( p, opts ) => this._reset( p, opts ),
			48
		);
	}

	_create() {
		const mat = new THREE.MeshBasicMaterial( { color: 0xffffff, toneMapped: false } );
		const mesh = new THREE.Mesh( bulletGeometry( 0.12 ), mat );
		mesh.visible = false;
		this.scene.add( mesh );
		const trail = new THREE.PointLight( 0xffffff, 0, 3 );
		mesh.add( trail );
		return {
			mesh, trail,
			velocity: new THREE.Vector3(),
			owner: null, isEnemyProjectile: false,
			damage: 0, pierce: 0, pierceLeft: 0, radius: 0.12, life: 0, maxLife: 3,
			element: null, critChance: 0, critMult: 1.5, ricochetChance: 0,
			hitSet: new Set(),
		};
	}

	_reset( p, { position, direction, speed, damage, pierce = 0, radius = 0.12, maxLife = 3, color = 0xffffff, owner = null, isEnemyProjectile = false, element = null, critChance = 0, critMult = 1.5, ricochetChance = 0 } ) {
		p.mesh.position.copy( position );
		p.mesh.material.color.setHex( color );
		p.mesh.geometry = bulletGeometry( radius );
		p.mesh.scale.setScalar( 1 );
		p.trail.color.setHex( color );
		p.trail.intensity = 1.4;
		p.velocity.copy( direction ).normalize().multiplyScalar( speed );
		p.owner = owner;
		p.isEnemyProjectile = isEnemyProjectile;
		p.damage = damage;
		p.pierce = pierce;
		p.pierceLeft = pierce;
		p.radius = radius;
		p.life = 0;
		p.maxLife = maxLife;
		p.element = element;
		p.critChance = critChance;
		p.critMult = critMult;
		p.ricochetChance = ricochetChance;
		p.hitSet.clear();
	}

	spawn( opts ) {
		return this.pool.acquire( opts );
	}

	_release( p ) {
		p.trail.intensity = 0;
		this.pool.release( p );
	}

	// `targets` is an array of { position, radius, health(Health cmp), isEnemy }.
	// Returns nothing; calls onHit(target, projectile, damageDealt) via callback.
	update( dt, targets, onHit ) {
		this.pool.forEachSafe( ( p ) => {
			p.life += dt;
			if ( p.life >= p.maxLife ) { this._release( p ); return; }

			p.mesh.position.addScaledVector( p.velocity, dt );

			let hit = false;
			for ( const t of targets ) {
				if ( t.isEnemy === p.isEnemyProjectile ) continue; // friendly fire off by default
				if ( ! t.health || ! t.health.alive ) continue;
				if ( p.hitSet.has( t ) ) continue;
				if ( circlesOverlap( p.mesh.position.x, p.mesh.position.z, p.radius, t.position.x, t.position.z, t.radius ) ) {
					p.hitSet.add( t );
					let dmg = p.damage;
					let isCrit = false;
					if ( p.critChance > 0 && Math.random() < p.critChance ) { dmg *= p.critMult; isCrit = true; }
					const opts = { element: p.element, isCrit, source: p.owner };
					const dealt = t.takeDamage ? t.takeDamage( dmg, opts ) : t.health.damage( dmg );
					onHit?.( t, p, dealt, isCrit );
					this.effects?.hitSpark( t.position.x, ( t.position.y ?? 1 ), t.position.z, isCrit ? 0xffe45c : 0xffffff );

					if ( p.pierceLeft > 0 ) { p.pierceLeft --; }
					else { hit = true; }
					break;
				}
			}

			if ( hit ) { this._release( p ); return; }
			if ( p.mesh.position.lengthSq() > 60 * 60 ) { this._release( p ); }
		} );
	}
}
