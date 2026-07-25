// UI/HUD.js
// All screen-space UI. Built as plain DOM (not WebGL) since it's cheaper
// to style/iterate on and keeps Rendering/* focused purely on the 3D
// scene. Every screen is a <div> toggled via a CSS class; HUD.js owns no
// gameplay state — it only reflects what World/RoomManager/Player tell it,
// and reads all display text through Core/I18n so 中文/English both work.

import { HEROES } from '../core/Config.js';
import { t, getLanguage, setLanguage } from '../core/I18n.js';
import { eventBus } from '../core/EventBus.js';

export class HUD {

	constructor( root, save ) {
		this.root = root;
		this.save = save;
		this._visibleScreens = new Set(); // which top-level screens are currently un-hidden, survives rebuild()
		this._build();
		eventBus.on( 'i18n:change', () => this.rebuild() );
	}

	_el( tag, className, parent ) {
		const e = document.createElement( tag );
		if ( className ) e.className = className;
		( parent || this.root ).appendChild( e );
		return e;
	}

	// Full teardown + rebuild, used on language change. Re-applies whichever
	// screens were visible beforehand so switching language mid-menu (or
	// mid-pause) doesn't kick the player back to nothing-shown.
	rebuild() {
		const wasVisible = new Set( this._visibleScreens );
		this.root.innerHTML = '';
		this._build();
		for ( const name of wasVisible ) this._show( name );
	}

	_screens() {
		return {
			mainMenu: this.mainMenu, heroSelect: this.heroSelect, hud: this.hud,
			upgradeModal: this.upgradeModal, pauseMenu: this.pauseMenu,
			settingsScreen: this.settingsScreen, saveDataScreen: this.saveDataScreen,
			gameOverScreen: this.gameOverScreen, victoryScreen: this.victoryScreen,
		};
	}
	_show( name ) { this._screens()[ name ]?.classList.remove( 'hidden' ); this._visibleScreens.add( name ); }
	_hide( name ) { this._screens()[ name ]?.classList.add( 'hidden' ); this._visibleScreens.delete( name ); }

	_build() {
		this._buildMainMenu();
		this._buildHeroSelect();
		this._buildHUD();
		this._buildUpgradeModal();
		this._buildPauseMenu();
		this._buildSettingsScreen();
		this._buildSaveDataScreen();
		this.gameOverScreen = this._el( 'div', 'screen game-over hidden' );
		this.victoryScreen = this._el( 'div', 'screen victory hidden' );
	}

	// ================= Main Menu =================
	_buildMainMenu() {
		this.mainMenu = this._el( 'div', 'screen main-menu hidden' );
		const hasSave = this.save.hasRunState();
		this.mainMenu.innerHTML = `
			<div class="title-block">
				<h1>${t( 'gameTitleZh' )}<span>${t( 'gameTitleEn' )}</span></h1>
				<p class="subtitle">${t( 'subtitle' )}</p>
			</div>
			<div class="menu-buttons">
				<button class="btn primary" id="btn-start">${t( 'btnStart' )}</button>
				<button class="btn" id="btn-continue" ${hasSave ? '' : 'disabled'}>${t( 'btnContinue' )}</button>
				<button class="btn" id="btn-savedata">${t( 'btnSaveData' )}</button>
				<button class="btn" id="btn-settings">${t( 'btnSettings' )}</button>
				<button class="btn danger" id="btn-exit">${t( 'btnExit' )}</button>
			</div>
			<p class="hint">${t( 'controlsHint' )}</p>
		`;
		this.mainMenu.querySelector( '#btn-start' ).addEventListener( 'click', () => this.onStartClicked?.() );
		this.mainMenu.querySelector( '#btn-continue' ).addEventListener( 'click', () => { if ( hasSave ) this.onContinueClicked?.(); } );
		this.mainMenu.querySelector( '#btn-savedata' ).addEventListener( 'click', () => { this._hide( 'mainMenu' ); this.showSaveDataScreen( 'mainMenu' ); } );
		this.mainMenu.querySelector( '#btn-settings' ).addEventListener( 'click', () => { this._hide( 'mainMenu' ); this.showSettings( 'mainMenu' ); } );
		this.mainMenu.querySelector( '#btn-exit' ).addEventListener( 'click', () => this._confirmExit() );
	}

