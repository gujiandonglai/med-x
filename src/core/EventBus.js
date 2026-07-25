// Core/EventBus.js
// Minimal pub/sub so Gameplay, UI, Audio and Save systems can react to
// events (enemy killed, player hit, room cleared...) without importing
// each other directly.

export class EventBus {
	constructor() {
		this._listeners = new Map();
	}

	on( event, fn ) {
		if ( ! this._listeners.has( event ) ) this._listeners.set( event, new Set() );
		this._listeners.get( event ).add( fn );
		return () => this.off( event, fn );
	}

	off( event, fn ) {
		const set = this._listeners.get( event );
		if ( set ) set.delete( fn );
	}

	emit( event, payload ) {
		const set = this._listeners.get( event );
		if ( ! set ) return;
		// copy to array in case a handler unsubscribes during emit
		for ( const fn of Array.from( set ) ) {
			try {
				fn( payload );
			} catch ( err ) {
				console.error( `[EventBus] handler for "${event}" threw:`, err );
			}
		}
	}
}

// Shared global bus. Systems may also create private buses if needed,
// but almost everything in MED-X talks over this one.
export const eventBus = new EventBus();
