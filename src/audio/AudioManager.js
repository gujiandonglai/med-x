// Audio/AudioManager.js
// SFX are synthesized in real time via the Web Audio API (no asset
// pipeline needed for those short one-shots). Music is real MP3 loop
// tracks loaded from assets/audio/music/ — see the path table below and
// assets/audio/music/README.md for exactly which filenames to drop in.
// If a track is missing/fails to decode, playback falls back to a small
// synthesized drone instead of going silent or throwing, so the game
// still has ambient audio before you've added your files.

// Where each track lives, relative to index.html. Rename files here if
// you'd rather use different filenames than the README suggests, or add
// more entries (e.g. a distinct boss track per act) — everything that
// calls playBiomeMusic()/playMenuMusic() just asks for a track id.
const MUSIC_TRACKS = {
	menu: 'assets/audio/music/menu.mp3',
	bloodVessel: 'assets/audio/music/act1-bloodvessel.mp3',
	lung: 'assets/audio/music/act2-lung.mp3',
	liver: 'assets/audio/music/act3-liver.mp3',
	boss: 'assets/audio/music/boss.mp3',
};

// Base frequency for the synthesized fallback drone, used only when a
// track above is missing/unloadable — keyed the same way as MUSIC_TRACKS.
const FALLBACK_FREQ = { menu: 52, bloodVessel: 55, lung: 49, liver: 61, boss: 40 };

const MUSIC_FADE_IN = 1.5;
const MUSIC_FADE_OUT = 0.7;

export class AudioManager {

	constructor() {
		this.ctx = null;
		this.master = null;
		this.sfxGain = null;
		this.musicGain = null;
		this._unlocked = false;
		this._pendingVolumes = { music: 0.6, sfx: 0.8 };

		this._musicBuffers = new Map(); // trackId -> AudioBuffer | 'failed'
		this._musicSourceNode = null;   // currently playing AudioBufferSourceNode, if any
		this._musicTrackGain = null;    // its per-track fade gain
		this._currentTrackId = null;

		this._droneOsc = null;          // fallback synth drone oscillators
		this._droneGain = null;
	}

	// Browsers require a user gesture before audio starts — call this from
	// the first click/keypress (World wires this to the first interaction
	// anywhere on the page, plus the menu buttons directly).
	unlock() {
		if ( this._unlocked ) return;
		this._unlocked = true;
		this.ctx = new ( window.AudioContext || window.webkitAudioContext )();
		this.master = this.ctx.createGain();
		this.master.gain.value = 1;
		this.master.connect( this.ctx.destination );

		this.sfxGain = this.ctx.createGain();
		this.sfxGain.gain.value = this._pendingVolumes.sfx;
		this.sfxGain.connect( this.master );

		this.musicGain = this.ctx.createGain();
		this.musicGain.gain.value = this._pendingVolumes.music * 0.4; // music sits under SFX by default
		this.musicGain.connect( this.master );
	}

	setMusicVolume( v ) {
		this._pendingVolumes.music = v;
		if ( this.musicGain ) this.musicGain.gain.value = v * 0.4;
	}
	setSfxVolume( v ) {
		this._pendingVolumes.sfx = v;
		if ( this.sfxGain ) this.sfxGain.gain.value = v;
	}
	setMasterVolume( v ) { if ( this.master ) this.master.gain.value = v; }

	// ============================== one-shot SFX (synthesized) ==============================
	_playTone( freq, duration, { type = 'sine', gain = 0.25, sweepTo = null } = {} ) {
		if ( ! this.ctx ) return;
		const osc = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime( freq, this.ctx.currentTime );
		if ( sweepTo ) osc.frequency.exponentialRampToValueAtTime( Math.max( 1, sweepTo ), this.ctx.currentTime + duration );
		g.gain.setValueAtTime( gain, this.ctx.currentTime );
		g.gain.exponentialRampToValueAtTime( 0.001, this.ctx.currentTime + duration );
		osc.connect( g ).connect( this.sfxGain );
		osc.start();
		osc.stop( this.ctx.currentTime + duration );
	}