	_confirmExit() {
		const closed = window.close();
		// window.close() silently no-ops on tabs not opened by script — tell
		// the player what to do instead rather than leaving them guessing.
		this.showToast( t( 'exitMessage' ) );
	}

	// ================= Hero Select =================
	_buildHeroSelect() {
		this.heroSelect = this._el( 'div', 'screen hero-select hidden' );
		this._el( 'h2', null, this.heroSelect ).textContent = t( 'heroSelectTitle' );
		const heroCards = this._el( 'div', 'hero-cards', this.heroSelect );
		for ( const hero of Object.values( HEROES ) ) {
			const tr = t( `heroes.${hero.id}` );
			const active = t( `skills.${hero.active.id}` ), passive = t( `skills.${hero.passive.id}` ), ultimate = t( `skills.${hero.ultimate.id}` );
			const card = document.createElement( 'div' );
			card.className = 'hero-card';
			card.style.setProperty( '--hero-color', '#' + hero.color.toString( 16 ).padStart( 6, '0' ) );
			card.innerHTML = `
				<h3>${tr.name}</h3>
				<p class="hero-role">${tr.role}</p>
				<p class="hero-desc">${tr.desc}</p>
				<ul class="hero-kit">
					<li><b>${t( 'kitActive' )}:</b> ${active.name} — ${active.desc}</li>
					<li><b>${t( 'kitPassive' )}:</b> ${passive.name} — ${passive.desc}</li>
					<li><b>${t( 'kitUltimate' )}:</b> ${ultimate.name} — ${ultimate.desc}</li>
				</ul>
			`;
			card.addEventListener( 'click', () => this.onHeroChosen?.( hero.id ) );
			heroCards.appendChild( card );
		}
	}

	// ================= In-run HUD =================
	_buildHUD() {
		this.hud = this._el( 'div', 'screen hud hidden' );
		this.hud.innerHTML = `
			<div class="vitals">
				<div class="bar shield-bar"><div class="fill"></div></div>
				<div class="bar health-bar"><div class="fill"></div></div>
				<div class="bar atp-bar"><div class="fill"></div></div>
			</div>
			<div class="skills-row">
				<div class="skill-icon" id="skill-active"><span>E</span></div>
				<div class="skill-icon" id="skill-ultimate"><span>F</span></div>
				<div class="skill-icon" id="skill-secondary"><span>Q</span></div>
			</div>
			<div class="run-progress" id="run-progress"></div>
			<div class="organ-health"><span>${t( 'organHealthLabel' )}</span><div class="bar organ-bar"><div class="fill"></div></div></div>
			<div class="crosshair"></div>
			<div class="boss-bar-wrap hidden" id="boss-bar-wrap">
				<div class="boss-name" id="boss-name"></div>
				<div class="bar boss-bar"><div class="fill"></div></div>
			</div>
			<div class="room-reward-prompt hidden" id="room-reward-prompt"></div>
			<button class="btn tiny pause-btn" id="btn-pause-icon">II</button>
		`;
		this.healthFill = this.hud.querySelector( '.health-bar .fill' );
		this.shieldFill = this.hud.querySelector( '.shield-bar .fill' );
		this.atpFill = this.hud.querySelector( '.atp-bar .fill' );
		this.organFill = this.hud.querySelector( '.organ-bar .fill' );
		this.runProgressEl = this.hud.querySelector( '#run-progress' );
		this.bossBarWrap = this.hud.querySelector( '#boss-bar-wrap' );
		this.bossBarFill = this.hud.querySelector( '.boss-bar .fill' );
		this.bossNameEl = this.hud.querySelector( '#boss-name' );
		this.roomRewardPrompt = this.hud.querySelector( '#room-reward-prompt' );
		this.skillActiveEl = this.hud.querySelector( '#skill-active' );
		this.skillUltimateEl = this.hud.querySelector( '#skill-ultimate' );
		this.skillSecondaryEl = this.hud.querySelector( '#skill-secondary' );
		this.hud.querySelector( '#btn-pause-icon' ).addEventListener( 'click', () => this.onPauseRequested?.() );
	}

