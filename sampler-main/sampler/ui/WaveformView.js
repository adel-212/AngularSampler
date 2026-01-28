export class WaveformView {
  constructor(canvas, overlayPlayhead, overlayTrim) {
    this.canvas = canvas;
    this.wctx   = canvas.getContext('2d');
    this.pctx   = overlayPlayhead.getContext('2d');
    this.tctx   = overlayTrim.getContext('2d');

    this.buffer = null;
    this.trims  = { leftX: 50, rightX: 350 };
    this._drag  = null;
    this._raf   = null;

    overlayTrim.addEventListener('mousedown', e => this._down(e, overlayTrim));
    window.addEventListener('mouseup', ()=> this._drag = null);
    overlayTrim.addEventListener('mousemove', e => this._move(e, overlayTrim));
  }

  setBuffer(buf){ this.buffer = buf; this.drawWave(); }
  setTrimsPx(l, r){ this.trims = { leftX: l, rightX: r }; this.drawTrims(); }
  getTrimsPx(){ return this.trims; }

  pxToSec(x){ return (x / this.canvas.width) * (this.buffer?.duration || 0); }
  secToPx(s){ return (s / (this.buffer?.duration || 1)) * this.canvas.width; }

  drawWave(){
    const w = this.canvas.width  = this.canvas.clientWidth  * devicePixelRatio;
    const h = this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.wctx.clearRect(0,0,w,h); this.pctx.clearRect(0,0,w,h); this.tctx.clearRect(0,0,w,h);
    if (!this.buffer) return;

    const peaks = this._peaks(this.buffer, w);
    const mid = h/2;

    this.wctx.strokeStyle = '#1f2532';
    this.wctx.beginPath(); this.wctx.moveTo(0,mid); this.wctx.lineTo(w,mid); this.wctx.stroke();

    this.wctx.fillStyle = '#60a5fa';
    for (let x=0; x<peaks.length; x++){
      const p=peaks[x], y1 = mid - (p.max*(h/2-2)), y2 = mid - (p.min*(h/2-2));
      this.wctx.fillRect(x, y1, 1, Math.max(1, y2-y1));
    }
    this.drawTrims();
  }

  drawTrims(){
    const w=this.canvas.width, h=this.canvas.height, {leftX,rightX}=this.trims;
    this.tctx.clearRect(0,0,w,h);
    this.tctx.fillStyle='rgba(96,165,250,0.08)';
    this.tctx.fillRect(0,0,leftX,h); this.tctx.fillRect(rightX,0,w-rightX,h);

    this.tctx.strokeStyle='#93c5fd'; this.tctx.lineWidth=2;
    this.tctx.beginPath();
    this.tctx.moveTo(leftX+0.5,0);  this.tctx.lineTo(leftX+0.5,h);
    this.tctx.moveTo(rightX+0.5,0); this.tctx.lineTo(rightX+0.5,h);
    this.tctx.stroke();

    this.tctx.fillStyle='#bfdbfe';
    this.tctx.fillRect(leftX-3, h/2-14, 6, 28);
    this.tctx.fillRect(rightX-3, h/2-14, 6, 28);
  }

  startPlayhead(ctx, when, offsetSec, durationSec){
    const w=this.canvas.width,h=this.canvas.height; const end=when+durationSec;
    const loop=()=>{
      this.pctx.clearRect(0,0,w,h);
      const now=ctx.currentTime; if (now>end+0.01) return;
      const logical = offsetSec + Math.max(0, now-when);
      const x = this.secToPx(logical);
      this.pctx.strokeStyle='#e5e7eb'; this.pctx.lineWidth=2;
      this.pctx.beginPath(); this.pctx.moveTo(x+0.5,0); this.pctx.lineTo(x+0.5,h); this.pctx.stroke();
      this._raf=requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this._raf); this._raf=requestAnimationFrame(loop);
  }
  stopPlayhead(){ cancelAnimationFrame(this._raf); this._raf=null; this.pctx.clearRect(0,0,this.canvas.width,this.canvas.height); }

  /* helpers */
  _peaks(buffer, width){
    const ch0=buffer.getChannelData(0), ch1=buffer.numberOfChannels>1?buffer.getChannelData(1):null;
    const total=buffer.length, bin=Math.max(1,Math.floor(total/width)), out=new Array(width);
    for(let x=0;x<width;x++){
      const st=x*bin, ed=Math.min(total,st+bin); let min=1,max=-1;
      for(let i=st;i<ed;i++){ const m=ch1?0.5*(ch0[i]+ch1[i]):ch0[i]; if(m<min)min=m; if(m>max)max=m; }
      out[x]={min,max};
    }
    return out;
  }
  _x(e, el){ const r=el.getBoundingClientRect(); return (e.clientX-r.left)*(this.canvas.width/r.width); }
  _down(e, el){ const x=this._x(e,el); if(Math.abs(x-this.trims.leftX)<8)this._drag='left'; else if(Math.abs(x-this.trims.rightX)<8)this._drag='right'; }
  _move(e, el){
    if(!this._drag) return;
    const x=Math.max(0,Math.min(this.canvas.width,this._x(e,el)));
    if(this._drag==='left') this.trims.leftX=Math.min(x,this.trims.rightX-4);
    else this.trims.rightX=Math.max(x,this.trims.leftX+4);
    this.drawTrims();
  }
}
