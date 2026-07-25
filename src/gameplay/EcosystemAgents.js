// Gameplay/EcosystemAgents.js
// The human body is a running simulation, not backdrop geometry: red
// blood cells drift along transport routes, white blood cells patrol and
// fight viruses on their own, macrophages hunt down weakened enemies,
// platelets repair damage markers, and dendritic cells raise alarms that
// summon reinforcements. The player intervenes in an ecosystem that was
// already moving before they arrived.

import * as THREE from 'three';
import { Health } from './Health.js';
import { wander, seek, distanceXZ } from '../ai/Steering.js';

const geoCache = new Map();
function agentGeometry( kind, scale ) {
	const key = kind + '_' + Math.round( scale * 100 );
	if ( ! geoCache.has( key ) ) {
		let geo;
		if ( kind === 'redBloodCell' ) geo = new THREE.TorusGeometry( 0.32 * scale, 0.14 * scale, 8, 16 );
		else if ( kind === 'platelet' ) geo = new THREE.TetrahedronGeometry( 0.35 * scale, 0 );
		else geo = new THREE.SphereGeometry( 0.42 * scale, 12, 10 );
		geoCache.set( key, geo );
	}
	return geoCache.get( key );
}

export class EcosystemAgent {

	constructor( world, kind, cfg, position ) {
		this.world = world;
		this.kind = kind; // 'redBloodCell' | 'whiteBloodCell' | 'platelet' | 'macrophage' | 'dendriticCell'
		this.cfg = cfg;
		this.isEnemy = false; // ecosystem agents are allies/neutral, never targeted by player weapons
		this.isEcosystem = true;
		this.radius = 0.4 * cfg.scale;

		this.health = new Health( cfg.health, 0 );
		this.position = position.clone();
		this.velocity = new THREE.Vector3();
		this.state = {};
		this._attackTimer = Math.random();
		this._alertTimer = 0;
		this._buffed = false;

		this.mesh = this._buildMesh();
		world.scene.add( this.mesh );
	}

	_buildMesh() {
		const mat = new THREE.MeshStandardMaterial( {
			color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.05,
		} );
		const mesh = new THREE.Mesh( agentGeometry( this.kind, this.cfg.scale ), mat );
		mesh.position.y = 0.4 * this.cfg.scale;
		mesh.castShadow = true;
		this._mat = mat;
		return mesh;
	}

	update( dt ) {
		this.health.update( dt );
		if ( ! this.health.alive ) { this._onDeath(); return; }

		switch ( this.kind ) {
			case 'redBloodCell': this._updateRBC( dt ); break;
			case 'whiteBloodCell': this._updateWBC( dt ); break;
			case 'platelet': this._updatePlatelet( dt ); break;
			case 'macrophage': this._updateMacrophage( dt ); break;
			case 'dendriticCell': this._updateDendritic( dt ); break;
		}

		this.position.addScaledVector( this.velocity, dt );
		this.mesh.position.x = this.position.x;
		this.mesh.position.z = this.position.z;
		this.mesh.rotation.y += dt * 0.6;
	}

	// Red blood cells: passive wandering "traffic". Killing them (friendly
	// fire / boom-virus splash) dings overall organ health.
	_updateRBC( dt ) {
		this.velocity.copy( wander( this.state, this.cfg.speed, dt ) );
	}

	// White blood cells: patrol until a virus enters aggro range, then fight.
	_updateWBC( dt ) {
		const target = this._findNearestEnemy( this.cfg.aggroRadius );
		if ( target ) {
			const dist = distanceXZ( this.position, target.position );
			if ( dist > this.cfg.attackRange ) {
				this.velocity.copy( seek( this.position, target.position, this.cfg.speed ) );
			} else {
				this.velocity.set( 0, 0, 0 );
				this._attackTimer -= dt;
				if ( this._attackTimer <= 0 ) {
					this._attackTimer = this.cfg.attackCooldown;
					let dmg = this.cfg.damage;
					const player = this.world.player;
					if ( player?.mods?.allyDamageBonus ) dmg *= ( 1 + player.mods.allyDamageBonus );
					if ( this._buffed ) dmg *= 1.25;
					target.health.damage( dmg );
					this.world.effects.hitSpark( target.position.x, 1, target.position.z, 0xffffff );
				}
			}
		} else {
			this.velocity.copy( wander( this.state, this.cfg.speed * 0.6, dt ) );
		}
	}

