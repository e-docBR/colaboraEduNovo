"""LLM Provider abstraction — suporta OpenAI, Anthropic, OpenRouter e Gemini.

Todas as chamadas são feitas via HTTP puro (requests), sem dependências extras.
Cada provider implementa `complete(messages) -> str`.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Iterator

import requests
from loguru import logger

if TYPE_CHECKING:
    from ..models.ai_configuration import AIConfiguration


TIMEOUT = 30  # segundos


def _parse_api_error(exc: requests.HTTPError) -> str:
    """Extrai a mensagem de erro legível da resposta HTTP."""
    try:
        body = exc.response.json()
        # OpenAI / OpenRouter: {"error": {"message": "..."}}
        if "error" in body:
            err = body["error"]
            if isinstance(err, dict):
                return err.get("message", str(exc))
            return str(err)
        # Anthropic: {"type": "error", "error": {"message": "..."}}
        # Gemini: {"error": {"message": "..."}}
        return str(body)
    except Exception:
        return f"HTTP {exc.response.status_code}: {exc.response.text[:300]}"


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
            "max_tokens": 1500,
        },
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc
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
            "max_tokens": 1500,
        },
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc
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
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 1500},
    }
    if system_instruction:
        payload["system_instruction"] = {"parts": [{"text": system_instruction}]}

    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc
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

    provider = provider.lower()

    try:
        messages = [
            {"role": "system", "content": "Você é um assistente educacional."},
            {"role": "user", "content": "Responda apenas com a palavra: OK"},
        ]

        if provider in ("openai", "openrouter"):
            base = "https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1"
            result = _openai_complete(api_key, model, messages, 0.1, base_url=base)
        elif provider == "anthropic":
            result = _anthropic_complete(api_key, model, messages, 0.1)
        elif provider == "gemini":
            result = _gemini_complete(api_key, model, messages, 0.1)
        else:
            return {"ok": False, "message": f"Provider desconhecido: {provider}"}

        if result:
            preview = result.strip()[:120]
            return {"ok": True, "message": f"✅ Conexão OK! Resposta do modelo: \"{preview}\""}
        return {"ok": False, "message": "Resposta vazia do modelo."}

    except requests.HTTPError as exc:
        msg = str(exc)
        logger.error(f"Teste LLM falhou ({provider}/{model}): {msg}")
        return {"ok": False, "message": f"❌ Erro da API: {msg}"}

    except requests.ConnectionError:
        return {"ok": False, "message": "❌ Sem conexão com a internet ou API indisponível."}

    except requests.Timeout:
        return {"ok": False, "message": f"❌ Timeout ({TIMEOUT}s) — modelo pode estar sobrecarregado."}

    except Exception as exc:
        logger.error(f"Teste LLM erro inesperado ({provider}/{model}): {exc}")
        return {"ok": False, "message": f"❌ Erro inesperado: {str(exc)[:200]}"}


# ─── Streaming ───────────────────────────────────────────────────────────────

def _openai_stream(api_key: str, model: str, messages: list[dict], temperature: float, base_url: str = "https://api.openai.com/v1") -> Iterator[str]:
    resp = requests.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://colaboraedu.com.br",
            "X-Title": "ColaboraEdu AI",
        },
        json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": 1500, "stream": True},
        stream=True,
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc

    for line in resp.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8") if isinstance(line, bytes) else line
        if not decoded.startswith("data: "):
            continue
        payload = decoded[6:]
        if payload.strip() == "[DONE]":
            break
        try:
            delta = json.loads(payload)["choices"][0]["delta"].get("content") or ""
            if delta:
                yield delta
        except (json.JSONDecodeError, KeyError, IndexError):
            pass


def _anthropic_stream(api_key: str, model: str, messages: list[dict], temperature: float) -> Iterator[str]:
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_msgs = [m for m in messages if m["role"] != "system"]
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
        json={"model": model, "system": system_msg, "messages": user_msgs,
              "temperature": temperature, "max_tokens": 1500, "stream": True},
        stream=True,
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc

    for line in resp.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8") if isinstance(line, bytes) else line
        if not decoded.startswith("data: "):
            continue
        try:
            event = json.loads(decoded[6:])
            if event.get("type") == "content_block_delta":
                text = event.get("delta", {}).get("text") or ""
                if text:
                    yield text
        except (json.JSONDecodeError, KeyError):
            pass


def _gemini_stream(api_key: str, model: str, messages: list[dict], temperature: float) -> Iterator[str]:
    contents = []
    for m in messages:
        if m["role"] == "system":
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    system_instruction = next((m["content"] for m in messages if m["role"] == "system"), None)
    payload: dict = {"contents": contents, "generationConfig": {"temperature": temperature, "maxOutputTokens": 1500}}
    if system_instruction:
        payload["system_instruction"] = {"parts": [{"text": system_instruction}]}

    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}&alt=sse",
        headers={"Content-Type": "application/json"},
        json=payload,
        stream=True,
        timeout=TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(_parse_api_error(exc), response=exc.response) from exc

    for line in resp.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8") if isinstance(line, bytes) else line
        if not decoded.startswith("data: "):
            continue
        try:
            text = json.loads(decoded[6:])["candidates"][0]["content"]["parts"][0]["text"]
            if text:
                yield text
        except (json.JSONDecodeError, KeyError, IndexError):
            pass


def stream_llm(config: "AIConfiguration", messages: list[dict]) -> Iterator[str]:
    """Chama o LLM em modo streaming. Yields text chunks."""
    if not config or not config.is_active or not config.api_key:
        return

    provider = (config.provider or "openai").lower()
    model = config.model_name or "gpt-4o-mini"
    temperature = getattr(config, "temperature", 0.4) or 0.4

    try:
        if provider == "openai":
            yield from _openai_stream(config.api_key, model, messages, temperature)
        elif provider == "openrouter":
            yield from _openai_stream(config.api_key, model, messages, temperature,
                                      base_url="https://openrouter.ai/api/v1")
        elif provider == "anthropic":
            yield from _anthropic_stream(config.api_key, model, messages, temperature)
        elif provider == "gemini":
            yield from _gemini_stream(config.api_key, model, messages, temperature)
        else:
            logger.warning(f"Stream LLM provider desconhecido: {provider}")
    except Exception as exc:
        logger.error(f"Erro ao fazer stream LLM ({provider}/{model}): {exc}")
