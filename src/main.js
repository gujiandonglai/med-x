// main.js
// The World: owns every subsystem and the frame loop. This is the one
// file that's allowed to know about all the others — Rendering, Gameplay,
// AI, Physics, Audio, UI, Save and Networking modules stay decoupled from
// each other and only ever talk through the `world` object passed into
// their constructors, or through Core/EventBus for one-off notifications.

import * as THREE from 'three';

import { SceneManager } from './rendering/SceneManager.js';
import { EnvironmentBuilder } from './rendering/EnvironmentBuilder.js';
import { EffectsFactory } from './rendering/EffectsFactory.js';

import { InputManager } from './core/InputManager.js';
import { ObjectPool } from './core/ObjectPool.js';
import { createGameFSM } from './core/GameStateMachine.js';
import { HEROES, ENEMIES, ATP_ECONOMY, ECOSYSTEM } from './core/Config.js';
import { setLanguage } from './core/I18n.js';

import { Player } from './gameplay/Player.js';
import { Enemy } from './gameplay/Enemy.js';
import { EcosystemAgent } from './gameplay/EcosystemAgents.js';
import { ProjectileSystem } from './gameplay/Projectile.js';
import { RoomManager } from './gameplay/RoomManager.js';
import { distanceXZ } from './ai/Steering.js';
import { resolveObstacles, clampToArena } from './physics/Collision.js';

import { AudioManager } from './audio/AudioManager.js';
import { SaveManager } from './save/SaveManager.js';
import { NetworkStub } from './networking/NetworkStub.js';
import { HUD } from './ui/HUD.js';

const MAX_DT = 0.05; // clamp huge frame gaps (tab switches) so physics never explodes

class World {

	constructor() {
		this.save = new SaveManager();
		setLanguage( this.save.getSettings().language );

		this.canvas = document.getElementById( 'game-canvas' );
		this.sceneManager = new SceneManager( this.canvas );
		this.scene = this.sceneManager.scene;
		this.camera = this.sceneManager.camera;

		this.environment = new EnvironmentBuilder( this.scene );
		this.effects = new EffectsFactory( this.scene );
		this.projectiles = new ProjectileSystem( this.scene, this.effects );

		this.audio = new AudioManager();
		this.network = new NetworkStub();
		this.input = new InputManager( this.canvas );

		this.hud = new HUD( document.getElementById( 'ui-root' ), this.save );
		this._wireHUD();

		this.roomManager = new RoomManager( this );

		this.player = null;
		this.enemies = [];
		this.ecosystemAgents = [];
		this.pickups = [];
		this._enemyPools = new Map();

		this.camYaw = 0;
		this.arenaRadius = 16;
		this.runStats = { kills: 0 };

		this.clock = new THREE.Clock();
		this.gameFSM = createGameFSM( this );
		this.gameFSM.transition( 'menu' );

		this._loop = this._loop.bind( this );
		requestAnimationFrame( this._loop );

		window.addEventListener( 'beforeunload', () => this._autoSaveIfPlaying() );
		this._bindFirstInteractionAudioUnlock();
	}

	// Browsers block audio until the first user gesture, so the menu-music
	// call that fires when we transition to 'menu' at boot silently no-ops.
	// Catch the very first click/keypress anywhere and (re)sync music to
	// whatever the game is currently showing.
	_bindFirstInteractionAudioUnlock() {
		const handler = () => {
			this.audio.unlock();
			this.audio.setMusicVolume( this.save.getSettings().musicVolume );
			this.audio.setSfxVolume( this.save.getSettings().sfxVolume );
			this._syncMusicToState();
			window.removeEventListener( 'pointerdown', handler );
			window.removeEventListener( 'keydown', handler );
		};
		window.addEventListener( 'pointerdown', handler, { once: true } );
		window.addEventListener( 'keydown', handler, { once: true } );
	}

	_syncMusicToState() {
		if ( this.gameFSM.is( 'menu' ) || this.gameFSM.is( 'heroSelect' ) ) { this.audio.playMenuMusic(); return; }
		if ( this.player && this.roomManager.currentRoomType ) {
			this.audio.playBiomeMusic( this.roomManager.biome, this.roomManager.currentRoomType === 'boss' );
		}
	}

