// Gameplay/RoomManager.js
// Drives the roguelike run structure: three acts (biomes), each a string
// of procedurally-typed rooms (combat/elite/supply/event/shop/hidden)
// capped by a boss room. Generates the room graph up front per act so the
// HUD can show run progress, then lazily builds/populates each room as
// the player enters it.

import * as THREE from 'three';
import { RUN_STRUCTURE, BIOMES, ENEMIES, BOSSES, ECOSYSTEM } from '../core/Config.js';
import { t } from '../core/I18n.js';
import { Boss } from './Boss.js';
import { EcosystemAgent } from './EcosystemAgents.js';
import { UpgradeSystem } from './UpgradeSystem.js';
import { eventBus } from '../core/EventBus.js';

const ROOMS_PER_ACT = 5;

const SPAWN_TABLES = {
	combat: [ 'normalVirus', 'normalVirus', 'splitVirus', 'boomVirus', 'stealthVirus' ],
	elite: [ 'eliteInfected', 'shieldVirus', 'parasiteVirus' ],
	hidden: [ 'shieldVirus', 'healerVirus' ],
};

export class RoomManager {

	constructor( world ) {
		this.world = world;
		this.upgrades = new UpgradeSystem();
		this.actIndex = 0;
		this.roomIndex = 0; // index within act's room list, ROOMS_PER_ACT == boss room
		this.roomGraph = [];
		this.currentRoomType = null;
		this.roomActive = false;
		this.organHealth = 100; // ecosystem "patient health" gauge, dinged by RBC loss
	}

	get biome() { return BIOMES[ RUN_STRUCTURE[ this.actIndex ] ]; }
	get isBossRoom() { return this.roomIndex >= ROOMS_PER_ACT; }
	get actNumber() { return this.actIndex + 1; }
	get roomNumber() { return this.roomIndex + 1; }

	startRun() {
		this.actIndex = 0;
		this.roomIndex = 0;
		this.organHealth = 100;
		this.upgrades.reset();
		this._generateActGraph();
		this.enterRoom();
	}

	_generateActGraph() {
		const weighted = [ 'combat', 'combat', 'combat', 'elite', 'supply', 'event', 'shop', 'hidden' ];
		this.roomGraph = [];
		for ( let i = 0; i < ROOMS_PER_ACT; i ++ ) {
			this.roomGraph.push( i === 0 ? 'combat' : weighted[ Math.floor( Math.random() * weighted.length ) ] );
		}
	}

	enterRoom() {
		this.world.clearRoomEntities();
		const biome = this.biome;
		this.world.sceneManager.applyBiome( biome );

		const roomType = this.isBossRoom ? 'boss' : this.roomGraph[ this.roomIndex ];
		this.currentRoomType = roomType;
		this.roomActive = true;
		this.world.audio.playBiomeMusic( biome, roomType === 'boss' );

		const layoutSeed = Math.random();
		const arenaRadius = roomType === 'boss' ? 22 : 15 + Math.random() * 3;
		this.world.environment.buildRoom( biome, { radius: arenaRadius, obstacleCount: roomType === 'boss' ? 2 : 4 + Math.floor( Math.random() * 4 ), seed: layoutSeed } );
		this.world.arenaRadius = arenaRadius;

		this._populateEcosystem( arenaRadius, roomType );
		this._populateEnemies( arenaRadius, roomType, biome );
		this._populatePickups( arenaRadius, roomType );

		this.world.hud.setRunProgress( this.actNumber, this.roomNumber, ROOMS_PER_ACT, t( `biomes.${biome.id}` ), roomType );
		eventBus.emit( 'room:enter', { act: this.actNumber, room: this.roomNumber, type: roomType } );

		if ( roomType === 'supply' || roomType === 'shop' || roomType === 'event' ) {
			// No combat gate — these rooms resolve immediately via HUD prompt,
			// player can walk to the exit prompt to continue.
			this.world.hud.showRoomReward( roomType, () => this.completeRoom( false ) );
		}
	}

	_populateEcosystem( arenaRadius, roomType ) {
		const counts = roomType === 'boss'
			? { redBloodCell: 5, whiteBloodCell: 3, platelet: 2, macrophage: 1, dendriticCell: 1 }
			: { redBloodCell: 4, whiteBloodCell: 2, platelet: 1, macrophage: 1, dendriticCell: 1 };

		for ( const kind in counts ) {
			for ( let i = 0; i < counts[ kind ]; i ++ ) {
				const pos = this._randomPointInArena( arenaRadius * 0.8 );
				this.world.addEcosystemAgent( new EcosystemAgent( this.world, kind, ECOSYSTEM[ kind ], pos ) );
			}
		}
	}

