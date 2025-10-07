"""WebSocket relay for OpenAI Realtime API."""
import os
import asyncio
import json
import websockets
from fastapi import WebSocket
from dotenv import load_dotenv

load_dotenv()

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


async def relay_to_openai(client_ws: WebSocket):
    """
    Relay WebSocket messages between client and OpenAI Realtime API.

    Args:
        client_ws: Client WebSocket connection from browser
    """
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1"
    }

    print(f"🔌 Relay starting...")
    print(f"   API Key: {OPENAI_API_KEY[:20]}..." if OPENAI_API_KEY else "None")

    openai_ws = None

    try:
        # Connect to OpenAI
        openai_ws = await websockets.connect(
            OPENAI_REALTIME_URL,
            extra_headers=headers
        )
        print("✅ Connected to OpenAI Realtime API")

        async def forward_client_to_openai():
            """Forward from client to OpenAI."""
            try:
                while True:
                    data = await client_ws.receive_text()
                    print(f"📤 Client -> OpenAI: {data[:100]}...")
                    await openai_ws.send(data)
            except Exception as e:
                print(f"❌ Client->OpenAI error: {e}")
                raise

        async def forward_openai_to_client():
            """Forward from OpenAI to client."""
            try:
                async for message in openai_ws:
                    print(f"📥 OpenAI -> Client: {str(message)[:100]}...")
                    await client_ws.send_text(message)
            except Exception as e:
                print(f"❌ OpenAI->Client error: {e}")
                raise

        # Run both directions concurrently
        await asyncio.gather(
            forward_client_to_openai(),
            forward_openai_to_client(),
            return_exceptions=True
        )

    except Exception as e:
        print(f"❌ Relay error: {e}")
        import traceback
        traceback.print_exc()

        error_msg = json.dumps({
            "type": "error",
            "error": {"message": str(e)}
        })
        try:
            await client_ws.send_text(error_msg)
        except:
            pass
    finally:
        if openai_ws:
            await openai_ws.close()
        print("🔚 Relay closed")
