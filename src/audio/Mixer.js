export class Mixer {
  constructor(engine, deckA, deckB) {
    this.engine = engine; this.decks = { A: deckA, B: deckB };
    this.crossfader = .5; this.master = .8;
    this.setCrossfader(.5); this.setMaster(.8);
  }
  setCrossfader(value, ramp = .025) {
    this.crossfader = Math.max(0, Math.min(1, Number(value)));
    const a = Math.cos(this.crossfader * Math.PI / 2);
    const b = Math.sin(this.crossfader * Math.PI / 2);
    this.decks.A.setGain(a, ramp); this.decks.B.setGain(b, ramp);
  }
  setMaster(value) {
    this.master = Math.max(0, Math.min(1, Number(value)));
    this.engine.masterInput.gain.setTargetAtTime(this.master, this.engine.context.currentTime, .03);
  }
  setDeckSide(id, ramp = .02) { this.setCrossfader(id === 'A' ? 0 : 1, ramp); }
  async resume() { await this.engine.resume(); }
}