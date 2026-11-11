// node render.cjs <from> <to> <out.mp4> : renders frames [from,to) at 30 fps straight into ffmpeg
const {chromium}=require('playwright'), {spawn}=require('child_process')
const [from,to,out]=[+process.argv[2],+process.argv[3],process.argv[4]]
;(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080}})
 p.on('pageerror',e=>console.log('ERR',e.message))
 await p.goto('file://'+__dirname+'/index.html'); await p.evaluate(()=>window.ready)
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-c:v','mjpeg','-framerate','30','-i','-','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-r','30',out],{stdio:['pipe','inherit','inherit']})
 const t0=Date.now()
 for(let f=from;f<to;f++){
  await p.evaluate(t=>render(t),f/30)
  const buf=await p.screenshot({type:'jpeg',quality:93})
  if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r))
  if(f%300===0) console.log(out,f,((Date.now()-t0)/1000).toFixed(0)+'s')
 }
 ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close()
})()
