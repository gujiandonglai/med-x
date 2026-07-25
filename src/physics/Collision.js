// Physics/Collision.js
// All collision in MED-X is circle-vs-circle on the XZ plane (arena
// combat, not full 3D physics). SpatialHash gives the broad phase; these
// helpers do the narrow-phase math and static-obstacle resolution.

export function circlesOverlap( ax, az, ar, bx, bz, br ) {
	const dx = ax - bx, dz = az - bz;
	const rr = ar + br;
	return ( dx * dx + dz * dz ) <= rr * rr;
}

export function distanceSq( ax, az, bx, bz ) {
	const dx = ax - bx, dz = az - bz;
	return dx * dx + dz * dz;
}

// Push `position` out of any overlapping static obstacle (pillars etc).
// Mutates and returns the position-like {x,z} object.
export function resolveObstacles( position, radius, obstacles ) {
	for ( const obs of obstacles ) {
		const dx = position.x - obs.position.x;
		const dz = position.z - obs.position.z;
		const minDist = radius + obs.radius;
		const distSq = dx * dx + dz * dz;
		if ( distSq < minDist * minDist && distSq > 1e-6 ) {
			const dist = Math.sqrt( distSq );
			const push = ( minDist - dist );
			position.x += ( dx / dist ) * push;
			position.z += ( dz / dist ) * push;
		}
	}
	return position;
}

// Clamp a position to stay within a circular arena floor.
export function clampToArena( position, arenaRadius, margin = 0.5 ) {
	const maxR = arenaRadius - margin;
	const distSq = position.x * position.x + position.z * position.z;
	if ( distSq > maxR * maxR ) {
		const dist = Math.sqrt( distSq );
		position.x = ( position.x / dist ) * maxR;
		position.z = ( position.z / dist ) * maxR;
	}
	return position;
}

// Query spatial hash for nearby candidates then run precise circle checks.
// `getPos`/`getRadius` are accessors so this works for projectiles, enemies
// or ecosystem agents without a shared base class.
export function findCollisions( spatialHash, x, z, radius, candidatesOut = [] ) {
	spatialHash.query( x, z, radius + 2, candidatesOut );
	return candidatesOut;
}
