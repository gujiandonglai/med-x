// AI/FiniteStateMachine.js
// Generic reusable FSM. States are plain objects: { name, enter(ctx), update(ctx, dt), exit(ctx) }.
// Used both for high-level game flow (Core/GameStateMachine.js) and for
// per-entity AI (enemies, bosses, the player's skill state).

export class FiniteStateMachine {

	constructor( context = {} ) {
		this.context = context;
		this.states = new Map();
		this.current = null;
		this.previousName = null;
		this.timeInState = 0;
	}

	addState( state ) {
		this.states.set( state.name, state );
		return this;
	}

	addStates( list ) {
		for ( const s of list ) this.addState( s );
		return this;
	}

	start( name ) {
		const state = this.states.get( name );
		if ( ! state ) throw new Error( `FSM: unknown initial state "${name}"` );
		this.current = state;
		this.timeInState = 0;
		state.enter?.( this.context, null );
		return this;
	}

	is( name ) { return this.current?.name === name; }

	transition( name, data ) {
		const next = this.states.get( name );
		if ( ! next ) { console.warn( `FSM: unknown state "${name}"` ); return; }
		if ( this.current === next ) return;
		this.current?.exit?.( this.context, name );
		this.previousName = this.current?.name ?? null;
		this.current = next;
		this.timeInState = 0;
		next.enter?.( this.context, this.previousName, data );
	}

	update( dt ) {
		this.timeInState += dt;
		this.current?.update?.( this.context, dt, this );
	}
}
