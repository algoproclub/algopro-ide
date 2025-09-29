#!/usr/bin/env python3

import os
import json
from pathlib import Path

import firebase_admin
from firebase_admin import firestore, credentials
from google.cloud.firestore import DocumentReference

from utils.group import change_group_ids

TOOLS_DIR = Path(__file__).resolve().parent.parent


def setup_firebase(use_emulator: bool):
    PROJECT_ID = "algopro-app"

    if use_emulator:
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
        cred_file = TOOLS_DIR / "dummyServiceAccountKey.json"
    else:
        cred_file = TOOLS_DIR / "serviceAccountKey.json"

    with open(cred_file) as f:
        dummy_firebase_cred = credentials.Certificate(json.load(f))

    firebase_admin.initialize_app(
        dummy_firebase_cred,
        {
            "projectId": PROJECT_ID,
        },
    )

setup_firebase(use_emulator=True)
print("Initialized app")

fs_client = firestore.client()
print("Connected to firestore")
print()


old_group_id_to_new_group_id = {}

for doc in fs_client.collection("groups").list_documents():
    doc: DocumentReference = doc
    snap = doc.get()
    if "~" not in doc.id:
        # NOTE: this also appends `-2025`
        old_group_id_to_new_group_id[doc.id] = snap.get("school") + "~" + doc.id + "-2025"


change_group_ids(fs_client, old_group_id_to_new_group_id)
