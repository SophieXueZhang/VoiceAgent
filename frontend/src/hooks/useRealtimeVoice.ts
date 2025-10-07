import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeVoiceOptions {
  apiKey?: string;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeVoice({ apiKey, onTranscript, onError }: RealtimeVoiceOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startCall = useCallback(async () => {
    try {
      // Get API key from props or env
      const key = apiKey || import.meta.env.VITE_OPENAI_API_KEY || '';
      if (!key) {
        throw new Error('API key not configured');
      }

      // Connect to relay server (handles OpenAI authentication)
      const wsUrl = 'ws://localhost:8001';

      console.log('Connecting to relay server...');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket Connected!');
        setIsConnected(true);

        // Send session config
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful voice assistant. Be concise.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: { type: 'server_vad' }
          }
        }));

        // Don't start mic yet - wait for session.created/updated
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data.type);

        switch (data.type) {
          case 'session.created':
          case 'session.updated':
            // Now it's safe to start microphone
            console.log('✅ Session ready, starting microphone...');
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              mediaStreamRef.current = stream;

              const audioContext = new AudioContext({ sampleRate: 24000 });
              audioContextRef.current = audioContext;

              const source = audioContext.createMediaStreamSource(stream);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  const s = Math.max(-1, Math.min(1, inputData[i]));
                  pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: base64Audio
                  }));
                }
              };

              source.connect(processor);
              processor.connect(audioContext.destination);

              setIsInCall(true);
            } catch (error) {
              console.error('Microphone error:', error);
              onError?.(new Error('Failed to access microphone'));
            }
            break;
          case 'error':
            console.error('OpenAI error:', data.error);
            onError?.(new Error(data.error.message || 'Unknown error'));
            break;
          case 'response.audio.delta':
            playAudioChunk(data.delta);
            break;
          case 'response.audio_transcript.delta':
            onTranscript?.(data.delta);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WS error:', error);
        onError?.(new Error('Connection failed'));
      };

      ws.onclose = () => {
        console.log('WS closed');
        setIsConnected(false);
        setIsInCall(false);
      };

      wsRef.current = ws;
    } catch (error) {
      onError?.(error as Error);
    }
  }, [apiKey, onTranscript, onError]);

  const endCall = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsInCall(false);
    setIsConnected(false);
  }, []);

  const playAudioChunk = (base64Audio: string) => {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcmData = new Int16Array(bytes.buffer);

    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / (pcmData[i] < 0 ? 0x8000 : 0x7FFF);
    }

    const audioContext = new AudioContext({ sampleRate: 24000 });
    const buffer = audioContext.createBuffer(1, floatData.length, 24000);
    buffer.copyToChannel(floatData, 0);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    isConnected,
    isInCall,
    startCall,
    endCall
  };
}
