#!/usr/bin/env python3
"""
Firebase User Claims Editor

A script to read and write Firebase Auth custom claims for users.
Supports operations like viewing, setting, and removing custom claims.
"""

import argparse
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, credentials
from tabulate import tabulate


def setup_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        cred = credentials.Certificate(os.environ["FIREBASE_CRED_PATH"])
        firebase_admin.initialize_app(cred, {"databaseURL": os.environ["FIREBASE_REALTIME_DB_URL"]})
        print("✓ Firebase initialized successfully")
    except Exception as e:
        print(f"✗ Error initializing Firebase: {e}")
        sys.exit(1)


def get_user_by_identifier(identifier: str) -> Optional[auth.UserRecord]:
    """
    Get user by UID or email
    
    Args:
        identifier: User UID or email address
        
    Returns:
        UserRecord if found, None otherwise
    """
    try:
        # Try as UID first
        if len(identifier) == 28 and not '@' in identifier:
            return auth.get_user(identifier)
        else:
            # Try as email
            return auth.get_user_by_email(identifier)
    except auth.UserNotFoundError:
        return None
    except Exception as e:
        print(f"Error getting user {identifier}: {e}")
        return None


def format_timestamp(timestamp):
    """Helper function to safely format timestamps"""
    if not timestamp:
        return "N/A"
    
    # If it's already a string, return it as-is
    if isinstance(timestamp, str):
        return timestamp
    
    # If it's a datetime object, format it
    try:
        return timestamp.strftime("%Y-%m-%d %H:%M:%S")
    except (AttributeError, TypeError):
        return str(timestamp)


def display_user_info(user: auth.UserRecord):
    """Display user information in a formatted table"""
    user_info = [
        ["UID", user.uid],
        ["Email", user.email or "N/A"],
        ["Display Name", user.display_name or "N/A"],
        ["Email Verified", user.email_verified],
        ["Disabled", user.disabled],
        ["Creation Time", format_timestamp(user.user_metadata.creation_timestamp)],
        ["Last Sign In", format_timestamp(user.user_metadata.last_sign_in_timestamp)],
    ]
    
    print("\n📋 User Information:")
    print(tabulate(user_info, headers=["Field", "Value"], tablefmt="grid"))


def display_user_claims(user: auth.UserRecord):
    """Display user custom claims in a formatted table"""
    claims = user.custom_claims or {}
    
    if not claims:
        print("\n🔒 Custom Claims: None")
        return
    
    claims_info = []
    for key, value in claims.items():
        if isinstance(value, (list, dict)):
            value_str = json.dumps(value, indent=2)
        else:
            value_str = str(value)
        claims_info.append([key, type(value).__name__, value_str])
    
    print("\n🔒 Custom Claims:")
    print(tabulate(claims_info, headers=["Claim", "Type", "Value"], tablefmt="grid"))


def list_users_with_claims(limit: int = 50, claim: Optional[str] = None, invert: bool = False):
    """List users that have custom claims"""
    print(
        f"\n👥 Users with Custom Claims (limit: {limit}{', claim: ' + ('!' if invert else '') + claim if claim else ''}):"
    )

    users_with_claims = []
    page = auth.list_users(max_results=limit)
    
    while page:
        for user in page.users:
            claims = user.custom_claims or {}
            claim_keys = list(claims.keys())
            has_claim = claim in claims if claim else len(claim_keys) > 0
            if (invert and has_claim) or (not invert and not has_claim):
                continue

            users_with_claims.append(
                [
                    user.uid[:10] + "...",
                    user.email or "N/A",
                    user.display_name or "N/A",
                    ", ".join(claim_keys),
                ]
            )

        if len(users_with_claims) >= limit:
            break
            
        # Get next page if available
        try:
            page = page.get_next_page()
        except:
            break
    
    if users_with_claims:
        print(tabulate(users_with_claims, headers=["UID", "Email", "Name", "Claims"], tablefmt="grid"))
    else:
        print("No users found with custom claims.")


def set_user_claims(user: auth.UserRecord, claims_data: Dict[str, Any]):
    """Set custom claims for a user"""
    try:
        # Get existing claims and merge with new ones
        existing_claims = user.custom_claims or {}
        merged_claims = {**existing_claims, **claims_data}
        
        auth.set_custom_user_claims(user.uid, merged_claims)
        print(f"✓ Successfully updated claims for user {user.email or user.uid}")
        
        # Display updated claims
        updated_user = auth.get_user(user.uid)
        display_user_claims(updated_user)
        
    except Exception as e:
        print(f"✗ Error setting claims: {e}")


