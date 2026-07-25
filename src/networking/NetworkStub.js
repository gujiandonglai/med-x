// Networking/NetworkStub.js
// Placeholder interface for the planned co-op multiplayer mode. Every
// method is a documented no-op today; Gameplay code is written to call
// through `world.network.*` so wiring in a real transport (WebRTC,
// WebSocket relay, etc.) later never requires touching Gameplay/AI code —
// only this file gets replaced.

export class NetworkStub {

	constructor() {
		this.connected = false;
		this.isHost = true;
		this.peers = [];
	}

	async connect( _roomCode ) {
		console.info( '[NetworkStub] multiplayer not implemented yet — running solo.' );
		return false;
	}

	disconnect() { this.connected = false; this.peers = []; }

	// Called every tick with local player state; a real implementation
	// would broadcast this to peers and return their latest states.
	syncPlayerState( _localState ) { return this.peers; }

	sendEvent( _eventName, _payload ) { /* no-op until a transport exists */ }
	onEvent( _eventName, _handler ) { /* no-op until a transport exists */ }
}
