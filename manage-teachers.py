#!/usr/bin/env python3

import firebase_admin
import firebase_admin.auth
import firebase_admin.db
import argparse

# Firebase Auth custom claims used by the IDE:
# - "admin" (bool): if true, user is an admin
# - "teacher" (list): list of schools the user is a teacher for

parser = argparse.ArgumentParser()
parser.add_argument('-t', '--token', help='path to service account token file')
parser.add_argument('-d', '--dry-run', action='store_true',
                    help='print actions without performing them')
parser.add_argument(
    '--db-url', help='URL of realtime database (for --migrate-from-db)')

kind = parser.add_mutually_exclusive_group(required=True)
kind.add_argument('-A', '--admin', action='store_true',
                  help='manage admin users')
kind.add_argument('-T', '--teacher',
                  nargs=1, metavar='SCHOOL',
                  help='manage teacher users for school')

modes = parser.add_mutually_exclusive_group(required=True)
modes.add_argument('-a', '--add', nargs='+',
                   help='a list of emails to add permissions for')
modes.add_argument('-r', '--remove', nargs='+',
                   help='a list of emails to remove permissions for')
modes.add_argument('-l', '--list', action='store_true',
                   help='list all with given permission')
modes.add_argument('--migrate-from-db', action='store_true')
modes.add_argument('--migrate-add-school', action='store_true')

args = parser.parse_args()

if args.token:
    cred = firebase_admin.credentials.Certificate(args.token)
else:
    cred = None

app = firebase_admin.initialize_app(cred)


def add_permission(user):
    claims = user.custom_claims or {}

    if args.admin:
        print(f"Adding {user.email} as admin")
        claims['admin'] = True
    else:
        school = args.teacher[0]
        print(f"Adding {user.email} as teacher for school {school}")
        claims.setdefault('teacher', [])
        if school not in claims['teacher']:
            claims['teacher'].append(school)

    if not args.dry_run:
        firebase_admin.auth.set_custom_user_claims(user.uid, claims)


def remove_permission(user):
    claims = user.custom_claims or {}

    if args.admin:
        print(f"Removing {user.email} as admin")
        claims.pop('admin', None)
    else:
        print(f"Removing {user.email} as teacher for school {args.teacher[0]}")
        school = args.teacher[0]
        if 'teacher' in claims and school in claims['teacher']:
            claims['teacher'].remove(school)
            if not claims['teacher']:
                claims.pop('teacher', None)

    if not args.dry_run:
        firebase_admin.auth.set_custom_user_claims(user.uid, claims)


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
    batch_modify(args.add, add_permission)
elif args.remove:
    batch_modify(args.remove, remove_permission)
elif args.list:
    users = firebase_admin.auth.list_users()
    for user in users.iterate_all():
        claims = user.custom_claims or {}
        if args.admin and claims.get('admin'):
            print(f"{user.email} ({user.display_name})")
        elif args.teacher and 'teacher' in claims and args.teacher[0] in claims['teacher']:
            print(f"{user.email} ({user.display_name})")
elif args.migrate_from_db:
    url = args.db_url if args.db_url else 'https://algopro-app-default-rtdb.europe-west1.firebasedatabase.app'
    db = firebase_admin.db.reference("users", url=url)
    for user_id in db.get(shallow=False):
        role = db.child(f"{user_id}/role").get()
        if role == 'teacher':
            add_permission(firebase_admin.auth.get_user(user_id))
elif args.migrate_add_school:
    if not args.teacher:
        print("Please specify a school with --teacher")
        exit(1)

    users = firebase_admin.auth.list_users()
    for user in users.iterate_all():
        claims = user.custom_claims or {}
        if 'teacher' in claims and claims['teacher'] is True:
            # Change existing 'teacher': true to a list with the specified school
            claims['teacher'] = [args.teacher[0]]
            firebase_admin.auth.set_custom_user_claims(user.uid, claims)
            print(f"Updated {user.email} to have school {args.teacher[0]}")
