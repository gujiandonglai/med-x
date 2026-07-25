// AI/Steering.js
// Lightweight steering-behavior helpers operating on the XZ plane.
// Rooms are compact arenas, so simple steering (no navmesh) is enough to
// get organic-looking movement for both hostile AI and ecosystem cells.

import * as THREE from 'three';

const _tmp = new THREE.Vector3();

export function seek( position, target, speed, out = new THREE.Vector3() ) {
	out.copy( target ).sub( position );
	out.y = 0;
	const d = out.length();
	if ( d > 0.0001 ) out.multiplyScalar( speed / d );
	return out;
}

export function flee( position, threat, speed, out = new THREE.Vector3() ) {
	out.copy( position ).sub( threat );
	out.y = 0;
	const d = out.length();
	if ( d > 0.0001 ) out.multiplyScalar( speed / d );
	return out;
}

// Smooth random wander: nudges a persistent angle each call instead of
// picking a fresh random direction every frame (avoids jitter).
export function wander( state, speed, dt, turnRate = 1.5 ) {
	state.wanderAngle = ( state.wanderAngle ?? Math.random() * Math.PI * 2 ) + ( Math.random() - 0.5 ) * turnRate * dt;
	return _tmp.set( Math.cos( state.wanderAngle ) * speed, 0, Math.sin( state.wanderAngle ) * speed );
}

export function patrolNext( position, points, state, arriveDist = 1.2 ) {
	if ( state.patrolIndex === undefined ) state.patrolIndex = 0;
	const target = points[ state.patrolIndex % points.length ];
	if ( position.distanceTo( target ) < arriveDist ) state.patrolIndex ++;
	return points[ state.patrolIndex % points.length ];
}

export function distanceXZ( a, b ) {
	const dx = a.x - b.x, dz = a.z - b.z;
	return Math.sqrt( dx * dx + dz * dz );
}

export function facePoint( object3d, target, turnSpeed, dt ) {
	const dir = _tmp.set( target.x - object3d.position.x, 0, target.z - object3d.position.z );
	if ( dir.lengthSq() < 0.0001 ) return;
	const desiredYaw = Math.atan2( dir.x, dir.z );
	let diff = desiredYaw - object3d.rotation.y;
	diff = Math.atan2( Math.sin( diff ), Math.cos( diff ) ); // shortest angle
	const maxStep = turnSpeed * dt;
	object3d.rotation.y += THREE.MathUtils.clamp( diff, - maxStep, maxStep );
}
