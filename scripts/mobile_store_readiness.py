#!/usr/bin/env python3
"""Local Play Store readiness checks for the ColaboraEdu mobile app."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"
APP_JSON = MOBILE / "app.json"
EAS_JSON = MOBILE / "eas.json"
PACKAGE_JSON = MOBILE / "package.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def image_info(path: Path) -> tuple[str, int, int] | None:
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        return ("PNG", width, height)
    if data.startswith(b"\xff\xd8"):
        index = 2
        while index + 9 < len(data):
            if data[index] != 0xFF:
                index += 1
                continue
            marker = data[index + 1]
            index += 2
            if marker in {0xD8, 0xD9}:
                continue
            if index + 2 > len(data):
                break
            segment_length = struct.unpack(">H", data[index : index + 2])[0]
            if marker in range(0xC0, 0xC4):
                if index + 7 > len(data):
                    break
                height, width = struct.unpack(">HH", data[index + 3 : index + 7])
                return ("JPEG", width, height)
            index += segment_length
    return None


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    app_config = load_json(APP_JSON)["expo"]
    eas_config = load_json(EAS_JSON)
    package_config = load_json(PACKAGE_JSON)

    expected = {
        "name": "ColaboraEdu Família",
        "slug": "colaboraedu-familia",
        "scheme": "colaboraedu-familia",
        "android.package": "cloud.colaboraedu.familia",
    }

    actual = {
        "name": app_config.get("name"),
        "slug": app_config.get("slug"),
        "scheme": app_config.get("scheme"),
        "android.package": app_config.get("android", {}).get("package"),
    }

    for field, expected_value in expected.items():
        if actual.get(field) != expected_value:
            errors.append(f"{field}: esperado {expected_value!r}, atual {actual.get(field)!r}")

    version = app_config.get("version")
    version_code = app_config.get("android", {}).get("versionCode")
    if not isinstance(version, str) or not version:
        errors.append("expo.version ausente")
    if not isinstance(version_code, int) or version_code < 1:
        errors.append("android.versionCode deve ser inteiro >= 1")

    production_env = eas_config.get("build", {}).get("production", {}).get("env", {})
    if production_env.get("EXPO_PUBLIC_API_URL") != "https://gestao.colaboraedu.cloud/api/v1":
        errors.append("production.EXPO_PUBLIC_API_URL não aponta para a API oficial")
    if production_env.get("EXPO_PUBLIC_TENANT_SLUG") != "colegio-frei-ronaldo":
        errors.append("production.EXPO_PUBLIC_TENANT_SLUG inválido")

    scripts = package_config.get("scripts", {})
    for script_name in ("build:android:preview", "build:android:production"):
        if script_name not in scripts:
            errors.append(f"script npm ausente: {script_name}")

    asset_fields = {
        "icon": app_config.get("icon"),
        "splash.image": app_config.get("splash", {}).get("image"),
        "android.adaptiveIcon.foregroundImage": app_config.get("android", {})
        .get("adaptiveIcon", {})
        .get("foregroundImage"),
    }
    for label, relative_path in asset_fields.items():
        if not relative_path:
            errors.append(f"asset ausente em app.json: {label}")
            continue
        asset_path = MOBILE / relative_path
        if not asset_path.exists():
            errors.append(f"asset não encontrado: {relative_path}")
            continue
        info = image_info(asset_path)
        if not info:
            errors.append(f"não foi possível ler imagem: {relative_path}")
            continue
        kind, width, height = info
        if asset_path.suffix.lower() == ".png" and kind != "PNG":
            warnings.append(f"{relative_path}: extensão .png, mas conteúdo {kind}")
        if min(width, height) < 512:
            warnings.append(f"{relative_path}: dimensão baixa para loja ({width}x{height})")

    print("OK app: nome, pacote, versão e EAS conferidos.")
    if warnings:
        print("Avisos:")
        for warning in warnings:
            print(f"- {warning}")
    if errors:
        print("Erros:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Prontidão Play Store concluída.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