def remove_user_claims(user: auth.UserRecord, claim_keys: List[str]):
    """Remove specific custom claims from a user"""
    try:
        existing_claims = user.custom_claims or {}
        
        # Remove specified keys
        for key in claim_keys:
            existing_claims.pop(key, None)
        
        auth.set_custom_user_claims(user.uid, existing_claims)
        print(f"✓ Successfully removed claims {claim_keys} for user {user.email or user.uid}")
        
        # Display updated claims
        updated_user = auth.get_user(user.uid)
        display_user_claims(updated_user)
        
    except Exception as e:
        print(f"✗ Error removing claims: {e}")


def clear_all_claims(user: auth.UserRecord):
    """Clear all custom claims for a user"""
    try:
        auth.set_custom_user_claims(user.uid, {})
        print(f"✓ Successfully cleared all claims for user {user.email or user.uid}")
        
    except Exception as e:
        print(f"✗ Error clearing claims: {e}")


def parse_claims_input(claims_str: str) -> Dict[str, Any]:
    """Parse claims string input into a dictionary"""
    try:
        # Try to parse as JSON first
        return json.loads(claims_str)
    except json.JSONDecodeError:
        # Fall back to key=value parsing
        claims = {}
        pairs = claims_str.split(',')
        
        for pair in pairs:
            if '=' not in pair:
                continue
                
            key, value = pair.split('=', 1)
            key = key.strip()
            value = value.strip()
            
            # Try to parse value as JSON, otherwise keep as string
            try:
                claims[key] = json.loads(value)
            except json.JSONDecodeError:
                # Handle boolean strings
                if value.lower() in ('true', 'false'):
                    claims[key] = value.lower() == 'true'
                else:
                    claims[key] = value
        
        return claims


def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Firebase User Claims Editor")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # View user command
    view_parser = subparsers.add_parser('view', help='View user information and claims')
    view_parser.add_argument('user', help='User UID or email')
    
    # List users command
    list_parser = subparsers.add_parser('list', help='List users with custom claims')
    list_parser.add_argument('--limit', type=int, default=50, help='Maximum number of users to display')
    list_parser.add_argument('--claim', type=str, help='Filter users by specific claim key')
    list_parser.add_argument('--invert', action='store_true', help='Invert the claim filter to show users without the specified claim')

    # Set claims command
    set_parser = subparsers.add_parser('set', help='Set custom claims for a user')
    set_parser.add_argument('user', help='User UID or email')
    set_parser.add_argument('claims', help='Claims as JSON string or key=value,key=value format')
    
    # Remove claims command
    remove_parser = subparsers.add_parser('remove', help='Remove specific claims from a user')
    remove_parser.add_argument('user', help='User UID or email')
    remove_parser.add_argument('keys', help='Comma-separated list of claim keys to remove')
    
    # Clear all claims command
    clear_parser = subparsers.add_parser('clear', help='Clear all custom claims for a user')
    clear_parser.add_argument('user', help='User UID or email')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Setup logging
    logging.basicConfig(level=logging.WARNING)
    
    # Initialize Firebase
    setup_firebase()
    
    if args.command == 'list':
        list_users_with_claims(args.limit, args.claim, args.invert)
        return
    
    # For all other commands, we need a user
    user = get_user_by_identifier(args.user)
    if not user:
        print(f"✗ User not found: {args.user}")
        return
    
    if args.command == 'view':
        display_user_info(user)
        display_user_claims(user)
    
    elif args.command == 'set':
        try:
            claims_data = parse_claims_input(args.claims)
            set_user_claims(user, claims_data)
        except Exception as e:
            print(f"✗ Error parsing claims: {e}")
            print("Examples:")
            print('  JSON: {"teacher": ["math", "physics"], "admin": true}')
            print('  Key-value: teacher=["math","physics"],admin=true')
    
    elif args.command == 'remove':
        keys = [key.strip() for key in args.keys.split(',')]
        remove_user_claims(user, keys)
    
    elif args.command == 'clear':
        confirm = input(f"Are you sure you want to clear all claims for {user.email or user.uid}? (y/N): ")
        if confirm.lower() == 'y':
            clear_all_claims(user)
        else:
            print("Operation cancelled.")


if __name__ == "__main__":
    main()
