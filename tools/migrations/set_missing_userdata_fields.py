#!/usr/bin/env python3

import os
import json
from pathlib import Path

import firebase_admin
from firebase_admin import auth, firestore, credentials

TOOLS_DIR = Path(__file__).resolve().parent.parent

def setup_firebase(use_emulator: bool):
    PROJECT_ID = "algopro-app"

    if use_emulator:
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099"
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

setup_firebase(use_emulator=False)
print("Initialized app")

fs_client = firestore.client()
print("Connected to firestore")
print()


uid_to_updates = {}
page = auth.list_users()
while page is not None:
    for user in page.users:
        uid = user.uid
        display_name = user.display_name
        ref = fs_client.document("userdata", uid)
        snap = ref.get().to_dict()

        if snap is None:
            snap = {}
            action = '\033[32mCreate\033[0m'
        else:
            action = '\033[33mUpdate\033[0m'

        updates = {}
        if "schools" not in snap.keys():
            updates["schools"] = []
        if "groups" not in snap.keys():
            updates["groups"] = []
        if "user_full_name" not in snap.keys():
            updates["user_full_name"] = display_name

        if len(updates.keys()) != 0:
            uid_to_updates[uid] = updates
            print(f"{action} {ref.path} ({display_name}): \t{updates}")

    page = page.get_next_page()

if input("Do you want to proceed with these changes? Type 'Yes': ") == "Yes":
    for uid, updates in uid_to_updates.items():
        ref = fs_client.document("userdata", uid)
        # we use .set(..., merge=True) instead of .update(...) to also create missing the docs
        ref.set(updates, merge=True)
