// Servidor local sem dependências: `npm start` (ou `node scripts/servidor.js`).
// Também aceita conexões da rede local, para testar o cartão e o QR code no celular.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if(!file.startsWith(ROOT + path.sep) || /[\\/]\./.test(path.relative(ROOT, file))){
    res.writeHead(403); return res.end('Acesso negado');
  }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌸 Floricultura rodando:\n   Neste computador: http://localhost:${PORT}`);
  for(const list of Object.values(os.networkInterfaces())){
    for(const net of list || []){
      if(net.family === 'IPv4' && !net.internal) console.log(`   No celular (mesmo Wi-Fi): http://${net.address}:${PORT}`);
    }
  }
  console.log('');
});