	// ================= Upgrade Choice =================
	_buildUpgradeModal() {
		this.upgradeModal = this._el( 'div', 'screen upgrade-modal hidden' );
		this.upgradeModal.innerHTML = `<h2>${t( 'upgradeChoiceTitle' )}</h2><div class="upgrade-cards"></div>`;
		this.upgradeCardsEl = this.upgradeModal.querySelector( '.upgrade-cards' );
	}

	// ================= Pause Menu =================
	_buildPauseMenu() {
		this.pauseMenu = this._el( 'div', 'screen pause-menu hidden' );
		this.pauseMenu.innerHTML = `
			<h2>${t( 'pauseTitle' )}</h2>
			<div class="menu-buttons">
				<button class="btn primary" id="btn-resume">${t( 'btnResume' )}</button>
				<button class="btn" id="btn-save-run">${t( 'btnSave' )}</button>
				<button class="btn" id="btn-pause-settings">${t( 'btnSettings' )}</button>
				<button class="btn danger" id="btn-pause-mainmenu">${t( 'btnMainMenu' )}</button>
			</div>
		`;
		this.pauseMenu.querySelector( '#btn-resume' ).addEventListener( 'click', () => this.onResumeClicked?.() );
		this.pauseMenu.querySelector( '#btn-save-run' ).addEventListener( 'click', () => { this.onSaveRequested?.(); this.showToast( t( 'btnSave' ) + ' ✓' ); } );
		this.pauseMenu.querySelector( '#btn-pause-settings' ).addEventListener( 'click', () => { this._hide( 'pauseMenu' ); this.showSettings( 'pauseMenu' ); } );
		this.pauseMenu.querySelector( '#btn-pause-mainmenu' ).addEventListener( 'click', () => this.onQuitToMenuClicked?.() );
	}

	// ================= Settings =================
	_buildSettingsScreen() {
		this.settingsScreen = this._el( 'div', 'screen settings-screen hidden' );
		const s = this.save.getSettings();
		const lang = getLanguage();
		this.settingsScreen.innerHTML = `
			<h2>${t( 'settingsTitle' )}</h2>
			<div class="settings-row">
				<label>${t( 'musicVolume' )}</label>
				<input type="range" id="slider-music" min="0" max="100" value="${Math.round( s.musicVolume * 100 )}"/>
			</div>
			<div class="settings-row">
				<label>${t( 'sfxVolume' )}</label>
				<input type="range" id="slider-sfx" min="0" max="100" value="${Math.round( s.sfxVolume * 100 )}"/>
			</div>
			<div class="settings-row">
				<label>${t( 'language' )}</label>
				<div class="lang-toggle">
					<button class="btn small ${lang === 'zh' ? 'active' : ''}" id="btn-lang-zh">中文</button>
					<button class="btn small ${lang === 'en' ? 'active' : ''}" id="btn-lang-en">English</button>
				</div>
			</div>
			<button class="btn primary" id="btn-settings-back">${t( 'btnBack' )}</button>
		`;
		this.settingsScreen.querySelector( '#slider-music' ).addEventListener( 'input', ( e ) => {
			const v = e.target.value / 100;
			this.save.updateSettings( { musicVolume: v } );
			this.onMusicVolumeChanged?.( v );
		} );
		this.settingsScreen.querySelector( '#slider-sfx' ).addEventListener( 'input', ( e ) => {
			const v = e.target.value / 100;
			this.save.updateSettings( { sfxVolume: v } );
			this.onSfxVolumeChanged?.( v );
		} );
		this.settingsScreen.querySelector( '#btn-lang-zh' ).addEventListener( 'click', () => { this.save.updateSettings( { language: 'zh' } ); setLanguage( 'zh' ); } );
		this.settingsScreen.querySelector( '#btn-lang-en' ).addEventListener( 'click', () => { this.save.updateSettings( { language: 'en' } ); setLanguage( 'en' ); } );
		this.settingsScreen.querySelector( '#btn-settings-back' ).addEventListener( 'click', () => this._closeSettings() );
	}