	_playNoise( duration, { gain = 0.2, filterFreq = 1200 } = {} ) {
		if ( ! this.ctx ) return;
		const bufferSize = this.ctx.sampleRate * duration;
		const buffer = this.ctx.createBuffer( 1, bufferSize, this.ctx.sampleRate );
		const data = buffer.getChannelData( 0 );
		for ( let i = 0; i < bufferSize; i ++ ) data[ i ] = ( Math.random() * 2 - 1 ) * ( 1 - i / bufferSize );
		const src = this.ctx.createBufferSource();
		src.buffer = buffer;
		const filter = this.ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = filterFreq;
		const g = this.ctx.createGain();
		g.gain.value = gain;
		src.connect( filter ).connect( g ).connect( this.sfxGain );
		src.start();
	}

	playSFX( id ) {
		if ( ! this.ctx ) return;
		switch ( id ) {
			case 'shoot': this._playTone( 620, 0.08, { type: 'square', gain: 0.12, sweepTo: 300 } ); break;
			case 'sniperShot': this._playTone( 180, 0.25, { type: 'sawtooth', gain: 0.22, sweepTo: 60 } ); this._playNoise( 0.1, { gain: 0.15 } ); break;
			case 'melee': this._playNoise( 0.08, { gain: 0.2, filterFreq: 2500 } ); break;
			case 'hit': this._playTone( 300, 0.06, { type: 'triangle', gain: 0.15, sweepTo: 120 } ); break;
			case 'crit': this._playTone( 900, 0.12, { type: 'square', gain: 0.18, sweepTo: 1400 } ); break;
			case 'enemyDeath': this._playNoise( 0.25, { gain: 0.2, filterFreq: 800 } ); break;
			case 'explosion': this._playNoise( 0.4, { gain: 0.3, filterFreq: 500 } ); this._playTone( 80, 0.4, { type: 'sine', gain: 0.25, sweepTo: 30 } ); break;
			case 'dodge': this._playTone( 500, 0.12, { type: 'sine', gain: 0.15, sweepTo: 900 } ); break;
			case 'pickupATP': this._playTone( 660, 0.1, { type: 'sine', gain: 0.15, sweepTo: 990 } ); break;
			case 'upgrade': this._playTone( 440, 0.15, { type: 'triangle', gain: 0.2, sweepTo: 880 } ); break;
			case 'bossPhase': this._playTone( 110, 0.6, { type: 'sawtooth', gain: 0.25, sweepTo: 55 } ); break;
			case 'playerHurt': this._playTone( 200, 0.15, { type: 'square', gain: 0.18, sweepTo: 90 } ); break;
			case 'ultimate': this._playTone( 220, 0.5, { type: 'sawtooth', gain: 0.25, sweepTo: 660 } ); break;
			default: this._playTone( 440, 0.08, { gain: 0.1 } );
		}
	}

	// ============================== looping music (real files, with synth fallback) ==============================
	async _loadBuffer( url ) {
		const res = await fetch( url );
		if ( ! res.ok ) throw new Error( `HTTP ${res.status}` );
		const arrayBuffer = await res.arrayBuffer();
		return await this.ctx.decodeAudioData( arrayBuffer );
	}

