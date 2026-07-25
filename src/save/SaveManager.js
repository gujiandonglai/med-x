// Save/SaveManager.js
// Handles three kinds of persisted data:
//   1. Settings (language, music/sfx volume) — read at boot, before any run.
//   2. Meta-progression (unlocked heroes, bestiary, best results).
//   3. Run snapshot — an in-progress run, written at checkpoints (room
//      cleared, upgrade chosen, manual pause-menu save) so "继续游戏 /
//      Continue" can restore exactly where the player left off.
//
// STORAGE BACKEND: tries `localStorage` first (real cross-session
// persistence when this build is self-hosted or opened locally) and
// transparently falls back to an in-memory object if localStorage throws
// — which it will inside a sandboxed preview iframe (e.g. Claude.ai's
// artifact viewer). In that fallback mode saves last only for the current
// page session, which is still enough for "Continue" to work within one
// sitting; only true reload-persistence requires running this outside
// that sandbox.

const SAVE_KEY = 'medx_save_v1';

const DEFAULT_SAVE = {
	settings: { language: 'zh', musicVolume: 0.6, sfxVolume: 0.8 },
	meta: {
		unlockedHeroes: [ 'assault', 'sniper', 'guardian' ],
		bestiary: [],
		bestKills: 0,
		bestActReached: 1,
		totalRuns: 0,
	},
	runState: null, // { heroId, actIndex, roomIndex, organHealth, kills, player: {...}, savedAt }
};

export class SaveManager {

	constructor() {
		this._memoryStore = {};
		this._localStorageOK = this._testLocalStorage();
		this.data = this._load();
	}

	_testLocalStorage() {
		try {
			const testKey = '__medx_test__';
			window.localStorage.setItem( testKey, '1' );
			window.localStorage.removeItem( testKey );
			return true;
		} catch ( e ) {
			return false;
		}
	}

	_read() {
		if ( this._localStorageOK ) {
			try { return window.localStorage.getItem( SAVE_KEY ); } catch ( e ) { this._localStorageOK = false; }
		}
		return this._memoryStore[ SAVE_KEY ] ?? null;
	}

	_write( str ) {
		if ( this._localStorageOK ) {
			try { window.localStorage.setItem( SAVE_KEY, str ); return; } catch ( e ) { this._localStorageOK = false; }
		}
		this._memoryStore[ SAVE_KEY ] = str;
	}

	_load() {
		const raw = this._read();
		if ( ! raw ) return structuredClone( DEFAULT_SAVE );
		try {
			const parsed = JSON.parse( raw );
			return {
				settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
				meta: { ...structuredClone( DEFAULT_SAVE.meta ), ...parsed.meta },
				runState: parsed.runState ?? null,
			};
		} catch ( e ) {
			console.warn( '[SaveManager] corrupt save, resetting', e );
			return structuredClone( DEFAULT_SAVE );
		}
	}

	commit() { this._write( JSON.stringify( this.data ) ); }

	// -- persistence backend info (surfaced by Settings UI if desired) --
	get isPersistent() { return this._localStorageOK; }

	// -- settings --
	getSettings() { return this.data.settings; }
	updateSettings( partial ) { Object.assign( this.data.settings, partial ); this.commit(); }

	// -- meta progression --
	unlockHero( id ) {
		if ( ! this.data.meta.unlockedHeroes.includes( id ) ) { this.data.meta.unlockedHeroes.push( id ); this.commit(); }
	}
	isHeroUnlocked( id ) { return this.data.meta.unlockedHeroes.includes( id ); }
	recordEnemySeen( id ) {
		if ( ! this.data.meta.bestiary.includes( id ) ) { this.data.meta.bestiary.push( id ); this.commit(); }
	}
	recordRunEnd( { actReached, kills } ) {
		this.data.meta.totalRuns ++;
		this.data.meta.bestActReached = Math.max( this.data.meta.bestActReached, actReached );
		this.data.meta.bestKills = Math.max( this.data.meta.bestKills, kills );
		this.commit();
	}

	// -- run snapshot (continue / manual save) --
	saveRunState( snapshot ) {
		this.data.runState = { ...snapshot, savedAt: Date.now() };
		this.commit();
	}
	loadRunState() { return this.data.runState; }
	hasRunState() { return !! this.data.runState; }
	clearRunState() { this.data.runState = null; this.commit(); }
}
