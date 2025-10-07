// Simple WebSocket relay server for OpenAI Realtime API
// This allows browser clients to connect without exposing API key

const WebSocket = require('ws');
const http = require('http');

const PORT = 8001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OpenAI Realtime Relay Server\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', async (clientWs) => {
  console.log('🔌 Client connected');

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  // Forward client messages to OpenAI
  clientWs.on('message', (data) => {
    console.log('📤 Client → OpenAI:', data.toString().substring(0, 200));
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(data);
    }
  });

  // Forward OpenAI messages to client
  openaiWs.on('message', (data) => {
    console.log('📥 OpenAI → Client:', data.toString().substring(0, 200));
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  // Handle errors
  openaiWs.on('error', (error) => {
    console.error('❌ OpenAI error:', error.message);
    console.error('   Full error:', error);
    clientWs.close(1011, error.message);
  });

  clientWs.on('error', (error) => {
    console.error('❌ Client error:', error.message);
    openaiWs.close();
  });

  // Handle disconnections
  openaiWs.on('close', (code, reason) => {
    console.log(`🔌 OpenAI disconnected - Code: ${code}, Reason: ${reason.toString()}`);
    clientWs.close();
  });

  clientWs.on('close', (code, reason) => {
    console.log(`🔌 Client disconnected - Code: ${code}, Reason: ${reason.toString()}`);
    openaiWs.close();
  });

  openaiWs.on('open', () => {
    console.log('✅ Connected to OpenAI Realtime API');
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Relay server running on http://localhost:${PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PORT}`);
});