	// ============================== HUD wiring ==============================
	_wireHUD() {
		const h = this.hud;
		h.onStartClicked = () => { this.audio.unlock(); this.gameFSM.transition( 'heroSelect' ); };
		h.onContinueClicked = () => { this.audio.unlock(); this._continueRun(); };
		h.onHeroChosen = ( heroId ) => this._startNewRun( heroId );
		h.onUpgradeChosen = ( upgrade ) => { this.roomManager.chooseUpgrade( upgrade ); this.gameFSM.transition( 'playing' ); };
		h.onResumeClicked = () => this.gameFSM.transition( 'playing' );
		h.onSaveRequested = () => this._saveRunCheckpoint();
		h.onQuitToMenuClicked = () => { this._saveRunCheckpoint(); this._returnToMainMenu(); };
		h.onPauseRequested = () => { if ( this.gameFSM.is( 'playing' ) ) this.gameFSM.transition( 'paused' ); };
		h.onRestartClicked = () => { this.hud.hideEndScreens(); this._returnToMainMenu(); };
		h.onMusicVolumeChanged = ( v ) => this.audio.setMusicVolume( v );
		h.onSfxVolumeChanged = ( v ) => this.audio.setSfxVolume( v );
		h.onRunStateCleared = () => this.hud.rebuild();
	}

	// ============================== Run lifecycle ==============================
	_startNewRun( heroId ) {
		this.audio.unlock();
		this.save.clearRunState();
		this.runStats = { kills: 0 };
		this._createPlayer( heroId );
		this.roomManager.startRun();
		this._saveRunCheckpoint();
		this.gameFSM.transition( 'playing' );
	}

	_continueRun() {
		const snap = this.save.loadRunState();
		if ( ! snap ) return;
		this.runStats = { kills: snap.kills || 0 };
		this._createPlayer( snap.heroId, snap.player );
		this.roomManager.restoreFromSnapshot( snap.room );
		this.gameFSM.transition( 'playing' );
	}

	_createPlayer( heroId, playerSnap = null ) {
		if ( this.player ) { this.scene.remove( this.player.mesh ); }
		const heroConfig = HEROES[ heroId ] || HEROES.assault;
		this.player = new Player( this, heroConfig );
		if ( playerSnap ) {
			this.player.health.health = playerSnap.health;
			this.player.health.maxHealth = playerSnap.maxHealth;
			this.player.health.shield = playerSnap.shield;
			this.player.health.maxShield = playerSnap.maxShield;
			this.player.atp = playerSnap.atp;
			this.player.maxATP = playerSnap.maxATP;
			this.player.moveSpeed = playerSnap.moveSpeed;
			this.player.ultimateCharge = playerSnap.ultimateCharge;
			Object.assign( this.player.mods, playerSnap.mods );
		}
	}

	_returnToMainMenu() {
		this.clearRoomEntities();
		if ( this.player ) { this.scene.remove( this.player.mesh ); this.player = null; }
		this.hud.hideEndScreens();
		this.hud.rebuild(); // refreshes the Continue button's enabled state against current save data
		this.gameFSM.transition( 'menu' );
	}

	_getRunSnapshot() {
		return {
			heroId: this.player.heroConfig.id,
			kills: this.runStats.kills,
			room: this.roomManager.getSnapshot(),
			player: {
				health: this.player.health.health, maxHealth: this.player.health.maxHealth,
				shield: this.player.health.shield, maxShield: this.player.health.maxShield,
				atp: this.player.atp, maxATP: this.player.maxATP,
				moveSpeed: this.player.moveSpeed, ultimateCharge: this.player.ultimateCharge,
				mods: { ...this.player.mods },
			},
		};
	}

	_saveRunCheckpoint() {
		if ( ! this.player ) return;
		this.save.saveRunState( this._getRunSnapshot() );
	}

	_autoSaveIfPlaying() {
		if ( this.gameFSM.is( 'playing' ) || this.gameFSM.is( 'paused' ) ) this._saveRunCheckpoint();
	}

	onRunVictory() {
		this.runStats.act = this.roomManager.actNumber;
		this.save.recordRunEnd( { actReached: this.roomManager.actNumber, kills: this.runStats.kills } );
		this.save.clearRunState();
		this.gameFSM.transition( 'victory' );
	}

	_onRunDefeat() {
		this.runStats.act = this.roomManager.actNumber;
		this.save.recordRunEnd( { actReached: this.roomManager.actNumber, kills: this.runStats.kills } );
		this.save.clearRunState();
		this.gameFSM.transition( 'gameOver' );
	}

