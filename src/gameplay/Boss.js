// Gameplay/Boss.js
// Multi-phase boss: phases are picked by remaining HP fraction (see
// Core/Config.BOSSES). Each phase has its own attack pool and pacing.
// Attacks are telegraphed (a wind-up window) before they actually deal
// damage, in the spirit of readable, mechanic-driven encounters rather
// than raw stat checks.

import * as THREE from 'three';
import { FiniteStateMachine } from '../ai/FiniteStateMachine.js';
import { Health } from './Health.js';
import { distanceXZ } from '../ai/Steering.js';

export class Boss {

	constructor( world, cfg, position ) {
		this.world = world;
		this.cfg = cfg;
		this.isEnemy = true;
		this.isBoss = true;
		this.radius = 1.6 * cfg.scale;

		this.health = new Health( cfg.health, 0 );
		this.position = position.clone();
		this.velocity = new THREE.Vector3();
		this.yaw = 0;

		this.phaseIndex = 0;
		this.phase = cfg.phases[ 0 ];
		this._attackTimer = 2;
		this._telegraphTimer = 0;
		this._pendingAttack = null;

		this.mesh = this._buildMesh();
		world.scene.add( this.mesh );

		this.fsm = new FiniteStateMachine( this );
		this.fsm.addStates( [
			{ name: 'approach', update: ( self, dt ) => self._approach( dt ) },
			{ name: 'telegraph', update: ( self, dt ) => self._telegraph( dt ) },
			{ name: 'recover', update: ( self, dt ) => self._recover( dt ) },
			{ name: 'dead' },
		] );
		this.fsm.start( 'approach' );

		world.hud.showBossBar( cfg.name );
	}

	_buildMesh() {
		const group = new THREE.Group();
		const geo = new THREE.DodecahedronGeometry( 1.1 * this.cfg.scale, 1 );
		const mat = new THREE.MeshStandardMaterial( { color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: 0.7, roughness: 0.45, metalness: 0.2 } );
		const core = new THREE.Mesh( geo, mat );
		core.position.y = 1.1 * this.cfg.scale;
		core.castShadow = true;
		group.add( core );
		this._mat = mat;
		this._core = core;

		const auraGeo = new THREE.SphereGeometry( 1.5 * this.cfg.scale, 16, 12 );
		const auraMat = new THREE.MeshBasicMaterial( { color: this.cfg.color, transparent: true, opacity: 0.12, depthWrite: false } );
		const aura = new THREE.Mesh( auraGeo, auraMat );
		aura.position.copy( core.position );
		group.add( aura );
		this._aura = aura;

		return group;
	}

	_updatePhase() {
		const frac = this.health.healthFrac;
		for ( const p of this.cfg.phases ) {
			if ( frac <= p.hpAbove || p === this.cfg.phases[ this.cfg.phases.length - 1 ] ) {
				if ( p !== this.phase && frac <= p.hpAbove ) {
					this.phase = p;
					this.world.effects.deathBurst( this.position.x, this.position.y + 2, this.position.z, p.tint || this.cfg.color );
					this.world.hud.flashBossPhase?.( p.name );
					if ( p.tint ) this._mat.emissive.setHex( p.tint );
				}
			}
		}
	}

	_approach( dt ) {
		const player = this.world.player;
		if ( ! player ) return;
		const dist = distanceXZ( this.position, player.position );
		this.yaw = Math.atan2( player.position.x - this.position.x, player.position.z - this.position.z );
		if ( dist > 3.5 ) {
			this.velocity.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) ).multiplyScalar( this.phase.moveSpeed );
		} else {
			this.velocity.set( 0, 0, 0 );
		}

		this._attackTimer -= dt;
		if ( this._attackTimer <= 0 ) {
			const attackId = this.phase.attacks[ Math.floor( Math.random() * this.phase.attacks.length ) ];
			this._pendingAttack = attackId;
			const data = this.cfg.attacksData[ attackId ];
			this._telegraphTimer = data.telegraph;
			this._mat.emissiveIntensity = 1.6;
			this.fsm.transition( 'telegraph' );
		}
	}

	_telegraph( dt ) {
		this.velocity.set( 0, 0, 0 );
		this._telegraphTimer -= dt;
		this._aura.scale.setScalar( 1 + ( 1 - Math.max( 0, this._telegraphTimer ) ) * 0.5 );
		if ( this._telegraphTimer <= 0 ) {
			this.world.onBossAttack?.( this, this._pendingAttack, this.cfg.attacksData[ this._pendingAttack ], this.phase.damageMult || 1 );
			this._mat.emissiveIntensity = 0.7;
			this._aura.scale.setScalar( 1 );
			this.fsm.transition( 'recover' );
		}
	}

	_recover( dt ) {
		this.velocity.set( 0, 0, 0 );
		const [ min, max ] = this.phase.attackInterval;
		if ( this.fsm.timeInState > 0.4 ) {
			this._attackTimer = min + Math.random() * ( max - min );
			this.fsm.transition( 'approach' );
		}
	}

	update( dt ) {
		this.health.update( dt );
		if ( ! this.health.alive ) { this._onDeath(); return; }
		this._updatePhase();
		this.fsm.update( dt );
		this.position.addScaledVector( this.velocity, dt );
		this.mesh.position.copy( this.position );
		this.mesh.rotation.y = this.yaw;

		this.world.hud.updateBossBar?.( this.health.healthFrac );
	}

	takeDamage( amount, opts = {} ) {
		this.health.applyElement( opts.element );
		return this.health.damage( amount );
	}

	_onDeath() {
		if ( this.fsm.is( 'dead' ) ) return;
		this.fsm.transition( 'dead' );
		this.world.effects.deathBurst( this.position.x, this.position.y + 2, this.position.z, this.cfg.color );
		this.mesh.visible = false;
		this.world.hud.hideBossBar();
		this.world.onBossKilled?.( this );
	}
}
