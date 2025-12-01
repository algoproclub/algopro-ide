#!/usr/bin/env python3

"""
Seed 5 example Yosupo problems into Firestore so that the Problems page
can list them under the 'yosupo' platform checkbox.

This script mirrors the initialization style used by tools/setup_local_data.py
and targets the Firebase emulators if they are running (recommended for local
testing via docker-compose).

Usage:
  python3 tools/yosupo_add.py

It writes documents to:
  problemsets/yosupo/problems/<id>

Requires: tools/dummyServiceAccountKey.json
"""

import json
import os
from pathlib import Path

import firebase_admin
from firebase_admin import firestore, credentials


SCRIPT_DIR = Path(__file__).resolve().parent

# Prefer emulator if available (docker-compose sets these automatically)
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:8080")

cred_path = SCRIPT_DIR / "dummyServiceAccountKey.json"
with open(cred_path) as f:
    dummy_firebase_cred = credentials.Certificate(json.load(f))

firebase_admin.initialize_app(
    dummy_firebase_cred,
    {
        "projectId": "algopro-app",
    },
)

fs_client = firestore.client()


YOSUPO_EXAMPLES = [
    {
        "id": "unionfind",
        "title": "Union Find",
        "platform": "yosupo",
        "url": "https://judge.yosupo.jp/problem/unionfind",
        "tags": ["data structures", "union find", "disjoint sets"],
    },
    {
        "id": "two_sat",
        "title": "Two Satisfiability",
        "platform": "yosupo",
        "url": "https://judge.yosupo.jp/problem/two_sat",
        "tags": ["graph algorithms", "2-sat", "satisfiability"],
    },
    {
        "id": "scc",
        "title": "Strongly Connected Components",
        "platform": "yosupo",
        "url": "https://judge.yosupo.jp/problem/scc",
        "tags": [
            "graph algorithms",
            "strongly connected components",
            "kosaraju",
            "tarjan",
        ],
    },
    {
        "id": "shortest_path",
        "title": "Shortest Path",
        "platform": "yosupo",
        "url": "https://judge.yosupo.jp/problem/shortest_path",
        "tags": ["graph algorithms", "shortest path", "dijkstra", "bellman-ford"],
    },
    {
        "id": "matrix_product",
        "title": "Matrix Product",
        "platform": "yosupo",
        "url": "https://judge.yosupo.jp/problem/matrix_product",
        "tags": ["mathematics", "matrix operations", "linear algebra"],
    },
]


def main() -> None:
    for p in YOSUPO_EXAMPLES:
        doc = fs_client.document(f"problemsets/yosupo/problems/{p['id']}")
        doc.set(p, merge=True)
        print(f"Seeded Yosupo problem: {p['id']} — {p['title']}")


if __name__ == "__main__":
    main()

