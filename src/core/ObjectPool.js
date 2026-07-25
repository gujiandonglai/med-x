// Core/ObjectPool.js
// Generic object pool. `factory` creates a new instance, `reset` re-primes
// a reused instance with fresh arguments. Every high-frequency entity in
// MED-X (bullets, particles, and eventually enemies) is drawn from a pool
// instead of being constructed/destroyed every frame.

export class ObjectPool {

	constructor( factory, reset, initialSize = 32 ) {
		this._factory = factory;
		this._reset = reset;
		this._free = [];
		this._active = new Set();

		for ( let i = 0; i < initialSize; i ++ ) {
			this._free.push( factory() );
		}
	}

	get size() { return this._free.length + this._active.size; }
	get activeCount() { return this._active.size; }

	acquire( ...args ) {
		let obj = this._free.pop();
		if ( ! obj ) obj = this._factory();
		this._reset( obj, ...args );
		this._active.add( obj );
		if ( obj.mesh ) obj.mesh.visible = true;
		return obj;
	}

	release( obj ) {
		if ( ! this._active.has( obj ) ) return;
		this._active.delete( obj );
		if ( obj.mesh ) obj.mesh.visible = false;
		this._free.push( obj );
	}

	releaseAll() {
		for ( const obj of Array.from( this._active ) ) this.release( obj );
	}

	forEach( fn ) {
		for ( const obj of this._active ) fn( obj );
	}

	// Iterate with the ability to release-during-iterate safely.
	forEachSafe( fn ) {
		for ( const obj of Array.from( this._active ) ) fn( obj );
	}
}
