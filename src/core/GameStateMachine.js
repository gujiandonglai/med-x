// Core/GameStateMachine.js
// High-level game flow, built on the generic AI/FiniteStateMachine so the
// same machinery drives both "what screen are we on" and "what is this
// enemy doing" — one FSM implementation, two use cases per the spec.

import { FiniteStateMachine } from '../ai/FiniteStateMachine.js';
import { eventBus } from './EventBus.js';

export function createGameFSM( world ) {
	const fsm = new FiniteStateMachine( world );

	fsm.addStates( [
		{
			name: 'boot',
			update: ( w ) => { /* asset/vendor load happens before this runs */ },
		},
		{
			name: 'menu',
			enter: ( w ) => { w.hud.showMainMenu(); w.audio.playMenuMusic(); eventBus.emit( 'state:menu' ); },
			exit: ( w ) => { w.hud.hideMainMenu(); },
		},
		{
			name: 'heroSelect',
			enter: ( w ) => { w.hud.showHeroSelect(); },
			exit: ( w ) => { w.hud.hideHeroSelect(); },
		},
		{
			name: 'playing',
			enter: ( w, prev ) => { w.hud.showHUD(); document.body.classList.add( 'in-run' ); },
			update: ( w, dt ) => { w.updateGameplay( dt ); },
			exit: ( w ) => {},
		},
		{
			name: 'upgradeChoice',
			enter: ( w ) => { w.hud.showUpgradeChoice( w.roomManager.rollUpgradeChoices() ); },
			exit: ( w ) => { w.hud.hideUpgradeChoice(); },
		},
		{
			name: 'paused',
			enter: ( w ) => { w.hud.showPauseMenu(); },
			exit: ( w ) => { w.hud.hidePauseMenu(); },
		},
		{
			name: 'gameOver',
			enter: ( w ) => { w.hud.hideHUD(); w.hud.showGameOver( w.runStats ); document.body.classList.remove( 'in-run' ); },
		},
		{
			name: 'victory',
			enter: ( w ) => { w.hud.hideHUD(); w.hud.showVictory( w.runStats ); document.body.classList.remove( 'in-run' ); },
		},
	] );

	fsm.start( 'boot' );
	return fsm;
}
