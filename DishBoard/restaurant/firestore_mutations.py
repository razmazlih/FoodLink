"""Atomic ownership checks and parent locks for Firestore menu mutations."""
from google.cloud import firestore
from rest_framework.exceptions import NotFound, NotAuthenticated, PermissionDenied
from foodlink_core.firebase import db


def require_owner(identity, restaurant):
    if identity is None or not identity.is_authenticated:
        raise NotAuthenticated("Firebase sign-in required.")
    if not identity.is_admin and (identity.role != "restaurant_owner" or restaurant.get("owner_uid") != identity.uid):
        raise PermissionDenied("Restaurant ownership required.")


def read(transaction, collection, identifier):
    snapshot = db().collection(collection).document(str(identifier)).get(transaction=transaction)
    if not snapshot.exists:
        raise NotFound("Not found.")
    return {**snapshot.to_dict(), "id": int(snapshot.id)}


def query(transaction, collection, filters):
    from google.cloud.firestore_v1.base_query import FieldFilter
    reference = db().collection(collection)
    for field, value in filters:
        reference = reference.where(filter=FieldFilter(field, "==", value))
    return [{**snapshot.to_dict(), "id": int(snapshot.id)} for snapshot in reference.stream(transaction=transaction)]


def owned_transaction(identity, restaurant_ids, operation, deleting=False):
    """Touch parents so child changes conflict with transfer/delete transactions."""
    client = db()
    @firestore.transactional
    def run(transaction):
        parents = {identifier: read(transaction, "restaurants", identifier) for identifier in sorted(set(restaurant_ids))}
        for parent in parents.values():
            require_owner(identity, parent)
        result = operation(transaction, parents)
        if not deleting:
            for identifier in parents:
                transaction.update(client.collection("restaurants").document(str(identifier)), {"_revision": firestore.Increment(1)})
        return result
    return run(client.transaction())


def reference(collection, identifier):
    return db().collection(collection).document(str(identifier))
