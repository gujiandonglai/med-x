// Core/SpatialHash.js
// Uniform grid spatial hash over the XZ plane (Y/height is ignored — combat
// arenas are flat-ish organ interiors). Used for broad-phase collision and
// "find nearby entities" queries by AI/Physics so nobody does O(n^2) scans.

export class SpatialHash {

	constructor( cellSize = 4 ) {
		this.cellSize = cellSize;
		this.cells = new Map();
		this._entityCell = new Map();
	}

	_key( cx, cz ) { return cx + '_' + cz; }

	_cellOf( x, z ) {
		return [ Math.floor( x / this.cellSize ), Math.floor( z / this.cellSize ) ];
	}

	insert( entity, x, z ) {
		const [ cx, cz ] = this._cellOf( x, z );
		const key = this._key( cx, cz );
		let bucket = this.cells.get( key );
		if ( ! bucket ) { bucket = new Set(); this.cells.set( key, bucket ); }
		bucket.add( entity );
		this._entityCell.set( entity, key );
	}

	update( entity, x, z ) {
		const [ cx, cz ] = this._cellOf( x, z );
		const key = this._key( cx, cz );
		const oldKey = this._entityCell.get( entity );
		if ( oldKey === key ) return;
		if ( oldKey !== undefined ) {
			const oldBucket = this.cells.get( oldKey );
			if ( oldBucket ) oldBucket.delete( entity );
		}
		let bucket = this.cells.get( key );
		if ( ! bucket ) { bucket = new Set(); this.cells.set( key, bucket ); }
		bucket.add( entity );
		this._entityCell.set( entity, key );
	}

	remove( entity ) {
		const key = this._entityCell.get( entity );
		if ( key === undefined ) return;
		const bucket = this.cells.get( key );
		if ( bucket ) bucket.delete( entity );
		this._entityCell.delete( entity );
	}

	clear() {
		this.cells.clear();
		this._entityCell.clear();
	}

	// Returns all entities within `radius` (approx — cell-granular, then the
	// caller does the precise distance check) of (x, z).
	query( x, z, radius, out = [] ) {
		const minCx = Math.floor( ( x - radius ) / this.cellSize );
		const maxCx = Math.floor( ( x + radius ) / this.cellSize );
		const minCz = Math.floor( ( z - radius ) / this.cellSize );
		const maxCz = Math.floor( ( z + radius ) / this.cellSize );

		for ( let cx = minCx; cx <= maxCx; cx ++ ) {
			for ( let cz = minCz; cz <= maxCz; cz ++ ) {
				const bucket = this.cells.get( this._key( cx, cz ) );
				if ( bucket ) for ( const e of bucket ) out.push( e );
			}
		}
		return out;
	}
}
