// Gameplay/UpgradeSystem.js
// Rolls the post-combat 3-choice upgrade offer. Keeps a per-run history so
// the same upgrade doesn't show up over and over, and weights rarity so
// 'rare' upgrades (elemental damage, cooldown reduction) are a genuine
// treat rather than as common as flat stat bumps.

import { UPGRADES } from '../core/Config.js';

const RARITY_WEIGHT = { common: 3, rare: 1 };

export class UpgradeSystem {

	constructor() {
		this.taken = new Set(); // upgrade ids already chosen this run
	}

	reset() { this.taken.clear(); }

	rollChoices( count = 3 ) {
		const pool = UPGRADES.filter( ( u ) => {
			// elemental upgrades are mutually exclusive with each other but
			// otherwise everything can be re-offered (stacking upgrades).
			if ( u.id.startsWith( 'elem' ) && this.taken.has( u.id ) ) return false;
			return true;
		} );

		const weighted = [];
		for ( const u of pool ) {
			const w = RARITY_WEIGHT[ u.rarity ] || 1;
			for ( let i = 0; i < w; i ++ ) weighted.push( u );
		}

		const choices = [];
		const usedIds = new Set();
		let guard = 0;
		while ( choices.length < count && guard < 200 ) {
			guard ++;
			const pick = weighted[ Math.floor( Math.random() * weighted.length ) ];
			if ( ! pick || usedIds.has( pick.id ) ) continue;
			usedIds.add( pick.id );
			choices.push( pick );
		}
		return choices;
	}

	markTaken( upgrade ) { this.taken.add( upgrade.id ); }
}
