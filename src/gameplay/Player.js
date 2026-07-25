// Gameplay/Player.js
// The controllable hero. Movement + camera-relative aiming, ATP resource
// management (spend on shots/skills, regen over time, restored by
// pickups), and the five-part hero kit (primary/secondary/active/
// passive/ultimate) all live here, reading stats from Core/Config.

import * as THREE from 'three';
import { Health } from './Health.js';
import { WeaponController } from './Weapons.js';
import { eventBus } from '../core/EventBus.js';

export class Player {

	constructor( world, heroConfig ) {
		this.world = world;
		this.heroConfig = heroConfig;
		this.isEnemy = false;

		this.position = new THREE.Vector3( 0, 0, 0 );
		this.yaw = 0;
		this.radius = 0.5;

		this.health = new Health( heroConfig.maxHealth, heroConfig.maxShield );

		this.maxATP = heroConfig.maxATP;
		this.atp = heroConfig.maxATP;
		this.moveSpeed = heroConfig.moveSpeed;

		this.mods = {}; // populated by roguelike upgrades: critChance, element, ricochetChance, ...

		this.dodgeCooldown = 0;
		this.dodging = false;
		this._dodgeTimer = 0;
		this._dodgeDir = new THREE.Vector3();

		this.activeCooldown = 0;
		this.ultimateCharge = 0; // 0..100, fills from dealing damage
		this.ultimateCooldown = 0;
		this.ultimateActive = false;
		this._ultimateTimer = 0;
		this._ultCastPos = null;

		this.activeSkillState = null; // e.g. 'focusZoom' while the sniper's focus is up
		this._focusTimer = 0;
		this.tempCritBonus = 0;

		this._speedBoostTimer = 0;
		this._speedBoostMult = 1;

		this._damageReductionMult = 0; // from Guardian's aegisField / fortressProtocol
		this._reflectFrac = 0;
		this._buffTimer = 0;

		this.weapons = new WeaponController( this, world );

		this.mesh = this._buildMesh();
		world.scene.add( this.mesh );

		this._invulnTimer = 0;
	}

	get maxHealthLive() { return this.health.maxHealth; }
	set maxHealth( v ) { if ( this.health ) this.health.maxHealth = v; else this._maxHealthPending = v; }
	get maxHealth() { return this.health ? this.health.maxHealth : this._maxHealthPending; }
	set maxShield( v ) { if ( this.health ) this.health.maxShield = v; else this._maxShieldPending = v; }
	get maxShield() { return this.health ? this.health.maxShield : this._maxShieldPending; }

	_buildMesh() {
		const group = new THREE.Group();
		const bodyGeo = new THREE.CapsuleGeometry( 0.4, 0.9, 4, 8 );
		const bodyMat = new THREE.MeshStandardMaterial( {
			color: this.heroConfig.color, emissive: this.heroConfig.color, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3,
		} );
		const body = new THREE.Mesh( bodyGeo, bodyMat );
		body.position.y = 0.95;
		body.castShadow = true;
		group.add( body );

		const visorGeo = new THREE.ConeGeometry( 0.18, 0.4, 8 );
		const visorMat = new THREE.MeshStandardMaterial( { color: this.heroConfig.accentColor, emissive: this.heroConfig.accentColor, emissiveIntensity: 1.2 } );
		const visor = new THREE.Mesh( visorGeo, visorMat );
		visor.rotation.x = Math.PI / 2;
		visor.position.set( 0, 1.4, 0.35 );
		group.add( visor );

		this._shieldMesh = new THREE.Mesh(
			new THREE.SphereGeometry( 0.85, 16, 12 ),
			new THREE.MeshBasicMaterial( { color: 0x66ccff, transparent: true, opacity: 0.18, depthWrite: false } )
		);
		this._shieldMesh.position.y = 1;
		group.add( this._shieldMesh );

		return group;
	}

	spendATP( amount ) { this.atp = Math.max( 0, this.atp - amount ); }
	restoreATP( amount ) { this.atp = Math.min( this.maxATP, this.atp + amount ); }

	get moveSpeedEffective() {
		let speed = this.moveSpeed;
		const passive = this.heroConfig.passive;
		if ( passive.id === 'adrenaline' && this.health.healthFrac < passive.hpThreshold ) speed *= ( 1 + passive.speedBonus );
		if ( this.activeSkillState === 'focusZoom' ) speed *= ( 1 - this.heroConfig.active.moveSlow );
		if ( this._speedBoostTimer > 0 ) speed *= this._speedBoostMult;
		if ( this.health.isSlowed ) speed *= 0.5;
		return speed;
	}

	update( dt, input, camYaw ) {
		if ( this._invulnTimer > 0 ) { this._invulnTimer -= dt; this.health.invulnerable = this._invulnTimer > 0; }
		this.health.update( dt );

		// ATP regen (modified by upgrades)
		const regenMult = this.mods.atpRegenMult || 1;
		this.restoreATP( this.heroConfig.atpRegen * regenMult * dt );

		// cooldowns
		if ( this.dodgeCooldown > 0 ) this.dodgeCooldown -= dt;
		if ( this.activeCooldown > 0 ) this.activeCooldown -= dt;
		if ( this.ultimateCooldown > 0 ) this.ultimateCooldown -= dt;

		if ( this._focusTimer > 0 ) {
			this._focusTimer -= dt;
			if ( this._focusTimer <= 0 ) { this.tempCritBonus = 0; if ( this.activeSkillState === 'focusZoom' ) this.activeSkillState = null; }
		}
		if ( this._speedBoostTimer > 0 ) { this._speedBoostTimer -= dt; if ( this._speedBoostTimer <= 0 ) this._speedBoostMult = 1; }
		if ( this._buffTimer > 0 ) {
			this._buffTimer -= dt;
			if ( this._buffTimer <= 0 ) { this._damageReductionMult = 0; this._reflectFrac = 0; }
		}

		this._updateMovement( dt, input, camYaw );
		this._updateSkills( dt, input );

		this.mesh.position.copy( this.position );
		this.mesh.rotation.y = this.yaw;
		this._shieldMesh.visible = this.health.shield > 0;
		this._shieldMesh.scale.setScalar( 1 + Math.sin( performance.now() * 0.005 ) * 0.02 );

		this.weapons.update( dt, input, this.world.getAllTargets() );

		if ( ! this.health.alive ) eventBus.emit( 'player:died', this );
	}

