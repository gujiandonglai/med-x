// Gameplay/Enemy.js
// One class covers every non-boss virus type; behavior branches off the
// `behavior` field in Core/Config.ENEMIES rather than needing a subclass
// per enemy, since a data-driven FSM is enough to express melee/suicide/
// stealth/shielded/parasite/support without code duplication.

import * as THREE from 'three';
import { FiniteStateMachine } from '../ai/FiniteStateMachine.js';
import { Health } from './Health.js';
import { seek, distanceXZ } from '../ai/Steering.js';

const geoCache = new Map();
function enemyGeometry( scale ) {
	const key = Math.round( scale * 100 );
	if ( ! geoCache.has( key ) ) geoCache.set( key, new THREE.IcosahedronGeometry( 0.5 * scale, 1 ) );
	return geoCache.get( key );
}

let _idCounter = 0;

// NOTE: Enemy instances are pooled per-type by World (see World.spawnEnemy /
// World._getEnemyPool) — the constructor builds the mesh/FSM ONCE, and
// `reset()` is what actually (re)primes an instance for a fresh spawn. This
// is what Core/ObjectPool expects: a cheap factory + a cheap reset.
export class Enemy {

	constructor( world, cfg ) {
		this.world = world;
		this.cfg = cfg;
		this.id = ++ _idCounter;
		this.isEnemy = true;
		this.radius = 0.5 * cfg.scale;

		this.position = new THREE.Vector3();
		this.velocity = new THREE.Vector3();
		this.yaw = 0;
		this.health = new Health( cfg.health, cfg.elite ? cfg.health * 0.15 : 0 );

		this.mesh = this._buildMesh();
		world.scene.add( this.mesh );

		this.fsm = this._buildFSM();
		this.reset( new THREE.Vector3() );
	}

	// Called by the pool on every (re)spawn instead of the constructor.
	reset( position ) {
		const cfg = this.cfg;
		this.position.copy( position );
		this.velocity.set( 0, 0, 0 );
		this.yaw = 0;

		this.health.maxHealth = cfg.health;
		this.health.revive( 1 );
		this.health.maxShield = cfg.elite ? cfg.health * 0.15 : 0;
		this.health.shield = this.health.maxShield;
		for ( const k in this.health.status ) this.health.status[ k ] = 0;

		this.state = {};
		this._attackTimer = Math.random() * 0.5;
		this._fuseTimer = 0;
		this._cloakTimer = 0;
		this._shieldHp = cfg.shieldHealth || 0;
		this._shieldRegenTimer = 0;
		this._healCooldown = 0;

		this._bodyMat.opacity = 1;
		this._bodyMat.emissiveIntensity = cfg.elite ? 0.9 : 0.45;
		this.mesh.visible = true;
		this.mesh.position.copy( this.position );

		this.fsm.start( 'chase' );
	}

	_buildMesh() {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial( {
			color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: this.cfg.elite ? 0.9 : 0.45,
			roughness: 0.5, metalness: 0.1, transparent: true, opacity: 1,
		} );
		const body = new THREE.Mesh( enemyGeometry( this.cfg.scale ), mat );
		body.position.y = 0.5 * this.cfg.scale;
		body.castShadow = true;
		group.add( body );
		this._bodyMat = mat;
		this._bodyMesh = body;

		if ( this.cfg.behavior === 'shielded' ) {
			const shieldGeo = new THREE.SphereGeometry( 0.5 * this.cfg.scale * 1.35, 12, 10 );
			const shieldMat = new THREE.MeshBasicMaterial( { color: 0x5fd6c8, transparent: true, opacity: 0.25, depthWrite: false } );
			this._shieldMesh = new THREE.Mesh( shieldGeo, shieldMat );
			this._shieldMesh.position.y = 0.5 * this.cfg.scale;
			group.add( this._shieldMesh );
		}
		return group;
	}

