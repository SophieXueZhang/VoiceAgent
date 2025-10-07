"""OpenAI API integration for chat completions."""
import os
from typing import List, Dict, AsyncGenerator
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Load .env from project root
load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def stream_chat_response(
    messages: List[Dict[str, str]],
    model: str = "gpt-4"
) -> AsyncGenerator[str, None]:
    """
    Stream chat completion from OpenAI API.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: OpenAI model to use

    Yields:
        str: Chunks of the AI response
    """
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=0.7,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        # Log error and yield error message
        print(f"OpenAI API error: {e}")
        yield f"Error: {str(e)}"


def build_message_history(conversation_messages: List[Dict]) -> List[Dict[str, str]]:
    """
    Convert database messages to OpenAI API format.

    Args:
        conversation_messages: List of message dicts from database

    Returns:
        List of dicts with 'role' and 'content' keys
    """
    return [
        {"role": msg["role"], "content": msg["content"]}
        for msg in conversation_messages
    ]