	_updateMovement( dt, input, camYaw ) {
		this.yaw = camYaw;

		if ( this.dodging ) {
			this._dodgeTimer -= dt;
			const t = Math.max( 0, this._dodgeTimer );
			this.position.addScaledVector( this._dodgeDir, dt * ( this.heroConfig.dodgeDistance / 0.28 ) );
			if ( t <= 0 ) this.dodging = false;
			return;
		}

		const moveVec = new THREE.Vector3( input.moveX, 0, input.moveZ );
		if ( moveVec.lengthSq() > 0 ) {
			moveVec.normalize();
			const forward = new THREE.Vector3( Math.sin( camYaw ), 0, Math.cos( camYaw ) );
			const right = new THREE.Vector3( Math.cos( camYaw ), 0, -Math.sin( camYaw ) );
			const world = new THREE.Vector3()
				.addScaledVector( right, moveVec.x )
				.addScaledVector( forward, -moveVec.z );
			const sprintMult = ( input.sprint && this.atp > 5 ) ? this.heroConfig.sprintMult : 1;
			this.position.addScaledVector( world, this.moveSpeedEffective * sprintMult * dt );
			if ( input.sprint ) this.spendATP( 4 * dt );
		}

		if ( input.dodge && this.dodgeCooldown <= 0 && this.atp >= this.heroConfig.dodgeCost ) {
			this.spendATP( this.heroConfig.dodgeCost );
			this.dodgeCooldown = 1.1;
			this.dodging = true;
			this._dodgeTimer = 0.28;
			this._invulnTimer = 0.28;
			const dir = moveVec.lengthSq() > 0 ? moveVec.clone() : new THREE.Vector3( 0, 0, 1 );
			const forward = new THREE.Vector3( Math.sin( camYaw ), 0, Math.cos( camYaw ) );
			const right = new THREE.Vector3( Math.cos( camYaw ), 0, -Math.sin( camYaw ) );
			this._dodgeDir.set( 0, 0, 0 ).addScaledVector( right, dir.x ).addScaledVector( forward, -dir.z ).normalize();
		}
	}

	_updateSkills( dt, input ) {
		const active = this.heroConfig.active;
		const ultimate = this.heroConfig.ultimate;
		const cdMult = this.mods.cooldownMult || 1;

		if ( input.skillActive && this.activeCooldown <= 0 && this.atp >= active.atpCost ) {
			this.spendATP( active.atpCost );
			this.activeCooldown = active.cooldown * cdMult;
			this.world.onHeroActiveSkill?.( this, active );
		}

		if ( input.skillUltimate && this.ultimateCooldown <= 0 && this.ultimateCharge >= 100 ) {
			this.ultimateCharge = 0;
			this.ultimateCooldown = ultimate.cooldown * cdMult;
			this.ultimateActive = true;
			this._ultimateTimer = ultimate.duration || 3;
			this.world.onHeroUltimate?.( this, ultimate );
		}
		if ( this.ultimateActive ) {
			this._ultimateTimer -= dt;
			if ( this._ultimateTimer <= 0 ) this.ultimateActive = false;
		}
	}

	gainUltimateCharge( amount ) {
		const mult = this.mods.ultChargeMult || 1;
		this.ultimateCharge = Math.min( 100, this.ultimateCharge + amount * mult );
	}

	// Used by Guardian's aegisField (secondary) and fortressProtocol (ultimate) —
	// stacks take the stronger of the two rather than adding, so recasting
	// doesn't runaway-stack defense.
	applyTimedDefensiveBuff( { damageReductionMult = 0, reflectFrac = 0 } = {}, duration ) {
		this._damageReductionMult = Math.max( this._damageReductionMult, damageReductionMult );
		this._reflectFrac = Math.max( this._reflectFrac, reflectFrac );
		this._buffTimer = Math.max( this._buffTimer, duration );
	}

	applyUpgrade( upgrade ) {
		upgrade.apply( this );
		eventBus.emit( 'player:upgrade', upgrade );
	}

	// opts: { source, element, isCrit } — element is ignored (status effects
	// are an enemy-only mechanic in this build), source is what to reflect
	// damage back onto if fortressProtocol/aegisField reflect is active.
	takeDamage( amount, opts = {} ) {
		const reduced = amount * ( 1 - this._damageReductionMult );
		const dealt = this.health.damage( reduced );
		if ( dealt > 0 ) {
			eventBus.emit( 'player:damaged', { amount: dealt, source: opts.source } );
			if ( this._reflectFrac > 0 && opts.source?.health?.alive ) {
				opts.source.health.damage( dealt * this._reflectFrac );
			}
		}
		return dealt;
	}

	get isDead() { return ! this.health.alive; }
}