	_buildFSM() {
		const fsm = new FiniteStateMachine( this );
		const cfg = this.cfg;

		fsm.addStates( [
			{
				name: 'chase',
				update: ( self, dt ) => {
					const player = self.world.player;
					if ( ! player || player.isDead ) return;
					const dist = distanceXZ( self.position, player.position );
					if ( cfg.behavior === 'stealth' ) {
						self._cloakTimer += dt;
						const revealed = dist < cfg.revealRadius;
						self._bodyMat.opacity = revealed ? 1 : cfg.cloakOpacity;
					}
					if ( dist <= cfg.attackRange ) { fsm.transition( 'attack' ); return; }
					const speed = self.health.isSlowed ? cfg.speed * 0.5 : cfg.speed;
					const steer = seek( self.position, player.position, speed );
					self.velocity.copy( steer );
					self.yaw = Math.atan2( player.position.x - self.position.x, player.position.z - self.position.z );
				},
			},
			{
				name: 'attack',
				enter: ( self ) => { self.velocity.set( 0, 0, 0 ); },
				update: ( self, dt ) => {
					const player = self.world.player;
					if ( ! player || player.isDead ) return;
					const dist = distanceXZ( self.position, player.position );
					if ( dist > cfg.attackRange * 1.3 ) { fsm.transition( 'chase' ); return; }

					self._attackTimer -= dt;
					if ( self._attackTimer <= 0 ) {
						self._attackTimer = cfg.attackCooldown;
						self.world.onEnemyAttack?.( self, player );
					}
				},
			},
			{
				name: 'fuse', // boomVirus
				enter: ( self ) => { self._fuseTimer = cfg.fuseTime; },
				update: ( self, dt ) => {
					self._fuseTimer -= dt;
					self._bodyMat.emissiveIntensity = 0.5 + Math.sin( self._fuseTimer * 20 ) * 0.5;
					const player = self.world.player;
					if ( player && ! player.isDead ) self.velocity.copy( seek( self.position, player.position, cfg.speed * 1.3 ) );
					if ( self._fuseTimer <= 0 ) {
						self.world.onEnemyExplode?.( self );
						self.health.damage( self.health.maxHealth, { ignoreShield: true } );
					}
				},
			},
			{
				name: 'dead',
				enter: ( self ) => { self.velocity.set( 0, 0, 0 ); },
			},
		] );
		return fsm;
	}

	update( dt ) {
		this.health.update( dt );

		if ( this.cfg.behavior === 'shielded' ) {
			if ( this._shieldHp <= 0 ) {
				this._shieldRegenTimer -= dt;
				if ( this._shieldRegenTimer <= 0 ) this._shieldHp = this.cfg.shieldHealth;
			}
			if ( this._shieldMesh ) this._shieldMesh.visible = this._shieldHp > 0;
		}

		if ( this.cfg.behavior === 'suicide' && this.fsm.is( 'chase' ) ) {
			const player = this.world.player;
			if ( player && distanceXZ( this.position, player.position ) < this.cfg.attackRange * 1.6 ) {
				this.fsm.transition( 'fuse' );
			}
		}

		if ( this.cfg.behavior === 'support' ) {
			this._healCooldown -= dt;
			if ( this._healCooldown <= 0 ) {
				this._healCooldown = this.cfg.attackCooldown;
				this.world.onSupportVirusHeal?.( this );
			}
		}

		if ( this.health.alive ) this.fsm.update( dt );

		this.position.addScaledVector( this.velocity, dt );
		this.mesh.position.copy( this.position );
		this.mesh.rotation.y = this.yaw;

		if ( ! this.health.alive && this.mesh.visible ) this._playDeath();
	}

	takeDamage( amount, opts = {} ) {
		this.health.applyElement( opts.element );
		if ( this.cfg.behavior === 'shielded' && this._shieldHp > 0 ) {
			const absorbed = Math.min( this._shieldHp, amount );
			this._shieldHp -= absorbed;
			this._shieldRegenTimer = this.cfg.shieldRegenDelay;
			amount -= absorbed;
			if ( amount <= 0 ) return absorbed;
		}
		return this.health.damage( amount );
	}

	_playDeath() {
		this.world.effects.deathBurst( this.position.x, this.position.y + 0.5, this.position.z, this.cfg.color );
		this.world.onEnemyKilled?.( this );
		this.die( true );
	}

	die( immediate ) {
		this.health.alive = false;
		this.mesh.visible = false;
		this.world.removeEnemy( this );
	}
}