	// ============================== Enemy pooling ==============================
	_getEnemyPool( cfg ) {
		if ( ! this._enemyPools.has( cfg.id ) ) {
			this._enemyPools.set( cfg.id, new ObjectPool(
				() => new Enemy( this, cfg ),
				( e, position ) => e.reset( position ),
				4
			) );
		}
		return this._enemyPools.get( cfg.id );
	}

	spawnEnemy( cfg, position ) {
		const e = this._getEnemyPool( cfg ).acquire( position );
		this.enemies.push( e );
		this.save.recordEnemySeen( cfg.id );
		return e;
	}

	addEnemy( e ) { this.enemies.push( e ); } // used for Boss, which isn't pooled (rare/heavy, created once per act)

	removeEnemy( e ) {
		const idx = this.enemies.indexOf( e );
		if ( idx >= 0 ) this.enemies.splice( idx, 1 );
		if ( ! e.isBoss ) this._getEnemyPool( e.cfg ).release( e );
	}

	addEcosystemAgent( a ) { this.ecosystemAgents.push( a ); }
	removeEcosystemAgent( a ) {
		const idx = this.ecosystemAgents.indexOf( a );
		if ( idx >= 0 ) this.ecosystemAgents.splice( idx, 1 );
	}

	spawnPickup( kind, position ) {
		const cfg = ATP_ECONOMY.pickups[ kind ];
		const geo = new THREE.OctahedronGeometry( 0.3, 0 );
		const mat = new THREE.MeshStandardMaterial( { color: cfg.color, emissive: cfg.color, emissiveIntensity: 1.6, roughness: 0.3 } );
		const mesh = new THREE.Mesh( geo, mat );
		mesh.position.copy( position ).setY( 0.6 );
		this.scene.add( mesh );
		this.pickups.push( { mesh, kind, restore: cfg.restore, position, radius: 0.9 } );
	}

	clearRoomEntities() {
		for ( const e of this.enemies.slice() ) {
			if ( e.isBoss ) { this.scene.remove( e.mesh ); this.hud.hideBossBar(); }
			else this._getEnemyPool( e.cfg ).release( e );
		}
		this.enemies.length = 0;

		for ( const a of this.ecosystemAgents ) this.scene.remove( a.mesh );
		this.ecosystemAgents.length = 0;

		this.projectiles.pool.releaseAll();
		this.effects.pool.releaseAll();

		for ( const p of this.pickups ) this.scene.remove( p.mesh );
		this.pickups.length = 0;
	}

	transitionToRoom() { this.roomManager.enterRoom(); this._saveRunCheckpoint(); }
	requestUpgradeChoice() { this.gameFSM.transition( 'upgradeChoice' ); }

	getAllTargets() { return this.player ? [ this.player, ...this.enemies ] : this.enemies; }

	// ============================== Combat callbacks ==============================
	onEnemyDamaged( entity, dealt, isCrit ) {
		if ( ! this.player || dealt <= 0 ) return;
		this.player.gainUltimateCharge( dealt * 0.15 );
		if ( this.player.mods.lifesteal ) this.player.health.heal( dealt * this.player.mods.lifesteal );
	}

	onEnemyAttack( enemy, player ) {
		const dealt = player.takeDamage( enemy.cfg.damage, { source: enemy } );
		if ( dealt > 0 ) this.audio.playSFX( 'playerHurt' );
		this.effects.hitSpark( player.position.x, 1.2, player.position.z, 0xff5d5d );
	}

	onEnemyExplode( enemy ) {
		this.effects.deathBurst( enemy.position.x, enemy.position.y + 1, enemy.position.z, 0xff9142 );
		this.audio.playSFX( 'explosion' );
		const r = enemy.cfg.blastRadius;
		if ( this.player && distanceXZ( this.player.position, enemy.position ) <= r ) {
			this.player.takeDamage( enemy.cfg.damage, { source: enemy } );
			this.audio.playSFX( 'playerHurt' );
		}
		for ( const a of this.ecosystemAgents ) {
			if ( distanceXZ( a.position, enemy.position ) <= r ) a.health.damage( enemy.cfg.damage * 0.6 );
		}
	}

	onSupportVirusHeal( healer ) {
		for ( const e of this.enemies ) {
			if ( e === healer || ! e.health.alive ) continue;
			if ( distanceXZ( e.position, healer.position ) <= healer.cfg.healRadius ) e.health.heal( healer.cfg.healAmount );
		}
		this.effects.healPulse( healer.position.x, 1, healer.position.z, healer.cfg.color );
	}

