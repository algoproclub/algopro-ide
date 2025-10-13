#!/usr/bin/env python3

import os
import json
from pathlib import Path
import time

import firebase_admin
from firebase_admin import auth, firestore, db, credentials

SCRIPT_DIR = Path(__file__).resolve().parent

os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099"
os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
os.environ["FIREBASE_DATABASE_EMULATOR_HOST"] = "localhost:9000"

with open(SCRIPT_DIR / "dummyServiceAccountKey.json") as f:
    dummy_firebase_cred = credentials.Certificate(json.load(f))

firebase_admin.initialize_app(
    dummy_firebase_cred,
    {
        "projectId": "algopro-app",
    },
)
print("Initialized app")

db_root_ref = db.reference(url="http://127.0.0.1:9000/?ns=algopro-app-default-rtdb")
print("Conencted to database")

fs_client = firestore.client()
print("Connected to firestore")
print()


try:
    with open(SCRIPT_DIR / "submit-creds.json") as f:
        submit_creds: dict[str, list] = json.load(f)
    creds_ref = db_root_ref.child("credentials")
    creds_ref.set(submit_creds)
    print(f"Loaded submit creds for: {', '.join(submit_creds.keys())}")
except FileNotFoundError:
    print("Failed to open submit-creds.json")

print()


def make_school(*, school_id: str, name: str):
    school_doc = fs_client.document("schools", school_id)
    school_doc.set({"name": name})


def make_group(*, unprefixed_id: str, name: str, school: str) -> None:
    id = school + "~" + unprefixed_id
    group_doc = fs_client.document("groups", id)
    group_doc.set({"name": name, "school": school})


def make_class(*, group_id: str, class_id: str, tasks: list) -> None:
    class_doc = fs_client.document("groups", group_id, "classes", class_id)
    class_doc.set({"creationTime": int(time.time() * 1000), "tasks": tasks})


def make_user(
    *,
    email: str,
    display_name: str,
    password: str,
    is_admin: bool,
    teacher_in_schools: list[str],
    student_in_schools: list[str],
    groups: list[str],
) -> auth.UserRecord:
    claims = {}
    claims["registered"] = True
    if is_admin:
        claims["admin"] = True
    if len(teacher_in_schools) > 0:
        claims["teacher"] = teacher_in_schools

    try:
        user = auth.get_user_by_email(email)
    except:
        user = auth.create_user(email=email)
    user = auth.update_user(
        user.uid,
        email=email,
        display_name=display_name,
        password=password,
        custom_claims=claims,
    )

    userdata_doc = fs_client.document("userdata", user.uid)
    userdata_doc.set(
        {
            "user_full_name": display_name,
            "schools": student_in_schools,
            "groups": groups,
        },
        merge=True,
    )
    return user


make_school(school_id="algopro", name="Algo Pro Club")

make_group(school="algopro", unprefixed_id="group-1", name="Algo Pro Group 1",)
make_class(
    group_id="algopro~group-1",
    class_id="01",
    tasks=[
        {
            "id": "1068",
            "platform": "cses",
            "title": "Weird Algorithm",
            "url": "https://cses.fi/problemset/task/1068",
        },
        {
            "id": "1069",
            "platform": "cses",
            "title": "Repetitions",
            "url": "https://cses.fi/problemset/task/1069",
        },
    ],
)
make_class(
    group_id="algopro~group-1",
    class_id="02",
    tasks=[
        {
            "id": "1070",
            "platform": "cses",
            "title": "Permutations",
            "url": "https://cses.fi/problemset/task/1070",
        }
    ],
)

make_group(school="algopro", unprefixed_id="group-2", name="Algo Pro Group 2")
make_class(
    group_id="algopro~group-2",
    class_id="01",
    tasks=[
        {
            "id": "1068",
            "platform": "cses",
            "title": "Weird Algorithm",
            "url": "https://cses.fi/problemset/task/1068",
        },
    ],
)


make_user(
    email="admin@example.com",
    display_name="Admin User",
    password="password123",
    is_admin=True,
    teacher_in_schools=[],
    student_in_schools=[],
    groups=[],
)

make_user(
    email="algoproteacher1@example.com",
    display_name="AlgoPro Teacher 1",
    password="password123",
    is_admin=False,
    teacher_in_schools=["algopro"],
    student_in_schools=[],
    groups=[],
)

make_user(
    email="algoprostudent1@example.com",
    display_name="AlgoPro Student 1",
    password="password123",
    is_admin=False,
    teacher_in_schools=[],
    student_in_schools=["algopro"],
    groups=["algopro~group-1"],
)

make_user(
    email="algoprostudent2@example.com",
    display_name="AlgoPro Student 2",
    password="password123",
    is_admin=False,
    teacher_in_schools=[],
    student_in_schools=["algopro"],
    groups=["algopro~group-1"],
)

make_user(
    email="algoprostudent3@example.com",
    display_name="AlgoPro Student 3",
    password="password123",
    is_admin=False,
    teacher_in_schools=[],
    student_in_schools=["algopro"],
    groups=[],
)

make_user(
    email="noschoolstudent@example.com",
    display_name="NoSchool Student",
    password="password123",
    is_admin=False,
    teacher_in_schools=[],
    student_in_schools=[],
    groups=[],
)