	// Platelets: seek the nearest "damage marker" (a wounded wall/ally) and repair over time.
	_updatePlatelet( dt ) {
		const woundedAlly = this.world.findNearestWoundedEcosystemAgent?.( this.position, this.cfg.repairRadius * 4, this );
		if ( woundedAlly ) {
			const dist = distanceXZ( this.position, woundedAlly.position );
			if ( dist > this.cfg.repairRadius ) {
				this.velocity.copy( seek( this.position, woundedAlly.position, this.cfg.speed ) );
			} else {
				this.velocity.set( 0, 0, 0 );
				woundedAlly.health.heal( this.cfg.repairRate * dt );
			}
		} else {
			this.velocity.copy( wander( this.state, this.cfg.speed * 0.5, dt ) );
		}
	}

	// Macrophages: hunt down low-health enemies and devour them outright.
	_updateMacrophage( dt ) {
		const target = this._findNearestWeakEnemy( this.cfg.aggroRadius, this.cfg.healthThresholdFrac );
		if ( target ) {
			const dist = distanceXZ( this.position, target.position );
			if ( dist > this.cfg.attackRange ) {
				this.velocity.copy( seek( this.position, target.position, this.cfg.speed ) );
			} else {
				this.velocity.set( 0, 0, 0 );
				this._attackTimer -= dt;
				if ( this._attackTimer <= 0 ) {
					this._attackTimer = this.cfg.attackCooldown;
					target.health.damage( this.cfg.damage );
					this.world.effects.hitSpark( target.position.x, 1, target.position.z, this.cfg.color );
				}
			}
		} else {
			this.velocity.copy( wander( this.state, this.cfg.speed * 0.5, dt ) );
		}
	}

	// Dendritic cells: on spotting a threat, periodically "alert" and summon reinforcements.
	_updateDendritic( dt ) {
		this.velocity.copy( wander( this.state, this.cfg.speed * 0.4, dt ) );
		this._alertTimer -= dt;
		const nearby = this._findNearestEnemy( this.cfg.alertRadius );
		if ( nearby && this._alertTimer <= 0 ) {
			this._alertTimer = this.cfg.alertCooldown;
			this.world.onDendriticAlert?.( this );
		}
	}

	_findNearestEnemy( radius ) {
		let best = null, bestDist = radius;
		for ( const e of this.world.enemies ) {
			if ( ! e.health.alive ) continue;
			const d = distanceXZ( this.position, e.position );
			if ( d < bestDist ) { bestDist = d; best = e; }
		}
		return best;
	}

	_findNearestWeakEnemy( radius, hpFrac ) {
		let best = null, bestDist = radius;
		for ( const e of this.world.enemies ) {
			if ( ! e.health.alive ) continue;
			if ( e.cfg?.elite ) continue; // macrophages don't tangle with elites
			if ( e.health.healthFrac > hpFrac ) continue;
			const d = distanceXZ( this.position, e.position );
			if ( d < bestDist ) { bestDist = d; best = e; }
		}
		return best;
	}

	_onDeath() {
		this.world.effects.hitSpark( this.position.x, 0.5, this.position.z, this.cfg.color );
		if ( this.kind === 'redBloodCell' ) this.world.onOrganHealthImpact?.( this.cfg.healthImpactOnDeath );
		this.mesh.visible = false;
		this.world.removeEcosystemAgent( this );
	}
}