	// Fades out/stops whatever's currently playing (real track or fallback
	// drone) and fades in the requested one. Safe to call repeatedly with
	// the same trackId — it no-ops if that's already what's playing.
	async _playTrack( trackId, url, fallbackFreq ) {
		if ( ! this.ctx ) return; // call unlock() first
		if ( this._currentTrackId === trackId ) return;
		this._currentTrackId = trackId;
		this._stopMusic();

		let buffer = this._musicBuffers.get( trackId );
		if ( buffer === undefined ) {
			try {
				buffer = await this._loadBuffer( url );
				this._musicBuffers.set( trackId, buffer );
			} catch ( err ) {
				console.warn(
					`[AudioManager] couldn't load "${url}" (${err.message}) — using a placeholder ambient drone instead.\n` +
					`Drop your track at ${url} to replace it (see assets/audio/music/README.md).`
				);
				buffer = 'failed';
				this._musicBuffers.set( trackId, buffer );
			}
		}

		// another _playTrack call may have started while we were awaiting — bail if so
		if ( this._currentTrackId !== trackId ) return;

		if ( buffer === 'failed' ) { this._playSynthDrone( fallbackFreq ); return; }

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		const trackGain = this.ctx.createGain();
		trackGain.gain.value = 0.0001;
		trackGain.gain.exponentialRampToValueAtTime( 1, this.ctx.currentTime + MUSIC_FADE_IN );
		source.connect( trackGain ).connect( this.musicGain );
		source.start();
		this._musicSourceNode = source;
		this._musicTrackGain = trackGain;
	}

	playMenuMusic() { this._playTrack( 'menu', MUSIC_TRACKS.menu, FALLBACK_FREQ.menu ); }

	// biome: an entry from Core/Config.js BIOMES. isBoss: true while fighting
	// the act boss (all three acts currently share one boss track).
	playBiomeMusic( biome, isBoss ) {
		const trackId = isBoss ? 'boss' : biome.id;
		const url = isBoss ? MUSIC_TRACKS.boss : MUSIC_TRACKS[ biome.id ];
		const freq = isBoss ? FALLBACK_FREQ.boss : FALLBACK_FREQ[ biome.id ];
		this._playTrack( trackId, url, freq );
	}

	stopMusic() { this._currentTrackId = null; this._stopMusic(); }

	_stopMusic() {
		if ( this._musicSourceNode ) {
			const src = this._musicSourceNode, g = this._musicTrackGain;
			if ( g && this.ctx ) g.gain.exponentialRampToValueAtTime( 0.0001, this.ctx.currentTime + MUSIC_FADE_OUT );
			setTimeout( () => { try { src.stop(); } catch ( e ) {} }, ( MUSIC_FADE_OUT + 0.1 ) * 1000 );
			this._musicSourceNode = null;
			this._musicTrackGain = null;
		}
		this._stopDrone();
	}

	// -- synthesized fallback drone (used only when a real track fails to load) --
	_playSynthDrone( baseFreq = 55 ) {
		if ( ! this.ctx ) return;
		const osc1 = this.ctx.createOscillator();
		osc1.type = 'sine'; osc1.frequency.value = baseFreq;
		const osc2 = this.ctx.createOscillator();
		osc2.type = 'triangle'; osc2.frequency.value = baseFreq * 1.5;

		const g = this.ctx.createGain();
		g.gain.value = 0.0001;
		g.gain.exponentialRampToValueAtTime( 0.18, this.ctx.currentTime + 2 );

		const lfo = this.ctx.createOscillator();
		lfo.frequency.value = 0.08;
		const lfoGain = this.ctx.createGain();
		lfoGain.gain.value = 6;
		lfo.connect( lfoGain ).connect( osc1.frequency );

		osc1.connect( g ); osc2.connect( g );
		g.connect( this.musicGain );
		osc1.start(); osc2.start(); lfo.start();

		this._droneOsc = [ osc1, osc2, lfo ];
		this._droneGain = g;
	}

	_stopDrone() {
		if ( ! this._droneOsc ) return;
		const g = this._droneGain;
		if ( g && this.ctx ) g.gain.exponentialRampToValueAtTime( 0.0001, this.ctx.currentTime + 0.8 );
		const oscs = this._droneOsc;
		setTimeout( () => oscs.forEach( ( o ) => { try { o.stop(); } catch ( e ) {} } ), 900 );
		this._droneOsc = null;
	}
}
