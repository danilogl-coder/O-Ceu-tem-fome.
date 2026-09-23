module.exports = function raster(size, height) {
  height = height || size;
  const pixels = new Array(size * height).fill(null);
  const dot=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<size&&y<height)pixels[y*size+x]=c;};
  const rect=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)dot(i,j,c);};
  const ler=(x,y)=>(x>=0&&y>=0&&x<size&&y<height)?pixels[y*size+x]:null;
  return {dot,rect,ler,larg:size,alt:height,pixels};
};
