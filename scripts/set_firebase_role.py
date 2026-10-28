"""Explicit operator action: grant a Firebase custom role to an EXISTING account."""
import argparse
from firebase_admin import auth
from foodlink_core.firebase import initialize


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email',required=True)
    parser.add_argument('--role',choices=['admin','restaurant_owner','customer'],required=True)
    args=parser.parse_args()
    initialize()
    user=auth.get_user_by_email(args.email)
    claims=dict(user.custom_claims or {})
    claims.pop('admin',None)
    claims['role']=args.role
    auth.set_custom_user_claims(user.uid,claims)
    auth.revoke_refresh_tokens(user.uid)
    print('Role updated. The account must sign in again; no password was changed.')


if __name__=='__main__':
    main()
