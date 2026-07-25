// Audio/AudioManager.js
// NOTE: this environment has no asset pipeline / audio file hosting
// available, so every sound here is synthesized in real time via the Web
// Audio API rather than loaded from .mp3/.ogg files. It's a fully
// functional placeholder — swap `_playTone`/`_playNoise` calls for
// `AudioBufferSourceNode` playback once real SFX/music assets exist, the
// public API (playSFX / setBiomeMusic / setMasterVolume) won't need to change.

export class AudioManager {

	constructor() {
		this.ctx = null;
		this.master = null;
		this.sfxGain = null;
		this.musicGain = null;
		this._droneOsc = null;
		this._droneGain = null;
		this._unlocked = false;
		this._pendingVolumes = { music: 0.6, sfx: 0.8 };
	}

	// Browsers require a user gesture before audio starts — call this from
	// the first click (main menu / "start run" button).
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

	// Simple two-oscillator drone per biome — cheap "ambient music" without assets.
	setBiomeMusic( biome ) {
		if ( ! this.ctx ) return;
		this._stopDrone();
		const baseFreq = { bloodVessel: 55, lung: 49, liver: 61 }[ biome.id ] || 55;

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