	showSettings( returnTo ) { this._settingsReturnTo = returnTo; this._show( 'settingsScreen' ); }
	_closeSettings() { this._hide( 'settingsScreen' ); if ( this._settingsReturnTo ) this._show( this._settingsReturnTo ); }

	// ================= Save Data screen =================
	_buildSaveDataScreen() {
		this.saveDataScreen = this._el( 'div', 'screen save-data-screen hidden' );
		this._renderSaveDataContent();
	}

	_renderSaveDataContent() {
		const rs = this.save.loadRunState();
		let body;
		if ( ! rs ) {
			body = `<p class="no-save">${t( 'noSaveData' )}</p>`;
		} else {
			const heroName = t( `heroes.${rs.heroId}` )?.name || rs.heroId;
			const date = new Date( rs.savedAt ).toLocaleString();
			body = `
				<ul class="save-summary">
					<li><b>${t( 'savedHeroLabel' )}:</b> ${heroName}</li>
					<li><b>${t( 'savedActLabel' )}:</b> ${rs.actIndex + 1}</li>
					<li><b>${t( 'savedRoomLabel' )}:</b> ${rs.roomIndex + 1}</li>
					<li><b>${t( 'savedKillsLabel' )}:</b> ${rs.kills}</li>
					<li><b>${t( 'savedAtLabel' )}:</b> ${date}</li>
				</ul>
				<button class="btn danger small" id="btn-delete-save">${t( 'btnDeleteSave' )}</button>
			`;
		}
		this.saveDataScreen.innerHTML = `<h2>${t( 'saveDataTitle' )}</h2>${body}<button class="btn primary" id="btn-savedata-back">${t( 'btnBack' )}</button>`;
		const del = this.saveDataScreen.querySelector( '#btn-delete-save' );
		if ( del ) del.addEventListener( 'click', () => {
			if ( confirm( t( 'confirmDeleteSave' ) ) ) {
				this.save.clearRunState();
				this._renderSaveDataContent();
				this.onRunStateCleared?.();
			}
		} );
		this.saveDataScreen.querySelector( '#btn-savedata-back' ).addEventListener( 'click', () => this._closeSaveData() );
	}

	showSaveDataScreen( returnTo ) { this._saveDataReturnTo = returnTo; this._renderSaveDataContent(); this._show( 'saveDataScreen' ); }
	_closeSaveData() { this._hide( 'saveDataScreen' ); if ( this._saveDataReturnTo ) this._show( this._saveDataReturnTo ); }

	// ================= generic show/hide passthrough (kept for World/RoomManager callers) =================
	showMainMenu() { this._show( 'mainMenu' ); }
	hideMainMenu() { this._hide( 'mainMenu' ); }
	showHeroSelect() { this._show( 'heroSelect' ); }
	hideHeroSelect() { this._hide( 'heroSelect' ); }
	showHUD() { this._show( 'hud' ); }
	hideHUD() { this._hide( 'hud' ); }
	showPauseMenu() { this._show( 'pauseMenu' ); }
	hidePauseMenu() { this._hide( 'pauseMenu' ); }

	// -- vitals --
	updateVitals( player ) {
		this.healthFill.style.width = ( 100 * player.health.healthFrac ) + '%';
		this.shieldFill.style.width = ( 100 * ( player.health.maxShield > 0 ? player.health.shield / player.health.maxShield : 0 ) ) + '%';
		this.atpFill.style.width = ( 100 * player.atp / player.maxATP ) + '%';

		this.skillActiveEl.classList.toggle( 'ready', player.activeCooldown <= 0 );
		this.skillUltimateEl.classList.toggle( 'ready', player.ultimateCooldown <= 0 && player.ultimateCharge >= 100 );
		this.skillUltimateEl.style.setProperty( '--charge', Math.min( 100, player.ultimateCharge ) + '%' );
		this.skillSecondaryEl.classList.toggle( 'ready', player.weapons.secondaryCooldown <= 0 );
	}

	setOrganHealth( value ) { this.organFill.style.width = value + '%'; }

