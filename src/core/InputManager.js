// Core/InputManager.js
// Keyboard + mouse input with pointer-lock look. Exposes a plain snapshot
// object (`state`) that Gameplay/Player.js reads every frame — no event
// coupling needed downstream.

export class InputManager {

	constructor( domElement ) {
		this.dom = domElement;

		this.state = {
			moveX: 0, moveZ: 0,        // -1..1 strafe / forward
			lookDX: 0, lookDY: 0,      // mouse delta this frame
			sprint: false,
			dodge: false,
			fire: false,
			aim: false,
			reload: false,
			skillPrimary: false,       // secondary weapon
			skillActive: false,        // active skill
			skillUltimate: false,      // ultimate
			pause: false,
			interact: false,
		};

		this._keys = new Set();
		this._pending = { dodge: false, skillPrimary: false, skillActive: false, skillUltimate: false, pause: false, interact: false, reload: false };

		this._onKeyDown = this._onKeyDown.bind( this );
		this._onKeyUp = this._onKeyUp.bind( this );
		this._onMouseMove = this._onMouseMove.bind( this );
		this._onMouseDown = this._onMouseDown.bind( this );
		this._onMouseUp = this._onMouseUp.bind( this );
		this._onClick = this._onClick.bind( this );

		window.addEventListener( 'keydown', this._onKeyDown );
		window.addEventListener( 'keyup', this._onKeyUp );
		window.addEventListener( 'mousemove', this._onMouseMove );
		window.addEventListener( 'mousedown', this._onMouseDown );
		window.addEventListener( 'mouseup', this._onMouseUp );
		this.dom.addEventListener( 'click', this._onClick );
	}

	_onClick() {
		if ( document.pointerLockElement !== this.dom ) {
			this.dom.requestPointerLock?.();
		}
	}

	_onKeyDown( e ) {
		this._keys.add( e.code );
		if ( e.code === 'ShiftLeft' || e.code === 'ShiftRight' ) this.state.sprint = true;
		if ( e.code === 'Space' ) this._pending.dodge = true;
		if ( e.code === 'KeyR' ) this._pending.reload = true;
		if ( e.code === 'KeyQ' ) this._pending.skillPrimary = true;
		if ( e.code === 'KeyE' ) this._pending.skillActive = true;
		if ( e.code === 'KeyF' ) this._pending.skillUltimate = true;
		if ( e.code === 'KeyC' ) this._pending.interact = true;
		if ( e.code === 'Escape' ) this._pending.pause = true;
	}

	_onKeyUp( e ) {
		this._keys.delete( e.code );
		if ( e.code === 'ShiftLeft' || e.code === 'ShiftRight' ) this.state.sprint = false;
	}

	_onMouseMove( e ) {
		if ( document.pointerLockElement === this.dom ) {
			this.state.lookDX += e.movementX || 0;
			this.state.lookDY += e.movementY || 0;
		}
	}

	_onMouseDown( e ) {
		if ( e.button === 0 ) this.state.fire = true;
		if ( e.button === 2 ) this.state.aim = true;
	}

	_onMouseUp( e ) {
		if ( e.button === 0 ) this.state.fire = false;
		if ( e.button === 2 ) this.state.aim = false;
	}

	// Call once per frame after gameplay has read last frame's snapshot.
	update() {
		const k = this._keys;
		let z = 0, x = 0;
		if ( k.has( 'KeyW' ) || k.has( 'ArrowUp' ) ) z -= 1;
		if ( k.has( 'KeyS' ) || k.has( 'ArrowDown' ) ) z += 1;
		if ( k.has( 'KeyA' ) || k.has( 'ArrowLeft' ) ) x -= 1;
		if ( k.has( 'KeyD' ) || k.has( 'ArrowRight' ) ) x += 1;
		this.state.moveX = x;
		this.state.moveZ = z;

		this.state.dodge = this._pending.dodge;
		this.state.reload = this._pending.reload;
		this.state.skillPrimary = this._pending.skillPrimary;
		this.state.skillActive = this._pending.skillActive;
		this.state.skillUltimate = this._pending.skillUltimate;
		this.state.pause = this._pending.pause;
		this.state.interact = this._pending.interact;

		for ( const key in this._pending ) this._pending[ key ] = false;
	}

	// Look deltas are consumed (reset) after being read once per frame.
	consumeLook() {
		const dx = this.state.lookDX, dy = this.state.lookDY;
		this.state.lookDX = 0;
		this.state.lookDY = 0;
		return [ dx, dy ];
	}
}