	_populateEnemies( arenaRadius, roomType, biome ) {
		if ( roomType === 'boss' ) {
			const bossCfg = { ...BOSSES[ biome.bossId ], color: biome.keyColor };
			const boss = new Boss( this.world, bossCfg, new THREE.Vector3( 0, 0, -arenaRadius * 0.5 ) );
			this.world.addEnemy( boss );
			return;
		}
		if ( roomType === 'supply' || roomType === 'shop' ) return;

		const table = SPAWN_TABLES[ roomType ] || SPAWN_TABLES.combat;
		const count = roomType === 'elite' ? 2 + Math.floor( Math.random() * 2 )
			: roomType === 'event' ? 1
			: roomType === 'hidden' ? 1 + Math.floor( Math.random() * 2 )
			: 4 + Math.floor( Math.random() * 3 );

		for ( let i = 0; i < count; i ++ ) {
			const id = table[ Math.floor( Math.random() * table.length ) ];
			const pos = this._randomPointInArena( arenaRadius * 0.85, 6 );
			this.world.spawnEnemy( ENEMIES[ id ], pos );
		}
	}

	_populatePickups( arenaRadius, roomType ) {
		if ( roomType === 'shop' || roomType === 'event' ) return;
		if ( roomType === 'supply' ) {
			for ( let i = 0; i < 4; i ++ ) this.world.spawnPickup( 'glucose', this._randomPointInArena( arenaRadius * 0.7 ) );
			if ( Math.random() < 0.5 ) this.world.spawnPickup( 'mitochondria', this._randomPointInArena( arenaRadius * 0.5 ) );
			return;
		}
		const count = roomType === 'boss' ? 3 : 2;
		for ( let i = 0; i < count; i ++ ) {
			const kind = Math.random() < 0.7 ? 'glucose' : 'lipid';
			this.world.spawnPickup( kind, this._randomPointInArena( arenaRadius * 0.7 ) );
		}
	}

	_randomPointInArena( radius, minDist = 0 ) {
		let x, z, d;
		do {
			const ang = Math.random() * Math.PI * 2;
			const dist = minDist + Math.random() * ( radius - minDist );
			x = Math.sin( ang ) * dist; z = Math.cos( ang ) * dist;
			d = Math.sqrt( x * x + z * z );
		} while ( d < minDist );
		return new THREE.Vector3( x, 0, z );
	}

	// Called by World when the room's hostile spawns are all cleared.
	onCombatCleared() {
		if ( ! this.roomActive ) return;
		this.roomActive = false;
		if ( this.currentRoomType === 'boss' ) {
			this.completeRoom( false );
			this._advanceAct();
			return;
		}
		this.completeRoom( true );
	}

	completeRoom( offerUpgrade ) {
		eventBus.emit( 'room:cleared', { act: this.actNumber, room: this.roomNumber } );
		if ( offerUpgrade ) {
			this.world.requestUpgradeChoice();
		} else {
			this._goToNextRoom();
		}
	}

	rollUpgradeChoices() { return this.upgrades.rollChoices( 3 ); }

	chooseUpgrade( upgrade ) {
		this.world.player.applyUpgrade( upgrade );
		this.upgrades.markTaken( upgrade );
		this._goToNextRoom();
	}

	_goToNextRoom() {
		this.roomIndex ++;
		if ( this.roomIndex > ROOMS_PER_ACT ) {
			// Expected right after a boss kill: completeRoom(false) already
			// incremented past the act's last room. onCombatCleared() calls
			// _advanceAct() immediately after this, which resets roomIndex
			// properly — this guard just stops us from entering a room here.
			return;
		}
		this.world.transitionToRoom();
	}

	_advanceAct() {
		this.actIndex ++;
		if ( this.actIndex >= RUN_STRUCTURE.length ) {
			this.world.onRunVictory();
			return;
		}
		this.roomIndex = 0;
		this._generateActGraph();
		this.world.transitionToRoom();
	}

	damageOrganHealth( amount ) {
		this.organHealth = Math.max( 0, this.organHealth - amount );
		this.world.hud.setOrganHealth( this.organHealth );
		if ( this.organHealth <= 0 ) this.world.onOrganHealthDepleted();
	}

	// -- run snapshot (used by World for the "存档 / Save Data" + "继续游戏 / Continue" flow) --
	getSnapshot() {
		return {
			actIndex: this.actIndex,
			roomIndex: this.roomIndex,
			organHealth: this.organHealth,
			roomGraph: this.roomGraph,
			upgradesTaken: Array.from( this.upgrades.taken ),
		};
	}

	restoreFromSnapshot( snap ) {
		this.actIndex = snap.actIndex;
		this.roomIndex = snap.roomIndex;
		this.organHealth = snap.organHealth;
		this.upgrades.reset();
		for ( const id of ( snap.upgradesTaken || [] ) ) this.upgrades.taken.add( id );
		if ( snap.roomGraph && snap.roomGraph.length ) this.roomGraph = snap.roomGraph;
		else this._generateActGraph();
		this.enterRoom();
	}
}