	onEnemyKilled( enemy ) {
		this.runStats.kills ++;
		this.audio.playSFX( 'enemyDeath' );
		if ( this.player ) this.player.gainUltimateCharge( ( enemy.cfg.xp || 4 ) * 3 );

		const split = enemy.cfg.onDeathSplit;
		if ( split ) {
			for ( let i = 0; i < split.count; i ++ ) {
				const ang = Math.random() * Math.PI * 2;
				const pos = enemy.position.clone().add( new THREE.Vector3( Math.sin( ang ) * 1.2, 0, Math.cos( ang ) * 1.2 ) );
				const child = this.spawnEnemy( ENEMIES[ split.childId ], pos );
				child.health.maxHealth = Math.max( 1, Math.round( ENEMIES[ split.childId ].health * split.healthFrac ) );
				child.health.health = child.health.maxHealth;
			}
		}
	}

	onBossKilled( boss ) {
		this.runStats.kills ++;
		this.save.recordEnemySeen( boss.cfg.id );
		this.audio.playSFX( 'enemyDeath' );
	}

	onBossAttack( boss, attackId, data, damageMult ) {
		const player = this.player;
		switch ( attackId ) {
			case 'slam':
				if ( player && distanceXZ( boss.position, player.position ) <= data.radius ) {
					player.takeDamage( data.damage * damageMult, { source: boss } );
					this.audio.playSFX( 'playerHurt' );
				}
				this.effects.deathBurst( boss.position.x, 0.5, boss.position.z, boss.cfg.color );
				break;
			case 'sporeBurst':
				for ( let i = 0; i < data.projectileCount; i ++ ) {
					const ang = ( i / data.projectileCount ) * Math.PI * 2;
					this.projectiles.spawn( {
						position: boss.position.clone().setY( 1.5 ),
						direction: new THREE.Vector3( Math.sin( ang ), 0, Math.cos( ang ) ),
						speed: data.projSpeed, damage: data.damage * damageMult, radius: 0.2, color: boss.cfg.color,
						owner: boss, isEnemyProjectile: true, maxLife: 4,
					} );
				}
				break;
			case 'summonAdds':
				for ( let i = 0; i < data.count; i ++ ) {
					const ang = Math.random() * Math.PI * 2;
					const pos = boss.position.clone().add( new THREE.Vector3( Math.sin( ang ) * 3, 0, Math.cos( ang ) * 3 ) );
					this.spawnEnemy( ENEMIES[ data.enemyId ], pos );
				}
				break;
			case 'chargeSweep':
				if ( player ) {
					const dir = new THREE.Vector3( player.position.x - boss.position.x, 0, player.position.z - boss.position.z ).normalize();
					boss.position.addScaledVector( dir, 6 );
					if ( distanceXZ( boss.position, player.position ) < 2.5 ) {
						player.takeDamage( data.damage * damageMult, { source: boss } );
						this.audio.playSFX( 'playerHurt' );
					}
				}
				break;
		}
		this.audio.playSFX( 'explosion' );
	}

	onOrganHealthImpact( amount ) { this.roomManager.damageOrganHealth( amount ); }
	onOrganHealthDepleted() { if ( this.player ) this.player.health.damage( 99999, { ignoreShield: true } ); }

	onDendriticAlert( dc ) {
		for ( let i = 0; i < dc.cfg.summonCount; i ++ ) {
			const ang = Math.random() * Math.PI * 2;
			const pos = dc.position.clone().add( new THREE.Vector3( Math.sin( ang ) * 2, 0, Math.cos( ang ) * 2 ) );
			this.addEcosystemAgent( new EcosystemAgent( this, 'whiteBloodCell', ECOSYSTEM.whiteBloodCell, pos ) );
		}
		this.effects.healPulse( dc.position.x, 1.5, dc.position.z, dc.cfg.color );
	}

	findNearestWoundedEcosystemAgent( position, radius, excludeSelf ) {
		let best = null, bestDist = radius;
		for ( const a of this.ecosystemAgents ) {
			if ( a === excludeSelf || ! a.health.alive ) continue;
			if ( a.health.health >= a.health.maxHealth ) continue;
			const d = distanceXZ( position, a.position );
			if ( d < bestDist ) { bestDist = d; best = a; }
		}
		return best;
	}

