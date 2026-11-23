export class Effects {
  constructor(context) {
    this.context = context;
    this.filters = [60, 1000, 10000].map((frequency, i) => {
      const node = context.createBiquadFilter();
      node.type = i === 0 ? 'lowshelf' : i === 2 ? 'highshelf' : 'peaking';
      node.frequency.value = frequency;
      node.Q.value = .8;
      return node;
    });
    this.input = this.filters[0];
    this.filters[0].connect(this.filters[1]);
    this.filters[1].connect(this.filters[2]);
    this.output = this.filters[2];
  }
  setEQ(band, db) {
    const node = this.filters[band];
    if (node) node.gain.setTargetAtTime(Number(db), this.context.currentTime, .03);
  }
  connect(destination) { this.output.connect(destination); }
  disconnect() { this.output.disconnect(); }
}