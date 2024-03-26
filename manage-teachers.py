#!/usr/bin/env python3

import firebase_admin
import firebase_admin.auth
import firebase_admin.db
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-t', '--token', help='path to service account token file')
parser.add_argument('-d', '--dry-run', action='store_true',
                    help='print actions without performing them')
parser.add_argument(
    '--db-url', help='URL of realtime database (for --migrate-from-db)')

modes = parser.add_mutually_exclusive_group(required=True)
modes.add_argument('-a', '--add', nargs='+',
                   help='a list of emails to mark as teachers')
modes.add_argument('-r', '--remove', nargs='+',
                   help='a list of emails to mark as students')
modes.add_argument('-l', '--list', action='store_true',
                   help='list all teachers')
modes.add_argument('--migrate-from-db', action='store_true')

args = parser.parse_args()

if args.token:
    cred = firebase_admin.credentials.Certificate(args.token)
else:
    cred = None

app = firebase_admin.initialize_app(cred)


def mark_teacher(user):
    print(f"Adding teacher role: {user.email}")
    if not args.dry_run:
        firebase_admin.auth.set_custom_user_claims(user.uid, {'teacher': True})


def mark_not_teacher(user):
    print(f"Removing teacher role: {user.email}")
    if not args.dry_run:
        firebase_admin.auth.set_custom_user_claims(
            user.uid, {'teacher': False})


def batch_modify(emails, operation):
    users = firebase_admin.auth.get_users(
        [firebase_admin.auth.EmailIdentifier(email) for email in emails])
    for user in users.users:
        operation(user)
    if len(users.not_found) > 0:
        for user in users.not_found:
            print(f"Unknown user: {user.email}")
        exit(1)


if args.add:
    batch_modify(args.add, mark_teacher)
elif args.remove:
    batch_modify(args.remove, mark_not_teacher)
elif args.list:
    users = firebase_admin.auth.list_users()
    print("Teachers:")
    print("---------")
    for user in users.iterate_all():
        if user.custom_claims is not None and user.custom_claims['teacher']:
            print(f"{user.email} ({user.display_name})")
elif args.migrate_from_db:
    url = args.db_url if args.db_url else 'https://algopro-app-default-rtdb.europe-west1.firebasedatabase.app'
    db = firebase_admin.db.reference("users", url=url)
    for user_id in db.get(shallow=False):
        role = db.child(f"{user_id}/role").get()
        if role == 'teacher':
            mark_teacher(firebase_admin.auth.get_user(user_id))