	// ============================== Hero skill dispatch ==============================
	onGuardianField( player, cfg ) {
		player.applyTimedDefensiveBuff( { damageReductionMult: cfg.damageReduction }, cfg.duration );
		for ( const a of this.ecosystemAgents ) if ( a.kind === 'whiteBloodCell' ) a._buffed = true;
		setTimeout( () => { for ( const a of this.ecosystemAgents ) a._buffed = false; }, cfg.duration * 1000 );
		this.effects.healPulse( player.position.x, 1, player.position.z, 0x66ccff );
		this.audio.playSFX( 'ultimate' );
	}

	onHeroActiveSkill( player, cfg ) {
		switch ( cfg.id ) {
			case 'chargeDash': this._doChargeDash( player, cfg ); break;
			case 'focusZoom':
				player.activeSkillState = 'focusZoom';
				player._focusTimer = cfg.duration;
				player.tempCritBonus = cfg.critBonus;
				this.audio.playSFX( 'dodge' );
				break;
			case 'immunePulse': this._doImmunePulse( player, cfg ); break;
		}
	}

	_doChargeDash( player, cfg ) {
		const dir = new THREE.Vector3( Math.sin( player.yaw ), 0, Math.cos( player.yaw ) );
		const steps = 6;
		for ( let i = 0; i < steps; i ++ ) {
			player.position.addScaledVector( dir, 5 / steps );
			resolveObstacles( player.position, player.radius, this.environment.obstacles );
			clampToArena( player.position, this.arenaRadius );
			for ( const e of this.enemies ) {
				if ( ! e.health.alive ) continue;
				if ( distanceXZ( player.position, e.position ) < 1.3 ) {
					const dealt = e.takeDamage ? e.takeDamage( cfg.hitDamage, { source: player } ) : e.health.damage( cfg.hitDamage );
					this.onEnemyDamaged( e, dealt, false );
				}
			}
		}
		player._speedBoostTimer = 1.2;
		player._speedBoostMult = cfg.speedMult ? Math.min( cfg.speedMult, 1.4 ) : 1.3;
		this.effects.muzzleFlash( player.position.x, 1, player.position.z, player.heroConfig.color );
		this.audio.playSFX( 'dodge' );
	}

	_doImmunePulse( player, cfg ) {
		for ( const e of this.enemies ) {
			if ( ! e.health.alive ) continue;
			if ( distanceXZ( player.position, e.position ) <= cfg.radius ) e.health.applyElement( 'freeze' );
		}
		for ( const a of this.ecosystemAgents ) {
			if ( ( a.kind === 'whiteBloodCell' || a.kind === 'platelet' ) && distanceXZ( player.position, a.position ) <= cfg.radius ) a.health.heal( 20 );
		}
		this.effects.healPulse( player.position.x, 1, player.position.z, 0xffb43f );
		this.audio.playSFX( 'ultimate' );
	}

	onHeroUltimate( player, cfg ) {
		switch ( cfg.id ) {
			case 'sporeBarrage':
				player._ultCastPos = player.position.clone();
				this.audio.playSFX( 'ultimate' );
				break;
			case 'orbitalLance':
				for ( const e of this.enemies ) {
					if ( ! e.health.alive ) continue;
					const dealt = e.takeDamage ? e.takeDamage( cfg.damage, { source: player, isCrit: true } ) : e.health.damage( cfg.damage );
					this.onEnemyDamaged( e, dealt, true );
				}
				this.effects.deathBurst( player.position.x, 3, player.position.z, 0xd6ff8a );
				this.audio.playSFX( 'ultimate' );
				break;
			case 'fortressProtocol':
				player.applyTimedDefensiveBuff( { damageReductionMult: cfg.damageReduction, reflectFrac: cfg.reflectDamage }, cfg.duration );
				this.effects.healPulse( player.position.x, 1, player.position.z, 0xffb43f );
				this.audio.playSFX( 'ultimate' );
				break;
		}
	}

	_updateActiveUltimateEffects( dt ) {
		const player = this.player;
		if ( ! player.ultimateActive || player.heroConfig.ultimate.id !== 'sporeBarrage' || ! player._ultCastPos ) return;
		const cfg = player.heroConfig.ultimate;
		for ( const e of this.enemies ) {
			if ( ! e.health.alive ) continue;
			if ( distanceXZ( player._ultCastPos, e.position ) <= cfg.radius ) {
				const dealt = e.health.damage( cfg.dps * dt );
				if ( dealt > 0 && Math.random() < 0.08 ) this.effects.hitSpark( e.position.x, 1, e.position.z, 0xff8a3d );
			}
		}
	}

