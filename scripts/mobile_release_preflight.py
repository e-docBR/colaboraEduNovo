#!/usr/bin/env python3
"""Preflight para build Android real do ColaboraEdu Familia."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EAS_PATH = ROOT / "mobile" / "eas.json"
EXPECTED_API_URL = "https://gestao.colaboraedu.cloud/api/v1"
EXPECTED_TENANT = "colegio-frei-ronaldo"


def fetch_json(url: str):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ColaboraEdu-Mobile-Release-Preflight/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Falha ao acessar {url}: {exc}") from exc


def check_profile(name: str, profile: dict) -> None:
    env = profile.get("env") or {}
    api_url = env.get("EXPO_PUBLIC_API_URL")
    tenant = env.get("EXPO_PUBLIC_TENANT_SLUG")
    if api_url != EXPECTED_API_URL:
        raise RuntimeError(f"profile {name}: EXPO_PUBLIC_API_URL invalida: {api_url!r}")
    if tenant != EXPECTED_TENANT:
        raise RuntimeError(f"profile {name}: EXPO_PUBLIC_TENANT_SLUG invalido: {tenant!r}")
    print(f"OK eas profile {name}: API e tenant reais")


def main() -> int:
    eas = json.loads(EAS_PATH.read_text())
    build = eas.get("build") or {}
    check_profile("preview", build.get("preview") or {})
    check_profile("production", build.get("production") or {})

    health = fetch_json("https://gestao.colaboraedu.cloud/health")
    if health.get("status") != "ok":
        raise RuntimeError(f"health inesperado: {health}")
    print("OK API publica: health")

    tenants = fetch_json(f"{EXPECTED_API_URL}/auth/tenants")
    matched = [tenant for tenant in tenants if tenant.get("slug") == EXPECTED_TENANT]
    if not matched:
        raise RuntimeError(f"tenant {EXPECTED_TENANT!r} nao encontrado em producao: {tenants}")
    print(f"OK tenant producao: {matched[0].get('name')} ({EXPECTED_TENANT})")

    print("Preflight mobile release concluido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