	setRunProgress( act, room, roomsPerAct, biomeName, roomType ) {
		const typeLabel = t( `roomType_${roomType}` );
		this.runProgressEl.textContent = t( 'runProgress', { act, biome: biomeName, room: Math.min( room, roomsPerAct ), total: roomsPerAct, type: typeLabel } );
	}

	// -- boss bar --
	showBossBar( name ) { this.bossBarWrap.classList.remove( 'hidden' ); this.bossNameEl.textContent = name; this._bossBaseName = name; }
	hideBossBar() { this.bossBarWrap.classList.add( 'hidden' ); }
	updateBossBar( frac ) { this.bossBarFill.style.width = ( frac * 100 ) + '%'; }
	flashBossPhase( phaseName ) {
		const label = t( `bossPhase_${phaseName}` );
		this.bossNameEl.textContent = `${this._bossBaseName} — ${label}`;
	}

	// -- upgrade choice --
	showUpgradeChoice( choices ) {
		this._show( 'upgradeModal' );
		this.upgradeCardsEl.innerHTML = '';
		for ( const u of choices ) {
			const tr = t( `upgrades.${u.id}` );
			const card = document.createElement( 'div' );
			card.className = 'upgrade-card rarity-' + u.rarity;
			card.innerHTML = `<h3>${tr.name}</h3><p>${tr.desc}</p><span class="rarity-tag">${u.rarity === 'rare' ? t( 'rarityRare' ) : t( 'rarityCommon' )}</span>`;
			card.addEventListener( 'click', () => this.onUpgradeChosen?.( u ) );
			this.upgradeCardsEl.appendChild( card );
		}
	}
	hideUpgradeChoice() { this._hide( 'upgradeModal' ); }

	// -- room reward prompt (supply/shop/event rooms) --
	showRoomReward( roomType, onContinue ) {
		const title = t( `roomReward_${roomType}_title` );
		const desc = t( `roomReward_${roomType}_desc` );
		this.roomRewardPrompt.classList.remove( 'hidden' );
		this.roomRewardPrompt.innerHTML = `<h4>${title}</h4><p>${desc}</p><button class="btn small" id="btn-room-continue">${t( 'roomContinuePrompt' )}</button>`;
		const btn = this.roomRewardPrompt.querySelector( '#btn-room-continue' );
		const handler = () => { this.roomRewardPrompt.classList.add( 'hidden' ); onContinue(); };
		btn.addEventListener( 'click', handler, { once: true } );
		this._roomContinueHandler = handler;
	}
	triggerRoomContinue() { this._roomContinueHandler?.(); }

	// -- end states --
	showGameOver( stats ) {
		this._show( 'gameOverScreen' );
		this.gameOverScreen.innerHTML = `
			<h1>${t( 'gameOverTitle' )}</h1>
			<p>${t( 'gameOverDesc', { act: stats.act, kills: stats.kills } )}</p>
			<button class="btn primary" id="btn-restart">${t( 'btnRestart' )}</button>
		`;
		this.gameOverScreen.querySelector( '#btn-restart' ).addEventListener( 'click', () => this.onRestartClicked?.() );
	}
	showVictory( stats ) {
		this._show( 'victoryScreen' );
		this.victoryScreen.innerHTML = `
			<h1>${t( 'victoryTitle' )}</h1>
			<p>${t( 'victoryDesc', { kills: stats.kills } )}</p>
			<button class="btn primary" id="btn-restart2">${t( 'btnRestart' )}</button>
		`;
		this.victoryScreen.querySelector( '#btn-restart2' ).addEventListener( 'click', () => this.onRestartClicked?.() );
	}
	hideEndScreens() { this._hide( 'gameOverScreen' ); this._hide( 'victoryScreen' ); }

	// -- toast (small transient message, e.g. "saved ✓" or exit notice) --
	showToast( message ) {
		let toast = this.root.querySelector( '.toast' );
		if ( ! toast ) toast = this._el( 'div', 'toast' );
		toast.textContent = message;
		toast.classList.add( 'visible' );
		clearTimeout( this._toastTimer );
		this._toastTimer = setTimeout( () => toast.classList.remove( 'visible' ), 3200 );
	}
}
