"""LLM Provider abstraction — suporta OpenAI, Anthropic, OpenRouter e Gemini.

Todas as chamadas são feitas via HTTP puro (requests), sem dependências extras.
Cada provider implementa `complete(messages) -> str`.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

import requests
from loguru import logger

if TYPE_CHECKING:
    from ..models.ai_configuration import AIConfiguration


TIMEOUT = 30  # segundos


def _openai_complete(api_key: str, model: str, messages: list[dict], temperature: float, base_url: str = "https://api.openai.com/v1") -> str:
    """Compatível com OpenAI e OpenRouter (mesma API)."""
    resp = requests.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://colaboraedu.com.br",
            "X-Title": "ColaboraEdu AI",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _anthropic_complete(api_key: str, model: str, messages: list[dict], temperature: float) -> str:
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_msgs = [m for m in messages if m["role"] != "system"]

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "system": system_msg,
            "messages": user_msgs,
            "temperature": temperature,
            "max_tokens": 1024,
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


def _gemini_complete(api_key: str, model: str, messages: list[dict], temperature: float) -> str:
    contents = []
    for m in messages:
        if m["role"] == "system":
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    system_instruction = next((m["content"] for m in messages if m["role"] == "system"), None)

    payload: dict = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024},
    }
    if system_instruction:
        payload["system_instruction"] = {"parts": [{"text": system_instruction}]}

    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def call_llm(config: "AIConfiguration", messages: list[dict]) -> str | None:
    """Chama o LLM configurado. Retorna o texto gerado ou None em caso de erro."""
    if not config or not config.is_active or not config.api_key:
        return None

    provider = (config.provider or "openai").lower()
    model = config.model_name or "gpt-4o-mini"
    temperature = getattr(config, "temperature", 0.4) or 0.4

    try:
        if provider == "openai":
            return _openai_complete(config.api_key, model, messages, temperature)

        elif provider == "openrouter":
            return _openai_complete(
                config.api_key, model, messages, temperature,
                base_url="https://openrouter.ai/api/v1"
            )

        elif provider == "anthropic":
            return _anthropic_complete(config.api_key, model, messages, temperature)

        elif provider == "gemini":
            return _gemini_complete(config.api_key, model, messages, temperature)

        else:
            logger.warning(f"LLM provider desconhecido: {provider}")
            return None

    except Exception as exc:
        logger.error(f"Erro ao chamar LLM ({provider}/{model}): {exc}")
        return None


def test_llm_connection(provider: str, api_key: str, model: str) -> dict:
    """Testa a conexão com o LLM. Retorna {'ok': bool, 'message': str}."""
    config_mock = type("Cfg", (), {
        "is_active": True,
        "api_key": api_key,
        "provider": provider,
        "model_name": model,
        "temperature": 0.1,
    })()

    try:
        result = call_llm(
            config_mock,  # type: ignore
            [
                {"role": "system", "content": "Você é um assistente educacional."},
                {"role": "user", "content": "Responda apenas: OK"},
            ]
        )
        if result:
            return {"ok": True, "message": f"Conexão OK. Resposta: {result[:80]}"}
        return {"ok": False, "message": "Resposta vazia do modelo."}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
