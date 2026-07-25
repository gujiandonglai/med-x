// Gameplay/Weapons.js
// Turns a hero's `primary`/`secondary` config block into actual fire
// behavior. Ranged weapons spawn pooled projectiles; melee weapons
// (scalpel) do an immediate arc-overlap check against nearby targets.

import * as THREE from 'three';
import { circlesOverlap } from '../physics/Collision.js';

export class WeaponController {

	constructor( player, world ) {
		this.player = player;
		this.world = world;
		this.primaryCooldown = 0;
		this.secondaryCooldown = 0;
	}

	get muzzlePosition() {
		const p = this.player;
		const forward = new THREE.Vector3( Math.sin( p.yaw ), 0, Math.cos( p.yaw ) );
		return p.position.clone().add( forward.multiplyScalar( 0.8 ) ).setY( p.position.y + 1.2 );
	}

	get aimDirection() {
		const p = this.player;
		return new THREE.Vector3( Math.sin( p.yaw ), 0, Math.cos( p.yaw ) );
	}

	update( dt, input, targets ) {
		if ( this.primaryCooldown > 0 ) this.primaryCooldown -= dt;
		if ( this.secondaryCooldown > 0 ) this.secondaryCooldown -= dt;

		const p = this.player;
		const cfg = p.heroConfig.primary;

		if ( input.fire && this.primaryCooldown <= 0 ) {
			if ( cfg.melee ) this._fireMelee( cfg, targets );
			else this._fireRanged( cfg, this.aimDirection, false );
		}

		if ( input.skillPrimary && this.secondaryCooldown <= 0 ) {
			this._fireSecondary( p.heroConfig.secondary, targets );
		}
	}

	_canAfford( atpCost ) {
		return this.player.atp >= atpCost;
	}

	_fireRanged( cfg, direction, isEnemy, overrides = {} ) {
		const p = this.player;
		if ( ! isEnemy && ! this._canAfford( cfg.atpCost ) ) return;
		if ( ! isEnemy ) { p.spendATP( cfg.atpCost ); this.primaryCooldown = 1 / cfg.fireRate; }

		const mods = p.mods || {};
		const spread = cfg.spread || 0;
		const dir = direction.clone();
		dir.x += ( Math.random() - 0.5 ) * spread;
		dir.z += ( Math.random() - 0.5 ) * spread;

		this.world.projectiles.spawn( {
			position: this.muzzlePosition,
			direction: dir,
			speed: cfg.projSpeed,
			damage: ( cfg.damage + ( mods.flatDamageBonus || 0 ) ) * ( isEnemy ? 1 : ( 1 + ( mods.damageMult || 0 ) ) ),
			pierce: ( cfg.pierce || 0 ) + ( isEnemy ? 0 : ( mods.pierceBonus || 0 ) ),
			radius: 0.12,
			color: cfg.color || 0xffffff,
			owner: p,
			isEnemyProjectile: isEnemy,
			element: isEnemy ? null : mods.element,
			critChance: isEnemy ? 0 : ( ( mods.critChance || 0.05 ) + ( p.tempCritBonus || 0 ) ),
			critMult: cfg.critMult || 1.5,
			ricochetChance: isEnemy ? 0 : ( mods.ricochetChance || 0 ),
			...overrides,
		} );

		this.world.effects.muzzleFlash( this.muzzlePosition.x, this.muzzlePosition.y, this.muzzlePosition.z, cfg.color );
	}

	_fireMelee( cfg, targets ) {
		const p = this.player;
		if ( ! this._canAfford( cfg.atpCost ) ) return;
		p.spendATP( cfg.atpCost );
		this.primaryCooldown = 1 / cfg.fireRate;

		const mods = p.mods || {};
		const origin = p.position;
		const forward = this.aimDirection;
		let hitAny = false;
		for ( const t of targets ) {
			if ( t.isEnemy !== true ) continue;
			if ( ! t.health?.alive ) continue;
			const toTarget = new THREE.Vector3( t.position.x - origin.x, 0, t.position.z - origin.z );
			const dist = toTarget.length();
			if ( dist > cfg.range + ( t.radius || 0.5 ) ) continue;
			toTarget.normalize();
			const angle = forward.angleTo( toTarget );
			if ( angle > cfg.arc ) continue;

			let dmg = ( cfg.damage + ( mods.flatDamageBonus || 0 ) ) * ( 1 + ( mods.damageMult || 0 ) );
			const isCrit = Math.random() < ( ( mods.critChance || 0.05 ) + ( p.tempCritBonus || 0 ) );
			if ( isCrit ) dmg *= 1.5;
			const dealt = t.takeDamage ? t.takeDamage( dmg, { element: mods.element, isCrit, source: p } ) : t.health.damage( dmg );
			this.world.effects.hitSpark( t.position.x, 1, t.position.z, isCrit ? 0xffe45c : cfg.color );
			hitAny = true;
			this.world.onEnemyDamaged?.( t, dealt, isCrit );
		}
		if ( hitAny ) this.world.effects.muzzleFlash( origin.x, 1.2, origin.z, cfg.color );
	}

	_fireSecondary( cfg, targets ) {
		const p = this.player;
		if ( ! this._canAfford( cfg.atpCost ) ) return;
		p.spendATP( cfg.atpCost );
		this.secondaryCooldown = cfg.cooldown * ( p.mods.cooldownMult || 1 );

		if ( cfg.id === 'grenade' ) {
			this._fireRanged( { ...cfg, spread: 0.02, pierce: 0 }, this.aimDirection, false, { radius: 0.22, maxLife: 1.6 } );
		} else if ( cfg.id === 'markerDart' ) {
			this._fireRanged( { ...cfg, spread: 0.01 }, this.aimDirection, false, { radius: 0.1 } );
		} else if ( cfg.id === 'aegisField' ) {
			this.world.onGuardianField?.( p, cfg );
		}
	}
}
