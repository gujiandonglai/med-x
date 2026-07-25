// Gameplay/Health.js
// Shared health+shield component used by Player, Enemy, Boss and
// Ecosystem agents alike. Shields absorb damage before health does.
// Also carries elemental status effects (freeze/burn/shock/corrode) so a
// single system handles every "attack applies element X" upgrade.

export class Health {

	constructor( maxHealth, maxShield = 0 ) {
		this.maxHealth = maxHealth;
		this.health = maxHealth;
		this.maxShield = maxShield;
		this.shield = maxShield;
		this.alive = true;
		this.invulnerable = false;

		this.status = {
			burn: 0,       // seconds remaining, ticks damage
			freeze: 0,     // seconds remaining, slows movement
			shock: 0,      // seconds remaining, marks for chain damage
			corrode: 0,    // seconds remaining, reduces incoming-damage resistance (i.e. amplifies)
		};
		this.burnDps = 4;
	}

	get healthFrac() { return this.maxHealth > 0 ? this.health / this.maxHealth : 0; }
	get isSlowed() { return this.status.freeze > 0; }

	applyElement( element ) {
		if ( ! element ) return;
		if ( element === 'freeze' ) this.status.freeze = Math.max( this.status.freeze, 2.5 );
		else if ( element === 'burn' ) this.status.burn = Math.max( this.status.burn, 3 );
		else if ( element === 'shock' ) this.status.shock = Math.max( this.status.shock, 2 );
		else if ( element === 'corrode' ) this.status.corrode = Math.max( this.status.corrode, 4 );
	}

	// Returns the actual damage dealt (post-shield, post-corrode) so callers
	// can drive lifesteal / floating damage numbers accurately.
	damage( amount, { ignoreShield = false, isCrit = false } = {} ) {
		if ( ! this.alive || this.invulnerable ) return 0;
		let dmg = amount;
		if ( this.status.corrode > 0 ) dmg *= 1.25;

		let dealt = 0;
		if ( ! ignoreShield && this.shield > 0 ) {
			const fromShield = Math.min( this.shield, dmg );
			this.shield -= fromShield;
			dmg -= fromShield;
			dealt += fromShield;
		}
		if ( dmg > 0 ) {
			const fromHealth = Math.min( this.health, dmg );
			this.health -= fromHealth;
			dealt += fromHealth;
		}
		if ( this.health <= 0 ) { this.health = 0; this.alive = false; }
		return dealt;
	}

	heal( amount ) {
		if ( ! this.alive ) return 0;
		const before = this.health;
		this.health = Math.min( this.maxHealth, this.health + amount );
		return this.health - before;
	}

	rechargeShield( amount ) {
		this.shield = Math.min( this.maxShield, this.shield + amount );
	}

	update( dt ) {
		if ( this.status.burn > 0 ) {
			this.damage( this.burnDps * dt, { ignoreShield: true } );
			this.status.burn -= dt;
		}
		if ( this.status.freeze > 0 ) this.status.freeze -= dt;
		if ( this.status.shock > 0 ) this.status.shock -= dt;
		if ( this.status.corrode > 0 ) this.status.corrode -= dt;
	}

	revive( healthFrac = 1 ) {
		this.alive = true;
		this.health = this.maxHealth * healthFrac;
	}
}