	// ============================== Pickups ==============================
	_updatePickups( dt ) {
		const t = performance.now() * 0.003;
		for ( let i = this.pickups.length - 1; i >= 0; i -- ) {
			const p = this.pickups[ i ];
			p.mesh.rotation.y += dt * 2;
			p.mesh.position.y = 0.6 + Math.sin( t + i ) * 0.1;
			if ( this.player && distanceXZ( this.player.position, p.position ) < p.radius ) {
				this.player.restoreATP( p.restore );
				this.effects.healPulse( p.position.x, 0.6, p.position.z, 0xffe27a );
				this.audio.playSFX( 'pickupATP' );
				this.scene.remove( p.mesh );
				this.pickups.splice( i, 1 );
			}
		}
	}

	// ============================== Main per-frame gameplay update ==============================
	updateGameplay( dt ) {
		this.player.update( dt, this.input.state, this.camYaw );

		for ( const e of this.enemies.slice() ) e.update( dt );
		for ( const a of this.ecosystemAgents.slice() ) a.update( dt );

		this.projectiles.update( dt, this.getAllTargets(), ( target, proj, dealt, isCrit ) => this._onProjectileHit( target, proj, dealt, isCrit ) );
		this.effects.update( dt );
		this.environment.update( dt );
		this._updatePickups( dt );
		this._updateActiveUltimateEffects( dt );

		resolveObstacles( this.player.position, this.player.radius, this.environment.obstacles );
		clampToArena( this.player.position, this.arenaRadius );

		this.sceneManager.updateCamera( this.player, this.camYaw, dt, this.input.state.aim );
		this.hud.updateVitals( this.player );

		if ( this.roomManager.roomActive ) {
			const stillFighting = this.enemies.some( ( e ) => e.health.alive );
			if ( ! stillFighting && [ 'combat', 'elite', 'hidden', 'boss' ].includes( this.roomManager.currentRoomType ) ) {
				this.roomManager.onCombatCleared();
			}
		}

		if ( this.input.state.interact && this.roomManager.roomActive && [ 'supply', 'shop', 'event' ].includes( this.roomManager.currentRoomType ) ) {
			if ( this.roomManager.currentRoomType === 'supply' ) { this.player.health.heal( 99999 ); this.player.restoreATP( 99999 ); }
			this.hud.triggerRoomContinue();
		}

		if ( this.player.isDead ) this._onRunDefeat();
	}

	_onProjectileHit( target, proj, dealt, isCrit ) {
		if ( proj.isEnemyProjectile ) {
			if ( dealt > 0 ) this.audio.playSFX( 'playerHurt' );
			return;
		}
		this.onEnemyDamaged( target, dealt, isCrit );
		this.audio.playSFX( isCrit ? 'crit' : 'hit' );

		if ( proj.ricochetChance > 0 && Math.random() < proj.ricochetChance ) {
			const nextTarget = this.enemies.find( ( e ) => e.health.alive && e !== target && ! proj.hitSet.has( e ) );
			if ( nextTarget ) {
				this.projectiles.spawn( {
					position: target.position.clone().setY( 1 ),
					direction: new THREE.Vector3( nextTarget.position.x - target.position.x, 0, nextTarget.position.z - target.position.z ),
					speed: 40, damage: proj.damage * 0.6, radius: proj.radius, color: proj.mesh.material.color.getHex(),
					owner: proj.owner, isEnemyProjectile: false, pierce: 0,
				} );
			}
		}
	}

	// ============================== Frame loop ==============================
	_loop() {
		requestAnimationFrame( this._loop );
		const dt = Math.min( this.clock.getDelta(), MAX_DT );

		this.input.update();
		const [ dx ] = this.input.consumeLook();
		this.camYaw -= dx * 0.0022;

		if ( this.input.state.pause ) {
			if ( this.gameFSM.is( 'playing' ) ) this.gameFSM.transition( 'paused' );
			else if ( this.gameFSM.is( 'paused' ) ) this.gameFSM.transition( 'playing' );
		}

		this.gameFSM.update( dt );
		this.sceneManager.render();
	}
}

window.addEventListener( 'DOMContentLoaded', () => { window.__MEDX_WORLD__ = new World(); } );
